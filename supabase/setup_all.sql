-- ============================================================================
-- Invest-Pack ONE-SHOT SETUP  —  paste this whole file into the Supabase
-- SQL Editor and click RUN.  It creates the isolated 'pack' schema, all tables,
-- security rules, and loads the 89 instruments.  Safe to re-run.
-- ============================================================================

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


-- Auto-generated from Data Dump - HP.xlsx  (89 instruments)
-- bloomberg_field uses the Bloomberg API mnemonic (row 7), e.g. PX_LAST.
truncate table pack.instruments restart identity cascade;
insert into pack.instruments (category, name, bloomberg_ticker, bloomberg_field, currency, is_active) values
  ('Chemicals', 'PolyPropylene USD', 'MERSPPF3 Index', 'PX_LAST', 'USD', true),
  ('Chemicals', 'LDPE USD', 'MERSETL1 Index', 'PX_LAST', 'USD', true),
  ('Chemicals', 'LLDPE USD', 'MERSELL1 Index', 'PX_LAST', 'USD', true),
  ('Chemicals', 'HDPE USD', 'MERSETH2 Index', 'PX_LAST', 'USD', true),
  ('Chemicals', 'PH USD', 'MERSPPF2 Index', 'PX_LAST', 'USD', true),
  ('Chemicals', 'PolyPropylene ZAR', 'MERSPPF3 Index', 'PX_LAST', 'ZAR', true),
  ('Chemicals', 'LDPE ZAR', 'MERSETL1 Index', 'PX_LAST', 'ZAR', true),
  ('Chemicals', 'LLDPE ZAR', 'MERSELL1 Index', 'PX_LAST', 'ZAR', true),
  ('Chemicals', 'HDPE ZAR', 'MERSETH2 Index', 'PX_LAST', 'ZAR', true),
  ('Chemicals', 'PH ZAR', 'MERSPPF2 Index', 'PX_LAST', 'ZAR', true),
  ('Chemicals', 'Urea Black Sea Spot ZAR', 'GCFPURBS Index', 'PX_LAST', 'ZAR', true),
  ('Chemicals', 'Ammonia Caribbean Spot ZAR', 'GCFPAMCB Index', 'PX_LAST', 'ZAR', true),
  ('Chemicals', 'Urea Black Sea Spot USD', 'GCFPURBS Index', 'PX_LAST', 'USD', true),
  ('Chemicals', 'Ammonia Caribbean Spot USD', 'GCFPAMCB Index', 'PX_LAST', 'USD', true),
  ('Chemicals', 'Urea Price', null, 'PX_LAST', null, false),
  ('Chemicals', 'Moving average', null, 'PX_LAST', null, false),
  ('Chemicals', 'Ukraine Ammonium Nitrate Fertilizer USD', 'FEMTUAAD AGRO Index', 'PX_LAST', 'USD', true),
  ('Chemicals', 'Black Sea Ammonium Nitrate Fertilizer USD', 'GCFPNTBS Index', 'PX_LAST', 'USD', true),
  ('Chemicals', 'Germany Calcium Ammonium Nitrate Fertilizer USD', 'GCFPCADE Index', 'PX_LAST', 'USD', true),
  ('Chemicals', 'Ukraine Ammonium Nitrate Fertilizer ZAR', 'FEMTUAAD AGRO Index', 'PX_LAST', 'ZAR', true),
  ('Chemicals', 'Black Sea Ammonium Nitrate Fertilizer ZAR', 'GCFPNTBS Index', 'PX_LAST', 'ZAR', true),
  ('Chemicals', 'Germany Calcium Ammonium Nitrate Fertilizer ZAR', 'GCFPCADE Index', 'PX_LAST', 'ZAR', true),
  ('Energy', 'SA ELECTRICITY PRICE INDEX', 'SCP8ELEC Index', 'PX_LAST', null, true),
  ('Energy', 'Brent Crude Oil', 'CO1 Comdty', 'PX_LAST', 'USD', true),
  ('Energy', 'Natural Gas (Henry Hub)', 'NGA Comdty', 'PX_LAST', 'USD', true),
  ('Energy', 'EU Carbon Prices', 'MO1 Comdty', 'PX_LAST', 'USD', true),
  ('Energy', 'Thermal Coal', 'XW1 Comdty', 'PX_LAST', 'USD', true),
  ('Energy', 'Total World Oil & Gas Rig Count', 'BAKMWRLD Index', 'PX_LAST', null, true),
  ('Energy', 'US Oil & Gas Rig Count', 'BAKETOT Index', 'PX_LAST', null, true),
  ('Energy', 'Liquified Natural Gas (Tokyo)', 'JGL1 Comdty', 'PX_LAST', 'USD', true),
  ('Energy', 'Natural Gas (Dutch)', 'TZT1 Comdty', 'PX_LAST', 'USD', true),
  ('Energy', 'Uranium', 'UXA1 Comdty', 'PX_LAST', 'USD', true),
  ('Metals', 'Aluminium', 'LMAHDY Comdty', 'PX_LAST', 'USD', true),
  ('Metals', 'Copper', 'LMCADY Comdty', 'PX_LAST', 'USD', true),
  ('Metals', 'Lead', 'LMPBDY Comdty', 'PX_LAST', 'USD', true),
  ('Metals', 'Nickel', 'LMNIDY Comdty', 'PX_LAST', 'USD', true),
  ('Metals', 'Zinc', 'LMZSDY Comdty', 'PX_LAST', 'USD', true),
  ('Metals', 'Gold', 'XAU CMPL Curncy', 'PX_LAST', 'USD', true),
  ('Metals', 'PGM Price', '.ZARPGM U Index', 'PX_LAST', 'USD', true),
  ('Metals', 'Platinum', 'XPT Curncy', 'PX_LAST', 'USD', true),
  ('Metals', 'Palladium', 'XPD Curncy', 'PX_LAST', 'USD', true),
  ('Metals', 'Rhodium', 'JMATRHOD Index', 'PX_LAST', 'USD', true),
  ('Metals', 'Iron Ore 62%', 'ISIX62IU Index', 'PX_LAST', 'USD', true),
  ('Metals', 'Iron Ore Lump', 'ISIX62LU Index', 'PX_LAST', 'USD', true),
  ('Metals', 'Hard Coking Coal', 'HARDCOAL Index', 'PX_LAST', 'USD', true),
  ('Metals', 'Mangenese', 'MAZAUGTL Index', 'PX_LAST', 'USD', true),
  ('Metals', 'Commodity Producers Capex', 'MXWDCOMP Index', 'TRAIL_12M_CAP_EXPEND', 'USD', true),
  ('Metals', 'Platinum 1 month Forward', '.XPTLEA1M G Index', 'PX_LAST', 'ZAR', true),
  ('Metals', 'Platinum 3 month Forward', '.XPTLEAS3 G Index', 'PX_LAST', 'USD', true),
  ('Metals', 'Platinum 6 month Forward', '.XPTLEAS6 G Index', 'PX_LAST', 'USD', true),
  ('Metals', 'Platinum 12 month Forward', '.XPTLEA12 G Index', 'PX_LAST', 'USD', true),
  ('Metals', 'Platinum  - NYMEX inventory', 'NYMXTTOL Index', 'PX_LAST', 'USD', true),
  ('Metals', 'Palladium  - NYMEX inventory', 'NYMXTTOA Index', 'PX_LAST', 'USD', true),
  ('Metals', 'Platinum price North America', 'JMATPLNA Index', 'PX_LAST', 'USD', true),
  ('Metals', 'Platinum price Europe', 'JMATPLEU Index', 'PX_LAST', 'USD', true),
  ('Metals', 'Platinum ETF Holdings', 'ETFPPLTO Index', 'PX_LAST', 'USD', true),
  ('Metals', 'Palladium ETF Holdings', 'ETFPPDTO Index', 'PX_LAST', 'USD', true),
  ('Metals', 'Rhodium ETF Holdings (Proxy)', 'DBRHODM Index', 'PX_LAST', 'USD', true),
  ('Metals', 'Impala Platinum', 'IMP SJ Equity', 'PX_LAST', 'ZAR', true),
  ('Metals', 'Sibanye Siltwater', 'SSW SJ Equity', 'PX_LAST', 'ZAR', true),
  ('Metals', 'Northam Platinum', 'NPH SJ Equity', 'PX_LAST', 'ZAR', true),
  ('Metals', 'Valterra Platinum', 'VAL SJ Equity', 'PX_LAST', 'ZAR', true),
  ('Soft Commodities', 'Local Wheat Price', 'EB1 Comdty', 'PX_LAST', 'ZAR', true),
  ('Soft Commodities', 'Generic Yellow Maize Futures', 'YW1 Comdty', 'PX_LAST', 'ZAR', true),
  ('Soft Commodities', 'Export Parity Maize', 'SSPPCERE Index', 'PX_LAST', 'ZAR', true),
  ('Soft Commodities', 'Import Parity Maize', 'SSPPC3DP Index', 'PX_LAST', 'ZAR', true),
  ('Soft Commodities', 'Generic Yellow Maize Futures', 'YW1 Comdty', 'PX_LAST', 'USD', true),
  ('Soft Commodities', 'CBOT Corn', 'C 1 Comdty', 'PX_LAST', null, true),
  ('Soft Commodities', 'Corn', 'C A Comdty', 'PX_LAST', 'ZAR', true),
  ('Soft Commodities', 'Soybean', 'S 1 Comdty', 'PX_LAST', 'ZAR', true),
  ('Soft Commodities', 'CBOT Soybean', 'S 1 Comdty', 'PX_LAST', 'USD', true),
  ('Soft Commodities', 'Wheat', 'W A Comdty', 'PX_LAST', 'ZAR', true),
  ('Soft Commodities', 'CBOT Wheat', 'W 1 Comdty', 'PX_LAST', 'USD', true),
  ('Soft Commodities', 'ICE Sugar', 'SB1 Comdty', 'PX_LAST', null, true),
  ('Soft Commodities', 'ICE Coffee', 'KC1 Comdty', 'PX_LAST', null, true),
  ('Soft Commodities', 'ICE Cocoa', 'CC1 Comdty', 'PX_LAST', null, true),
  ('Soft Commodities', 'Peru Fishmeal', 'PRPEFMLP Index', 'PX_LAST', null, true),
  ('Soft Commodities', 'Milk', 'NWMPGDT Index', 'PX_LAST', 'USD', true),
  ('Soft Commodities', 'World Tea Price', 'WRCOTEAM Index', 'PX_LAST', 'USD', true),
  ('Soft Commodities', 'Palm Oil', 'K01 Comdty', 'PX_LAST', 'USD', true),
  ('Chicken', 'Generic 1st ''Yellow Wheat'' Future', 'YW1 Comdty', 'PX_LAST', null, true),
  ('Chicken', 'Soybean', 'SY1 Comdty', 'PX_LAST', null, true),
  ('Chicken', 'Soybean', 'SSPPSBID Index', 'PX_LAST', null, true),
  ('Chicken', 'ARL Share Price', 'ARL SJ Equity', 'PX_LAST', null, true),
  ('Gaming', 'Macau Total Visitors', 'MOVATTL Index', 'PX_LAST', null, true),
  ('Gaming', 'Macau Chinese Visitors', 'MOVACN Index', 'PX_LAST', null, true),
  ('Gaming', 'Macau Hotel Occupancy Rates', 'MOHOTELR Index', 'PX_LAST', null, true),
  ('Manheim', 'SA New Passenger Vehicle Volumes', null, 'PX_LAST', null, false),
  ('Manheim', 'US Auto Sales Total - New Vehicles (Millions)', 'SAARTOTL Index', 'PX_LAST', null, true);
