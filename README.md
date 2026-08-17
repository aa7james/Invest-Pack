# Invest-Pack Dashboard

React (Vite) dashboard for the monthly investment pack. Data is driven by
Bloomberg and bridged through Supabase (Postgres). Everything lives in an
**isolated `pack` schema** — it never touches the existing `public` tables.

## Milestone 1 (this build): data plumbing
- `pack` schema: `instruments`, `pack_data`, `data_update_requests`, `load_log`.
- Dashboard reads instruments + latest values from Supabase.
- "Data last updated" header + summary of what's loaded.
- **Refresh** button queues a Bloomberg pull request (the watcher that fulfils it
  is the next milestone).

Charts / pack layout / PDF export come later.

## Architecture

```
Browser (this app)                Supabase (pack schema)          Bloomberg PC
------------------                ----------------------          ------------
publishable key, RLS-limited  ->  data_update_requests  <-------  watcher (secret key)
reads instruments/pack_data   <-  pack_data             <-------  blpapi pull
```

The browser only ever holds the **publishable** key (safe by design, RLS-limited
to `pack`). The **secret** key lives only on the Bloomberg PC.

## Setup

### 1. Database
In the Supabase SQL Editor, run in order:
1. `supabase/schema.sql` — creates the `pack` schema, tables, views, RLS.
2. `supabase/seed_instruments.sql` — loads the 89 instruments.

Then expose the schema: **Settings → Data API → Exposed schemas → add `pack` → Save.**

### 2. Dashboard (local)
```
npm install
npm run dev
```
The Supabase URL + publishable key are committed in `src/config.js` (both are
public-safe). To override on Vercel, set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` env vars.

### 3. Deploy
Push to `main`; Vercel auto-builds (framework preset: Vite, output `dist`).

## Repo layout
```
src/                 React app
  config.js          Supabase URL + publishable key (public-safe)
  supabaseClient.js  client pinned to the `pack` schema
  lib/               data access + formatting
  components/        UI
supabase/            schema.sql + seed_instruments.sql
watcher/             Bloomberg bridge (next milestone)
```
