# Bloomberg watcher (runs on the Terminal PC)

This folder will hold the bridge that connects Supabase to the Bloomberg Terminal.
It is **not built yet** — it's the next milestone, and we'll adapt it from your
existing `watch_and_run.py` + `historical_pull.py`.

## Planned pieces

- **`watch_and_run.py`** — runs every ~1 min via Windows Task Scheduler. Polls
  `pack.data_update_requests` for a `pending` row; if found, marks it `processing`,
  runs the pull, then marks it `done` (or `error`).
- **`pull.py`** — reads active instruments from `pack.instruments`, fetches from
  Bloomberg (`ReferenceDataRequest` for today's snapshot, `HistoricalDataRequest`
  for backfill), applies each instrument's **currency override**, skips weekends,
  and **merges** results into `pack.pack_data` keyed by `(instrument_id, obs_date)`
  so other instruments on the same date are never disturbed.

## Secret key

The watcher authenticates to Supabase with the **secret key**, which lives only in
a local `.env` here (copy `.env.example` → `.env` and paste the key). `.env` is
git-ignored. The secret key must never appear in the dashboard or in this repo.
