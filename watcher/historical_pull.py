#!/usr/bin/env python3
"""historical_pull.py (Invest-Pack) — Bloomberg pull into the pack schema.
Backfills last 3 days + any gap through today (HistoricalDataRequest, DAILY),
weekends dropped, currency override per instrument ("FX=ZAR" equivalent).
Writes to pack.pack_data (instrument_id, obs_date, value)."""
from __future__ import annotations

import argparse
import logging
import os
import sys
from collections import defaultdict
from datetime import date, timedelta

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
log = logging.getLogger("historical_pull")


def sb_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY).schema("pack")


def load_active_instruments(sb):
    rows = (sb.table("instruments")
            .select("id, name, bloomberg_ticker, bloomberg_field, currency")
            .eq("is_active", True).execute()).data or []
    out = []
    for r in rows:
        if r.get("bloomberg_ticker") and r.get("bloomberg_field"):
            out.append({"id": r["id"], "name": r["name"], "ticker": r["bloomberg_ticker"],
                        "field": r["bloomberg_field"], "currency": r.get("currency")})
    return out


def find_last_date(sb):
    rows = (sb.table("pack_data").select("obs_date").order("obs_date", desc=True).limit(1).execute()).data or []
    return date.fromisoformat(rows[0]["obs_date"]) if rows else None


def start_session():
    log.info("Connecting to Bloomberg at %s:%s ...", BLP_HOST, BLP_PORT)
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


def _groups(instruments):
    g = defaultdict(list)
    for i in instruments:
        g[(i["field"], i["currency"])].append(i)
    return g


def fetch_historical(session, service, instruments, from_date, to_date):
    results = {}
    for (field_name, ccy), group in _groups(instruments).items():
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
            event = session.nextEvent(timeout=30000)
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
    log.info("Historical returned %s datapoints.", len(results))
    return results


def drop_weekends(points):
    dropped = [k for k in points if date.fromisoformat(k[1]).weekday() >= 5]
    for k in dropped:
        del points[k]
    if dropped:
        log.info("Dropped %s weekend datapoint(s).", len(dropped))


def upsert(sb, points):
    if not points:
        return 0
    rows = [{"instrument_id": iid, "obs_date": iso, "value": v} for (iid, iso), v in points.items()]
    for i in range(0, len(rows), 500):
        sb.table("pack_data").upsert(rows[i:i + 500], on_conflict="instrument_id,obs_date").execute()
        log.info("Upserted %s / %s", min(i + 500, len(rows)), len(rows))
    return len(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="from_date", default=None)
    ap.add_argument("--to", dest="to_date", default=None)
    args = ap.parse_args()
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("SUPABASE_URL and SUPABASE_KEY must be set in .env"); sys.exit(1)

    sb = sb_client()
    today = date.today()
    to_date = date.fromisoformat(args.to_date) if args.to_date else today

    if args.from_date:
        from_date = date.fromisoformat(args.from_date)
    else:
        last = find_last_date(sb)
        if last is None:
            log.error("pack_data is empty and no --from given. Aborting."); sys.exit(1)
        from_date = min(last + timedelta(days=1), today - timedelta(days=3))  # re-pull last 3 days

    instruments = load_active_instruments(sb)
    if not instruments:
        log.error("No active Bloomberg instruments. Aborting."); sys.exit(1)
    log.info("%s active Bloomberg instruments.", len(instruments))

    total = 0
    session, service = start_session()
    try:
        log.info("=== Pull %s -> %s ===", from_date, to_date)
        pts = fetch_historical(session, service, instruments, from_date, to_date)
        drop_weekends(pts)
        total += upsert(sb, pts)
    finally:
        try:
            session.stop(); log.info("Bloomberg session closed.")
        except Exception:
            pass
    log.info("=== historical_pull complete — %s datapoints written ===", total)


if __name__ == "__main__":
    main()
