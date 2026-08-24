-- Two manual (broker-sourced) series from the Promar report. Values in $/MT.
-- Manual source => the browser can add/edit their data via the in-app form.
insert into pack.instruments (category, name, bloomberg_ticker, bloomberg_field, currency, is_active, source, unit)
values
  ('Soft Commodities', 'Super Prime Fishmeal Price', null, 'PX_LAST', null, true, 'manual', '$/MT'),
  ('Soft Commodities', 'Fishoil Price (Aquagrade)', null, 'PX_LAST', null, true, 'manual', '$/MT')
on conflict (category, name, coalesce(bloomberg_ticker, ''), coalesce(currency, ''))
do update set source = 'manual', unit = excluded.unit, is_active = true;
