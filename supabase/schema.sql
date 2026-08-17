-- =============================================================================
-- Invest-Pack schema  (run this in the Supabase SQL Editor)
--
-- Everything lives in an isolated `pack` schema. It never touches your existing
-- `public` tables (bond_data, instruments, etc.).
--
-- AFTER running this file you MUST expose the schema to the Data API:
--   Supabase Dashboard -> Settings -> Data API -> "Exposed schemas"
--   -> add `pack` -> Save.
-- (Without that step the dashboard's REST calls will fail.)
-- =============================================================================

create schema if not exists pack;

-- -----------------------------------------------------------------------------
-- 1. Instruments: one row per thing we pull from Bloomberg.
--    currency is a first-class field (it drives the Bloomberg currency override).
-- -----------------------------------------------------------------------------
create table if not exists pack.instruments (
  id               bigint generated always as identity primary key,
  category         text    not null,
  name             text    not null,
  bloomberg_ticker text,                       -- null = computed/derived, not pulled
  bloomberg_field  text    not null default 'PX_LAST',
  currency         text,                        -- 'ZAR', 'USD', ... or null for counts/indices
  display_label    text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- De-duplication key for re-running the seed. Uses coalesce so null ticker /
-- null currency rows still compare cleanly.
create unique index if not exists instruments_natural_key
  on pack.instruments (category, name, coalesce(bloomberg_ticker,''), coalesce(currency,''));

-- -----------------------------------------------------------------------------
-- 2. Data: one row per (instrument, date). This is the merge/idempotency key —
--    re-pulling a date updates it in place; new dates append; other instruments
--    on the same date are never disturbed.
-- -----------------------------------------------------------------------------
create table if not exists pack.pack_data (
  id            bigint generated always as identity primary key,
  instrument_id bigint not null references pack.instruments(id) on delete cascade,
  obs_date      date    not null,
  value         double precision,
  updated_at    timestamptz not null default now(),
  unique (instrument_id, obs_date)
);

create index if not exists pack_data_instrument_date
  on pack.pack_data (instrument_id, obs_date desc);

-- -----------------------------------------------------------------------------
-- 3. Request queue: the dashboard's Refresh button inserts a 'pending' row.
--    The watcher on the Bloomberg PC picks it up, does the pull, marks it done.
-- -----------------------------------------------------------------------------
create table if not exists pack.data_update_requests (
  id            bigint generated always as identity primary key,
  status        text not null default 'pending',   -- pending | processing | done | error
  mode          text not null default 'snapshot',  -- snapshot (today) | backfill (history)
  requested_at  timestamptz not null default now(),
  started_at    timestamptz,
  completed_at  timestamptz,
  rows_written  integer,
  message       text
);

create index if not exists requests_pending
  on pack.data_update_requests (requested_at desc)
  where status = 'pending';

-- -----------------------------------------------------------------------------
-- 4. Load log: a short history of completed loads (powers the header summary).
-- -----------------------------------------------------------------------------
create table if not exists pack.load_log (
  id                  bigint generated always as identity primary key,
  ran_at              timestamptz not null default now(),
  instruments_updated integer,
  rows_written        integer,
  date_min            date,
  date_max            date,
  note                text
);

-- -----------------------------------------------------------------------------
-- Convenience views for the dashboard.
-- -----------------------------------------------------------------------------

-- Latest stored value per instrument.
create or replace view pack.v_latest_values
with (security_invoker = true) as
select distinct on (instrument_id)
  instrument_id, obs_date, value, updated_at
from pack.pack_data
order by instrument_id, obs_date desc;

-- One-row summary for the "Data last updated" header.
create or replace view pack.v_data_summary
with (security_invoker = true) as
select
  (select count(*) from pack.instruments where is_active)  as active_instruments,
  (select count(*) from pack.instruments)                  as total_instruments,
  (select count(*) from pack.pack_data)                    as total_rows,
  (select min(obs_date) from pack.pack_data)               as date_min,
  (select max(obs_date) from pack.pack_data)               as date_max,
  (select max(updated_at) from pack.pack_data)             as last_updated;

-- =============================================================================
-- Row-Level Security
--
-- The publishable (anon) key gets: read everything in `pack`, and insert a
-- 'pending' refresh request. Nothing else. It CANNOT modify data.
-- The watcher uses the SECRET key, which bypasses RLS entirely, so it can
-- write pack_data and update requests.
-- =============================================================================

-- Schema + object privileges for the browser role(s).
grant usage on schema pack to anon, authenticated;
grant select on all tables in schema pack to anon, authenticated;
grant insert on pack.data_update_requests to anon, authenticated;
grant usage, select on all sequences in schema pack to anon, authenticated;

alter table pack.instruments           enable row level security;
alter table pack.pack_data             enable row level security;
alter table pack.data_update_requests  enable row level security;
alter table pack.load_log              enable row level security;

drop policy if exists p_read_instruments on pack.instruments;
create policy p_read_instruments on pack.instruments
  for select to anon, authenticated using (true);

drop policy if exists p_read_data on pack.pack_data;
create policy p_read_data on pack.pack_data
  for select to anon, authenticated using (true);

drop policy if exists p_read_log on pack.load_log;
create policy p_read_log on pack.load_log
  for select to anon, authenticated using (true);

drop policy if exists p_read_requests on pack.data_update_requests;
create policy p_read_requests on pack.data_update_requests
  for select to anon, authenticated using (true);

-- Dashboard may only queue a fresh 'pending' request; it cannot flip statuses.
drop policy if exists p_insert_requests on pack.data_update_requests;
create policy p_insert_requests on pack.data_update_requests
  for insert to anon, authenticated
  with check (status = 'pending');
