-- National GGR broken down by mode, for the stacked-bar National Total GGR chart.
insert into pack.instruments (category, name, bloomberg_ticker, bloomberg_field, currency, is_active, source, unit)
values
  ('Gaming', 'National Casino',  null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'National Bingo',   null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'National LPM',     null, 'PX_LAST', null, true, 'manual', 'R'),
  ('Gaming', 'National Betting', null, 'PX_LAST', null, true, 'manual', 'R')
on conflict (category, name, coalesce(bloomberg_ticker, ''), coalesce(currency, ''))
do update set source = 'manual', unit = excluded.unit, is_active = true;
