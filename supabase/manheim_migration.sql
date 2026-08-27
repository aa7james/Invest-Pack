-- Manual (external) series for the Manheim / Jan's Garage section. None of these
-- come from Bloomberg (NAAMSA vehicle volumes, Wesbank finance data, Lightstone
-- OEM shares). 'SA New Passenger Vehicle Volumes' already exists.
insert into pack.instruments (category, name, bloomberg_ticker, bloomberg_field, currency, is_active, source, unit)
values
  ('Manheim', 'Cars Sold For Hire',              null, 'PX_LAST', null, true, 'manual', 'units'),
  ('Manheim', 'OEM Share - China',               null, 'PX_LAST', null, true, 'manual', '%'),
  ('Manheim', 'OEM Share - India',               null, 'PX_LAST', null, true, 'manual', '%'),
  ('Manheim', 'OEM Share - Motus',               null, 'PX_LAST', null, true, 'manual', '%'),
  ('Manheim', 'OEM Share - Toyota',              null, 'PX_LAST', null, true, 'manual', '%'),
  ('Manheim', 'OEM Share - Germany',             null, 'PX_LAST', null, true, 'manual', '%'),
  ('Manheim', 'OEM Share - Rest',                null, 'PX_LAST', null, true, 'manual', '%'),
  ('Manheim', 'Wesbank New Car Value Financed',  null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Manheim', 'Wesbank New Car Applications',    null, 'PX_LAST', null, true, 'manual', 'count'),
  ('Manheim', 'Wesbank Used Car Applications',   null, 'PX_LAST', null, true, 'manual', 'count')
on conflict (category, name, coalesce(bloomberg_ticker, ''), coalesce(currency, ''))
do update set source = 'manual', unit = excluded.unit, is_active = true;
