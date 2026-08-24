-- Manual series for the Maize Crop Progress (seasonal) chart. Cumulative SA maize
-- delivered, normalised to million tons. Manual => editable in the app.
insert into pack.instruments (category, name, bloomberg_ticker, bloomberg_field, currency, is_active, source, unit)
values ('Soft Commodities', 'SA Maize Crop Progress', null, 'PX_LAST', null, true, 'manual', 'million tons')
on conflict (category, name, coalesce(bloomberg_ticker, ''), coalesce(currency, ''))
do update set source = 'manual', unit = excluded.unit, is_active = true;
