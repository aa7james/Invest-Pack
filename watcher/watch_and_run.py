"""
Invest-Pack data watcher (same idea as the Fixed Income dashboard).
Runs quietly on the Bloomberg PC and keeps Supabase in sync:

  * File watch  — whenever "Data Dump - HP.xlsx" is saved (after you refresh it
                  from Bloomberg), it uploads only the new/changed numbers.
  * Button      — clicking "Refresh from Bloomberg" in the dashboard also makes
                  it sync right away, then marks the request done.

No Excel automation, so nothing fragile. Just refresh the Bloomberg workbook and
save it — the dashboard updates within a minute.

Start with "START DATA WATCHER.bat" (once), or add it to Windows startup with
"ADD TO STARTUP.bat" so it always runs when you log in.
"""
import os
import sys
import time
import datetime
import urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import sync_history as SH  # reuse load_env / api / sync

CHECK_INTERVAL = 20  # seconds between checks


def log(msg):
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def now_iso():
    return datetime.datetime.now().astimezone().isoformat()


def file_sig(path):
    try:
        st = os.stat(path)
        return (st.st_mtime, st.st_size)
    except OSError:
        return None


def do_sync(url, key, excel, reason):
    log(f"Syncing ({reason})...")
    try:
        count = SH.sync(url, key, excel, log=lambda m: log("   " + m)) or 0
        log(f"Done — {count} datapoints updated.\n")
        return count, None
    except Exception as e:
        log(f"Sync failed: {e}\n")
        return 0, str(e)


def handle_button(url, key, excel):
    """If the dashboard button queued a request, process it and mark it done."""
    try:
        pending = SH.api("GET", url, key,
                         "/rest/v1/data_update_requests?status=eq.pending&order=requested_at.asc&limit=1")
    except Exception as e:
        log(f"(queue check failed: {e})")
        return
    if not pending:
        return
    req = pending[0]
    rid = req["id"]
    log(f"'Refresh from Bloomberg' clicked (request #{rid}).")
    SH.api("PATCH", url, key, f"/rest/v1/data_update_requests?id=eq.{rid}",
           body={"status": "processing", "started_at": now_iso()}, extra={"Prefer": "return=minimal"})
    count, err = do_sync(url, key, excel, f"button #{rid}")
    SH.api("PATCH", url, key, f"/rest/v1/data_update_requests?id=eq.{rid}",
           body=({"status": "error", "completed_at": now_iso(), "message": err[:400]} if err else
                 {"status": "done", "completed_at": now_iso(), "rows_written": count,
                  "message": f"Synced {count} datapoints"}),
           extra={"Prefer": "return=minimal"})


def main():
    url, key, excel = SH.load_env()
    log("Invest-Pack watcher running. Leave this window open.")
    log(f"  Watching: {excel}")
    log("  It syncs when you save the Excel, or click 'Refresh from Bloomberg'.\n")

    # Initial sync on startup, then remember the file signature.
    do_sync(url, key, excel, "startup")
    last_sig = file_sig(excel)

    while True:
        try:
            time.sleep(CHECK_INTERVAL)
            handle_button(url, key, excel)
            sig = file_sig(excel)
            if sig and sig != last_sig:
                last_sig = sig
                do_sync(url, key, excel, "Excel saved")
        except KeyboardInterrupt:
            log("Stopped."); break
        except Exception as e:
            log(f"error: {e}")
            time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()
