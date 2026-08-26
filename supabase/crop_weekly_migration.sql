-- Maize Crop Progress rebuilt to mirror the SAGIS weekly table:
--   Prod deliveries + Adjustments are the raw weekly inputs (in tons),
--   Week Total = deliveries + adjustments, Prog Total = running cumulative.
-- Two manual (editable) series hold the two input columns.

-- Repurpose the old single series as the weekly "Prod deliveries" input.
update pack.instruments
   set name = 'SA Maize Prod Deliveries', unit = 'tons', source = 'manual', is_active = true
 where name = 'SA Maize Crop Progress';

-- Add the "Adjustments" input series.
insert into pack.instruments (category, name, bloomberg_ticker, bloomberg_field, currency, is_active, source, unit)
values ('Soft Commodities', 'SA Maize Adjustments', null, 'PX_LAST', null, true, 'manual', 'tons')
on conflict (category, name, coalesce(bloomberg_ticker, ''), coalesce(currency, ''))
do update set source = 'manual', unit = excluded.unit, is_active = true;
