-- Raw inputs so the app can BUILD the calculations (not store computed results):
--  * OEM market share  = each group's brand-unit sum / total (computed in app)
--  * Cars sold for hire = % sold for hire * total cars, then 12-month rolling
insert into pack.instruments (category, name, bloomberg_ticker, bloomberg_field, currency, is_active, source, unit)
values
  ('Manheim', 'OEM: Toyota',           null, 'PX_LAST', null, true, 'manual', 'units'),
  ('Manheim', 'OEM: Suzuki',           null, 'PX_LAST', null, true, 'manual', 'units'),
  ('Manheim', 'OEM: VW',               null, 'PX_LAST', null, true, 'manual', 'units'),
  ('Manheim', 'OEM: Hyundai',          null, 'PX_LAST', null, true, 'manual', 'units'),
  ('Manheim', 'OEM: Ford',             null, 'PX_LAST', null, true, 'manual', 'units'),
  ('Manheim', 'OEM: GWM/haval',        null, 'PX_LAST', null, true, 'manual', 'units'),
  ('Manheim', 'OEM: Chery',            null, 'PX_LAST', null, true, 'manual', 'units'),
  ('Manheim', 'OEM: Isuzu',            null, 'PX_LAST', null, true, 'manual', 'units'),
  ('Manheim', 'OEM: Kia',              null, 'PX_LAST', null, true, 'manual', 'units'),
  ('Manheim', 'OEM: Jetour',           null, 'PX_LAST', null, true, 'manual', 'units'),
  ('Manheim', 'OEM: Omoda and Jaecoo', null, 'PX_LAST', null, true, 'manual', 'units'),
  ('Manheim', 'OEM: Renault',          null, 'PX_LAST', null, true, 'manual', 'units'),
  ('Manheim', 'OEM: Mahindra',         null, 'PX_LAST', null, true, 'manual', 'units'),
  ('Manheim', 'OEM: BMW',              null, 'PX_LAST', null, true, 'manual', 'units'),
  ('Manheim', 'OEM: BYD',              null, 'PX_LAST', null, true, 'manual', 'units'),
  ('Manheim', 'OEM: Nissan',           null, 'PX_LAST', null, true, 'manual', 'units'),
  ('Manheim', '% Cars Sold For Hire',  null, 'PX_LAST', null, true, 'manual', 'fraction'),
  ('Manheim', 'Total Cars Sold',       null, 'PX_LAST', null, true, 'manual', 'units')
on conflict (category, name, coalesce(bloomberg_ticker, ''), coalesce(currency, ''))
do update set source = 'manual', unit = excluded.unit, is_active = true;
