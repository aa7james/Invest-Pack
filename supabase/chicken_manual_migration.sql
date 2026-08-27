-- Manual (editable) series for the Chicken Dashboard charts that don't come from
-- Bloomberg (FNB protein prices, SAPA chicken/IQF prices, the Aylett proxy feed).
-- You enter these in the app (like the fishmeal series); they store in Supabase.
insert into pack.instruments (category, name, bloomberg_ticker, bloomberg_field, currency, is_active, source, unit)
values
  ('Chicken', 'Beef Price',            null, 'PX_LAST', null, true, 'manual', 'R/ton'),
  ('Chicken', 'Mutton Price',          null, 'PX_LAST', null, true, 'manual', 'R/ton'),
  ('Chicken', 'Pork Price',            null, 'PX_LAST', null, true, 'manual', 'R/ton'),
  ('Chicken', 'Poultry Price',         null, 'PX_LAST', null, true, 'manual', 'R/ton'),
  ('Chicken', 'Poultry Import Parity', null, 'PX_LAST', null, true, 'manual', 'R/ton'),
  ('Chicken', 'Chicken Price',         null, 'PX_LAST', null, true, 'manual', 'c/kg'),
  ('Chicken', 'Proxy Feed Price',      null, 'PX_LAST', null, true, 'manual', 'R/ton'),
  ('Chicken', 'IQF Price',             null, 'PX_LAST', null, true, 'manual', 'c/kg')
on conflict (category, name, coalesce(bloomberg_ticker, ''), coalesce(currency, ''))
do update set source = 'manual', unit = excluded.unit, is_active = true;
