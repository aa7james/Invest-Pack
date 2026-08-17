-- ============================================================================
-- Chart Builder persistence — run in the Supabase SQL Editor.
-- Stores saved charts, their series, pack membership, annotations, and order.
-- These are view-config tables (no price data), so the browser role may CRUD them.
-- ============================================================================

create table if not exists pack.charts (
  id          bigint generated always as identity primary key,
  title       text not null default 'Untitled chart',
  chart_type  text not null default 'value',   -- 'value' | 'spread'
  time_range  text not null default '1Y',       -- 1M|3M|6M|1Y|2Y|5Y|10Y|ALL
  in_pack     boolean not null default false,
  pack_order  integer not null default 0,
  annotation  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists pack.chart_series (
  id            bigint generated always as identity primary key,
  chart_id      bigint not null references pack.charts(id) on delete cascade,
  instrument_id bigint not null references pack.instruments(id) on delete cascade,
  role          text not null default 'series',  -- 'series' | 'spread_a' | 'spread_b'
  sort_order    integer not null default 0
);
create index if not exists chart_series_chart on pack.chart_series (chart_id);

-- Privileges: browser roles may fully manage chart config (single-user dashboard).
grant select, insert, update, delete on pack.charts, pack.chart_series to anon, authenticated;
grant usage, select on all sequences in schema pack to anon, authenticated;
grant all on pack.charts, pack.chart_series to service_role;

alter table pack.charts        enable row level security;
alter table pack.chart_series  enable row level security;

drop policy if exists p_charts_all on pack.charts;
create policy p_charts_all on pack.charts
  for all to anon, authenticated using (true) with check (true);

drop policy if exists p_chart_series_all on pack.chart_series;
create policy p_chart_series_all on pack.chart_series
  for all to anon, authenticated using (true) with check (true);
