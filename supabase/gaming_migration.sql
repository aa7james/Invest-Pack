-- External (non-Bloomberg) GGR series for the Gambling section, from the SA
-- provincial gambling boards and Macau DICJ. Macau Total Visitors / Hotel
-- Occupancy already exist as Bloomberg series and are reused.
insert into pack.instruments (category, name, bloomberg_ticker, bloomberg_field, currency, is_active, source, unit)
values
  ('Gaming', 'GP Casino',            null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'GP LPM',               null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'GP Bingo',             null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'GP Bookmakers',        null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'WC Casino',            null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'WC LPM',               null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'WC Horse Races',       null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'WC Sports Betting',    null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'KZN Casino',           null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'KZN LPM',              null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'KZN Bingo',            null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'KZN Horse Racing',     null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'KZN Sports Betting',   null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'KZN Contingencies',    null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'EC Casino',            null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'EC Bingo',             null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'EC Horse Racing',      null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'EC LPM',               null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'MPUM Casino',          null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'MPUM Bingo',           null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'MPUM Sports Betting',  null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'MPUM LPM',             null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'National Total GGR',   null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'Macau Monthly GGR',    null, 'PX_LAST', null, true, 'manual', 'MOP m')
on conflict (category, name, coalesce(bloomberg_ticker, ''), coalesce(currency, ''))
do update set source = 'manual', unit = excluded.unit, is_active = true;
