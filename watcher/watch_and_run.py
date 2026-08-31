"""
Bloomberg watcher. Runs on the Bloomberg PC. Every few seconds it checks Supabase
for a pending "Refresh from Bloomberg" request (created by the dashboard button).
When it finds one it:
  1) opens the Data Dump Excel and refreshes it from Bloomberg (BDH recalc),
  2) uploads only the new/changed datapoints to Supabase (incremental sync),
  3) marks the request done — the dashboard's "Data last updated" then advances.

Start it with "START DATA WATCHER.bat" and leave the window open.
"""
import os
import sys
import time
import datetime
import urllib.request
import urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import sync_history as SH  # reuse load_env / api / sync

POLL_SECONDS = 15
# Seconds to wait after triggering a Bloomberg recalc for BDH values to return.
BBG_WAIT = int(os.environ.get("BBG_WAIT", "90"))
# Set REFRESH_EXCEL=0 to skip the Bloomberg refresh and just sync the saved file.
DO_REFRESH = os.environ.get("REFRESH_EXCEL", "1") != "0"


def now_iso():
    return datetime.datetime.now().astimezone().isoformat()


def log(msg):
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def refresh_excel(path):
    """Open the workbook in Excel, force a Bloomberg recalc, save and close."""
    try:
        import win32com.client  # pywin32
    except ImportError:
        log("  (pywin32 not installed — skipping Bloomberg refresh, syncing saved file)")
        return False
    xl = None
    try:
        log("  opening Excel + refreshing from Bloomberg...")
        xl = win32com.client.DispatchEx("Excel.Application")
        xl.Visible = False
        xl.DisplayAlerts = False
        wb = xl.Workbooks.Open(os.path.abspath(path), UpdateLinks=0)
        try:
            wb.RefreshAll()
        except Exception:
            pass
        xl.CalculateFullRebuild()
        log(f"  waiting {BBG_WAIT}s for Bloomberg data to return...")
        time.sleep(BBG_WAIT)
        xl.CalculateUntilAsyncQueriesDone()
        wb.Save()
        wb.Close(SaveChanges=True)
        log("  Excel refreshed + saved.")
        return True
    except Exception as e:
        log(f"  Excel refresh failed ({e}); syncing the saved file instead.")
        return False
    finally:
        try:
            if xl is not None:
                xl.Quit()
        except Exception:
            pass


def patch_request(url, key, rid, body):
    SH.api("PATCH", url, key, f"/rest/v1/data_update_requests?id=eq.{rid}",
           body=body, extra={"Prefer": "return=minimal"})


def process_one(url, key, excel, req):
    rid = req["id"]
    log(f"Request #{rid} ({req.get('mode', 'snapshot')}) — starting.")
    patch_request(url, key, rid, {"status": "processing", "started_at": now_iso()})
    try:
        if DO_REFRESH:
            refresh_excel(excel)
        count = SH.sync(url, key, excel, log=lambda m: log("    " + m)) or 0
        patch_request(url, key, rid, {
            "status": "done", "completed_at": now_iso(), "rows_written": count,
            "message": f"Synced {count} datapoints",
        })
        log(f"Request #{rid} DONE — {count} datapoints updated.\n")
    except Exception as e:
        patch_request(url, key, rid, {
            "status": "error", "completed_at": now_iso(), "message": str(e)[:400],
        })
        log(f"Request #{rid} ERROR: {e}\n")


def main():
    url, key, excel = SH.load_env()
    log("Watcher running. Waiting for 'Refresh from Bloomberg' clicks...")
    log(f"  Excel: {excel}")
    log(f"  Bloomberg refresh: {'ON' if DO_REFRESH else 'OFF'} (wait {BBG_WAIT}s)\n")
    while True:
        try:
            pending = SH.api("GET", url, key,
                             "/rest/v1/data_update_requests?status=eq.pending&order=requested_at.asc&limit=1")
            if pending:
                process_one(url, key, excel, pending[0])
            else:
                time.sleep(POLL_SECONDS)
        except KeyboardInterrupt:
            log("Stopped."); break
        except Exception as e:
            log(f"poll error: {e}")
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
