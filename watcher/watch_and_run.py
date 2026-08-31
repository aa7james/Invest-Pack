#!/usr/bin/env python3
"""
watch_and_run.py (Invest-Pack) — checks the pack.data_update_requests queue for a
pending "Refresh from Bloomberg" request and, if one exists, runs
historical_pull.py. ONE check per run — fire it every ~1 minute via Windows Task
Scheduler (pythonw.exe, no console window). Credentials via .env (SUPABASE_URL,
SUPABASE_KEY=secret key).
"""
from __future__ import annotations

import logging
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import create_client
from supabase.lib.client_options import ClientOptions

HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(HERE, ".env"))
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
PULL = os.path.join(HERE, "historical_pull.py")

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s  %(levelname)-7s  %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
log = logging.getLogger("watch_and_run")


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("SUPABASE_URL and SUPABASE_KEY must be set in .env"); sys.exit(1)
    sb = create_client(SUPABASE_URL, SUPABASE_KEY, options=ClientOptions(schema="pack"))

    running = (sb.table("data_update_requests").select("id").eq("status", "running").limit(1).execute()).data or []
    if running:
        log.info("A request is already running — skipping."); return

    pending = (sb.table("data_update_requests").select("id")
               .eq("status", "pending").order("requested_at").limit(1).execute()).data or []
    if not pending:
        return

    rid = pending[0]["id"]
    log.info("Pending request #%s — running historical_pull.py ...", rid)
    sb.table("data_update_requests").update({"status": "running", "started_at": datetime.now(timezone.utc).isoformat()}).eq("id", rid).execute()

    result = subprocess.run([sys.executable, PULL], capture_output=True, text=True, timeout=1800)
    tail = ((result.stdout or "") + "\n" + (result.stderr or ""))[-3000:]
    status = "done" if result.returncode == 0 else "error"
    m = re.search(r"(\d+) datapoints written", result.stdout or "")
    rows = int(m.group(1)) if m else None
    log.info("historical_pull.py finished status=%s rows=%s", status, rows)

    sb.table("data_update_requests").update({
        "status": status, "message": tail, "rows_written": rows,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", rid).execute()


if __name__ == "__main__":
    main()
