#!/usr/bin/env python3
"""
category_backfill.py (Invest-Pack) — one-off, targeted history backfill for the
Bloomberg instruments in one or more categories. Writes to pack.pack_data
(instrument_id, obs_date, value); weekends dropped; currency override applied.

Usage:
  py watcher/category_backfill.py --category "Metals" [--from 2001-01-01] [--to YYYY-MM-DD]
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
from collections import defaultdict
from datetime import date

from dotenv import load_dotenv

try:
    import blpapi
except ImportError:
    print("ERROR: blpapi not installed.", file=sys.stderr)
    raise

from supabase import create_client


load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
BLP_HOST, BLP_PORT = "localhost", 8194

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s  %(levelname)-7s  %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
log = logging.getLogger("category_backfill")


def load_instruments(sb, categories):
    rows = (sb.table("instruments")
            .select("id, name, bloomberg_ticker, bloomberg_field, currency, category")
            .eq("is_active", True).in_("category", categories).execute()).data or []
    out = [{"id": r["id"], "name": r["name"], "ticker": r["bloomberg_ticker"],
            "field": r["bloomberg_field"], "currency": r.get("currency")}
           for r in rows if r.get("bloomberg_ticker") and r.get("bloomberg_field")]
    log.info("Loaded %s instrument(s) in %s.", len(out), categories)
    return out


def start_session():
    opts = blpapi.SessionOptions()
    opts.setServerHost(BLP_HOST)
    opts.setServerPort(BLP_PORT)
    session = blpapi.Session(opts)
    if not session.start():
        raise RuntimeError("Failed to start Bloomberg session.")
    if not session.openService("//blp/refdata"):
        session.stop()
        raise RuntimeError("Failed to open //blp/refdata service.")
    log.info("Bloomberg session ready.")
    return session, session.getService("//blp/refdata")


def fetch_historical(session, service, instruments, from_date, to_date):
    groups = defaultdict(list)
    for i in instruments:
        groups[(i["field"], i["currency"])].append(i)
    results = {}
    for (field_name, ccy), group in groups.items():
        ticker_to_id = {i["ticker"]: i["id"] for i in group}
        log.info("Historical %s [%s] for %s ticker(s) [%s -> %s] ...",
                 field_name, ccy or "native", len(group), from_date, to_date)
        request = service.createRequest("HistoricalDataRequest")
        for t in ticker_to_id:
            request.getElement("securities").appendValue(t)
        request.getElement("fields").appendValue(field_name)
        request.set("startDate", from_date.strftime("%Y%m%d"))
        request.set("endDate", to_date.strftime("%Y%m%d"))
        request.set("periodicitySelection", "DAILY")
        if ccy:
            request.set("currency", ccy)
        session.sendRequest(request)
        waiting = True
        while waiting:
            event = session.nextEvent(timeout=60000)
            for msg in event:
                if not msg.hasElement("securityData"):
                    continue
                sec = msg.getElement("securityData")
                ticker = sec.getElementAsString("security")
                iid = ticker_to_id.get(ticker)
                if iid is None or sec.hasElement("securityError"):
                    if sec.hasElement("securityError"):
                        log.warning("Bloomberg error for %s", ticker)
                    continue
                arr = sec.getElement("fieldData")
                for i in range(arr.numValues()):
                    pt = arr.getValue(i)
                    try:
                        dt = pt.getElementAsDatetime("date")
                        iso = f"{dt.year}-{dt.month:02d}-{dt.day:02d}"
                        results[(iid, iso)] = pt.getElementAsFloat(field_name)
                    except Exception as ex:
                        log.debug("parse error: %s", ex)
            if event.eventType() in (blpapi.Event.RESPONSE, blpapi.Event.TIMEOUT):
                waiting = False
    dropped = [k for k in results if date.fromisoformat(k[1]).weekday() >= 5]
    for k in dropped:
        del results[k]
    if dropped:
        log.info("Dropped %s weekend datapoint(s).", len(dropped))
    log.info("Returned %s weekday datapoint(s).", len(results))
    return results


def upsert(sb, points):
    rows = [{"instrument_id": iid, "obs_date": iso, "value": v} for (iid, iso), v in points.items()]
    for i in range(0, len(rows), 500):
        sb.table("pack_data").upsert(rows[i:i + 500], on_conflict="instrument_id,obs_date").execute()
        log.info("Upserted %s / %s", min(i + 500, len(rows)), len(rows))
    return len(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--category", action="append", required=True)
    ap.add_argument("--from", dest="from_date", default="2001-01-01")
    ap.add_argument("--to", dest="to_date", default=None)
    args = ap.parse_args()
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("SUPABASE_URL and SUPABASE_KEY must be set in .env"); sys.exit(1)
    sb = create_client(SUPABASE_URL, SUPABASE_KEY).schema("pack")
    from_date = date.fromisoformat(args.from_date)
    to_date = date.fromisoformat(args.to_date) if args.to_date else date.today()
    instruments = load_instruments(sb, args.category)
    if not instruments:
        log.error("No active instruments in %s. Aborting.", args.category); sys.exit(1)
    session, service = start_session()
    try:
        n = upsert(sb, fetch_historical(session, service, instruments, from_date, to_date))
        log.info("=== category_backfill complete — %s datapoints ===", n)
    finally:
        try:
            session.stop()
        except Exception:
            pass


if __name__ == "__main__":
    main()
