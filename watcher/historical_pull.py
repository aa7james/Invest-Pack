#!/usr/bin/env python3
"""
historical_pull.py (Invest-Pack) — same architecture as the Fixed Income pull,
adapted to the isolated `pack` schema.

  * Backfills any past gap days via HistoricalDataRequest, then (unless
    --from/--to given) refreshes TODAY via a live ReferenceDataRequest snapshot.
  * Always re-pulls the last 3 days (late/revised fixes). Skips weekends.
  * Writes to pack.pack_data (instrument_id, obs_date, value) — one row per
    instrument per date, so nothing can be clobbered.
  * Currency: each instrument's `currency` (USD/ZAR/None) is applied as a
    Bloomberg currency OVERRIDE (request.set("currency", ...)) — the same thing
    "FX=ZAR" does in the Data Dump. No manual FX maths.

Credentials via .env in this folder (SUPABASE_URL, SUPABASE_KEY=SECRET key).
"""
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
from supabase.lib.client_options import ClientOptions

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
BLP_HOST, BLP_PORT = "localhost", 8194

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s  %(levelname)-7s  %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
log = logging.getLogger("historical_pull")


def sb_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY, options=ClientOptions(schema="pack"))


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
    """Group by (field, currency) so we can apply a currency override per group."""
    g = defaultdict(list)
    for i in instruments:
        g[(i["field"], i["currency"])].append(i)
    return g


def _apply_currency(request, currency):
    if currency:
        request.set("currency", currency)


def fetch_historical(session, service, instruments, from_date, to_date):
    """Returns {(instrument_id, iso_date): value}."""
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
        _apply_currency(request, ccy)
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


def fetch_live_snapshot(session, service, instruments, today_iso):
    """Returns {(instrument_id, today_iso): value}."""
    results = {}
    for (field_name, ccy), group in _groups(instruments).items():
        ticker_to_id = {i["ticker"]: i["id"] for i in group}
        log.info("Live %s [%s] for %s ticker(s) ...", field_name, ccy or "native", len(group))
        request = service.createRequest("ReferenceDataRequest")
        for t in ticker_to_id:
            request.getElement("securities").appendValue(t)
        request.getElement("fields").appendValue(field_name)
        _apply_currency(request, ccy)
        session.sendRequest(request)
        waiting = True
        while waiting:
            event = session.nextEvent(timeout=30000)
            for msg in event:
                if not msg.hasElement("securityData"):
                    continue
                arr = msg.getElement("securityData")
                for i in range(arr.numValues()):
                    sec = arr.getValue(i)
                    ticker = sec.getElementAsString("security")
                    iid = ticker_to_id.get(ticker)
                    if iid is None or sec.hasElement("securityError"):
                        if sec.hasElement("securityError"):
                            log.warning("Bloomberg error for %s (live)", ticker)
                        continue
                    fd = sec.getElement("fieldData")
                    if fd.hasElement(field_name):
                        try:
                            results[(iid, today_iso)] = fd.getElementAsFloat(field_name)
                        except Exception as ex:
                            log.debug("live parse error %s: %s", ticker, ex)
            if event.eventType() in (blpapi.Event.RESPONSE, blpapi.Event.TIMEOUT):
                waiting = False
    log.info("Live snapshot returned %s value(s).", len(results))
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
    explicit = args.from_date is not None or args.to_date is not None
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
    backfill_to = min(to_date, today - timedelta(days=1))
    session, service = start_session()
    try:
        if from_date <= backfill_to:
            log.info("=== Backfill %s -> %s ===", from_date, backfill_to)
            pts = fetch_historical(session, service, instruments, from_date, backfill_to)
            drop_weekends(pts)
            total += upsert(sb, pts)
        else:
            log.info("No past gap days to backfill.")
        if not explicit:
            if today.weekday() >= 5:
                log.info("Weekend — skipping live snapshot.")
            else:
                log.info("=== Live snapshot for %s ===", today)
                live = fetch_live_snapshot(session, service, instruments, today.isoformat())
                total += upsert(sb, live)
    finally:
        try:
            session.stop(); log.info("Bloomberg session closed.")
        except Exception:
            pass
    log.info("=== historical_pull complete — %s datapoints written ===", total)


if __name__ == "__main__":
    main()
