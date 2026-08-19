-- Electricity Consumed (SA) — manual/external series (StatsSA P4141).
-- Adds source columns + the manual instrument, and RLS so the browser (public key)
-- may write ONLY to manual series. Bloomberg data stays read-only.

alter table pack.instruments add column if not exists source text not null default 'bloomberg';
alter table pack.instruments add column if not exists source_url text;
alter table pack.instruments add column if not exists unit text;

grant insert, update on pack.pack_data to anon, authenticated;

drop policy if exists p_manual_insert_data on pack.pack_data;
create policy p_manual_insert_data on pack.pack_data for insert to anon, authenticated
  with check (instrument_id in (select id from pack.instruments where source = 'manual'));

drop policy if exists p_manual_update_data on pack.pack_data;
create policy p_manual_update_data on pack.pack_data for update to anon, authenticated
  using (instrument_id in (select id from pack.instruments where source = 'manual'))
  with check (instrument_id in (select id from pack.instruments where source = 'manual'));

insert into pack.instruments (category, name, bloomberg_ticker, bloomberg_field, currency, is_active, source, source_url, unit)
values ('Energy', 'Electricity Consumed (SA)', null, 'PX_LAST', null, true, 'manual',
        'http://www.statssa.gov.za/?page_id=1854&PPN=P4141', 'GWh')
on conflict (category, name, coalesce(bloomberg_ticker, ''), coalesce(currency, ''))
do update set source = 'manual', source_url = excluded.source_url, unit = excluded.unit, is_active = true;
