-- Electricity Consumed (SA) — manual/external series (StatsSA P4141).
-- One paste sets up the structure; Claude loads the 317 history points afterward.

-- 1. Columns for manual/external series.
alter table pack.instruments add column if not exists source text not null default 'bloomberg';
alter table pack.instruments add column if not exists source_url text;
alter table pack.instruments add column if not exists unit text;

-- 2. Let the public key write ONLY to manual series (Bloomberg stays read-only).
grant insert, update on pack.pack_data to anon, authenticated;

drop policy if exists p_manual_insert_data on pack.pack_data;
create policy p_manual_insert_data on pack.pack_data for insert to anon, authenticated
  with check (instrument_id in (select id from pack.instruments where source = 'manual'));

drop policy if exists p_manual_update_data on pack.pack_data;
create policy p_manual_update_data on pack.pack_data for update to anon, authenticated
  using (instrument_id in (select id from pack.instruments where source = 'manual'))
  with check (instrument_id in (select id from pack.instruments where source = 'manual'));

-- 3. The instrument.
insert into pack.instruments (category, name, bloomberg_ticker, bloomberg_field, currency, is_active, source, source_url, unit)
values ('Energy', 'Electricity Consumed (SA)', null, 'PX_LAST', null, true, 'manual',
        'http://www.statssa.gov.za/?page_id=1854&PPN=P4141', 'GWh')
on conflict (category, name, coalesce(bloomberg_ticker, ''), coalesce(currency, ''))
do update set source = 'manual', source_url = excluded.source_url, unit = excluded.unit, is_active = true;

-- 4. The chart, added to the pack.
do $$
declare eid bigint; declare cid bigint;
begin
  select id into eid from pack.instruments where name = 'Electricity Consumed (SA)' and source = 'manual';
  delete from pack.charts where title = 'Electricity consumed in South Africa';
  insert into pack.charts (title, chart_type, time_range, in_pack, pack_order, annotation)
  values ('Electricity consumed in South Africa', 'value', 'ALL', true,
          (select coalesce(max(pack_order), 0) + 1 from pack.charts),
          'Source: StatsSA — electricity available for distribution (GWh). Use the link on this chart to fetch new months.')
  returning id into cid;
  insert into pack.chart_series (chart_id, instrument_id, role, sort_order) values (cid, eid, 'series', 0);
end $$;
