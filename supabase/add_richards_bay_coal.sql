-- Richards Bay thermal coal + rename existing to Newcastle.
-- Run ONCE in the Supabase SQL editor (project knciqlbngtmsgmhnbfce).
-- The frontend key can't create instruments by design, so this needs the
-- SQL editor (which runs with full rights).

-- 1) Rename the existing contract (XW1 = Newcastle) — chart title + series label.
update pack.charts      set title = 'Newcastle Thermal Coal', updated_at = now() where id = 126;
update pack.instruments set name  = 'Newcastle Thermal Coal'                      where id = 27;

-- 2) Add Richards Bay (XOA) as a new instrument + a new chart directly under
--    Newcastle (pack_order 24 ties with Newcastle, so it sorts right after it),
--    and link the chart to the instrument.
with new_inst as (
  insert into pack.instruments (category, name, bloomberg_ticker, bloomberg_field, currency, is_active, source)
  values ('Energy', 'Richards Bay Thermal Coal', 'XOA Comdty', 'PX_LAST', 'USD', true, 'bloomberg')
  returning id
),
new_chart as (
  insert into pack.charts (title, chart_type, time_range, in_pack, pack_order)
  values ('Richards Bay Thermal Coal', 'value', 'ALL', true, 24)
  returning id
)
insert into pack.chart_series (chart_id, instrument_id, role, sort_order)
select new_chart.id, new_inst.id, 'series', 0
from new_chart, new_inst;

-- 3) Queue a Bloomberg backfill so XOA pulls its full history (the watcher on the
--    Bloomberg PC does the actual pull). Without this the new chart is empty.
insert into pack.data_update_requests (status, mode) values ('pending', 'backfill');
