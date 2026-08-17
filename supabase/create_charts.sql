-- Auto-generated: recreates the investment pack charts from Bloomberg-driven data.
-- Self-contained: creates the chart tables if needed, then rebuilds the pack.
-- NOTE: this RESETS all saved charts and rebuilds the pack.

create table if not exists pack.charts (
  id bigint generated always as identity primary key,
  title text not null default 'Untitled chart',
  chart_type text not null default 'value',
  time_range text not null default '1Y',
  in_pack boolean not null default false,
  pack_order integer not null default 0,
  annotation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists pack.chart_series (
  id bigint generated always as identity primary key,
  chart_id bigint not null references pack.charts(id) on delete cascade,
  instrument_id bigint not null references pack.instruments(id) on delete cascade,
  role text not null default 'series',
  sort_order integer not null default 0
);
create index if not exists chart_series_chart on pack.chart_series (chart_id);
grant select, insert, update, delete on pack.charts, pack.chart_series to anon, authenticated;
grant usage, select on all sequences in schema pack to anon, authenticated;
grant all on pack.charts, pack.chart_series to service_role;
alter table pack.charts enable row level security;
alter table pack.chart_series enable row level security;
drop policy if exists p_charts_all on pack.charts;
create policy p_charts_all on pack.charts for all to anon, authenticated using (true) with check (true);
drop policy if exists p_chart_series_all on pack.chart_series;
create policy p_chart_series_all on pack.chart_series for all to anon, authenticated using (true) with check (true);

truncate table pack.charts restart identity cascade;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Polymers ZAR','value','ALL',true,1,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('PolyPropylene ZAR','ZAR','series',0),
    ('LDPE ZAR','ZAR','series',1),
    ('LLDPE ZAR','ZAR','series',2),
    ('HDPE ZAR','ZAR','series',3),
    ('PH ZAR','ZAR','series',4)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Polymers USD','value','ALL',true,2,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('PolyPropylene USD','USD','series',0),
    ('LDPE USD','USD','series',1),
    ('LLDPE USD','USD','series',2),
    ('HDPE USD','USD','series',3),
    ('PH USD','USD','series',4)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Fertiliser Prices ZAR','value','ALL',true,3,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Urea Black Sea Spot ZAR','ZAR','series',0),
    ('Ammonia Caribbean Spot ZAR','ZAR','series',1)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Fertiliser Prices USD','value','ALL',true,4,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Urea Black Sea Spot USD','USD','series',0),
    ('Ammonia Caribbean Spot USD','USD','series',1)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Ammonium Nitrate USD','value','ALL',true,5,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Ukraine Ammonium Nitrate Fertilizer USD','USD','series',0),
    ('Black Sea Ammonium Nitrate Fertilizer USD','USD','series',1),
    ('Germany Calcium Ammonium Nitrate Fertilizer USD','USD','series',2)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Ammonium Nitrate ZAR','value','ALL',true,6,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Ukraine Ammonium Nitrate Fertilizer ZAR','ZAR','series',0),
    ('Black Sea Ammonium Nitrate Fertilizer ZAR','ZAR','series',1),
    ('Germany Calcium Ammonium Nitrate Fertilizer ZAR','ZAR','series',2)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Ammonium Nitrate ZAR (Urea − 0.58×Ammonia)','nitrogen_spread','ALL',true,7,'Urea Black Sea Spot minus 0.58× Ammonia Caribbean Spot (ZAR) — a nitrogen-margin proxy — with its cumulative average.') returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Urea Black Sea Spot ZAR','ZAR','spread_a',0),
    ('Ammonia Caribbean Spot ZAR','ZAR','spread_b',1)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('SA Electricity Price Index','value','ALL',true,8,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('SA ELECTRICITY PRICE INDEX','','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Energy Prices (Indexed)','index','ALL',true,9,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Brent Crude Oil','USD','series',0),
    ('Natural Gas (Henry Hub)','USD','series',1),
    ('EU Carbon Prices','USD','series',2),
    ('Thermal Coal','USD','series',3)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Brent Crude Oil','value','ALL',true,10,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Brent Crude Oil','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Total World Oil & Gas Rig Count','value','ALL',true,11,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Total World Oil & Gas Rig Count','','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('US Oil & Gas Rig Count','value','ALL',true,12,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('US Oil & Gas Rig Count','','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Natural Gas (Henry Hub)','value','ALL',true,13,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Natural Gas (Henry Hub)','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Natural Gas (Dutch)','value','ALL',true,14,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Natural Gas (Dutch)','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Natural Gas (Tokyo)','value','ALL',true,15,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Liquified Natural Gas (Tokyo)','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Thermal Coal','value','ALL',true,16,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Thermal Coal','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('EU Carbon','value','ALL',true,17,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('EU Carbon Prices','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Base Metals Index','index','ALL',true,18,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Aluminium','USD','series',0),
    ('Copper','USD','series',1),
    ('Lead','USD','series',2),
    ('Nickel','USD','series',3),
    ('Zinc','USD','series',4)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('LME Aluminium','value','ALL',true,19,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Aluminium','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('LME Copper','value','ALL',true,20,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Copper','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('LME Lead','value','ALL',true,21,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Lead','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('LME Nickel','value','ALL',true,22,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Nickel','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('LME Zinc','value','ALL',true,23,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Zinc','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Gold','value','ALL',true,24,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Gold','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('PGMs (Indexed)','index','ALL',true,25,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('PGM Price','USD','series',0),
    ('Platinum','USD','series',1),
    ('Palladium','USD','series',2),
    ('Rhodium','USD','series',3)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('PGM vs Equities (Indexed)','index','ALL',true,26,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('PGM Price','USD','series',0),
    ('Impala Platinum','ZAR','series',1),
    ('Sibanye Siltwater','ZAR','series',2),
    ('Northam Platinum','ZAR','series',3),
    ('Valterra Platinum','ZAR','series',4)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Platinum Lease Rates','value','ALL',true,27,'Lease rates are the cost of borrowing platinum for a period. High costs indicate high demand.') returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Platinum 1 month Forward','ZAR','series',0),
    ('Platinum 3 month Forward','USD','series',1),
    ('Platinum 6 month Forward','USD','series',2),
    ('Platinum 12 month Forward','USD','series',3)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('NYMEX Exchange Stocks','value','ALL',true,28,'Physical inventory held at NYMEX. High platinum stores suggest store-of-value demand; low stores suggest industrial usage.') returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Platinum  - NYMEX inventory','USD','series',0),
    ('Palladium  - NYMEX inventory','USD','series',1)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Platinum ETF Holdings','value','ALL',true,29,'ETF holdings of the physical metal. Rising holdings indicate financial (store-of-value) demand, not consumption.') returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Platinum ETF Holdings','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Palladium ETF Holdings','value','ALL',true,30,'ETF holdings of the physical metal. Rising holdings indicate financial (store-of-value) demand, not consumption.') returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Palladium ETF Holdings','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Rhodium ETF Holdings (Proxy)','value','ALL',true,31,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Rhodium ETF Holdings (Proxy)','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Steel Making Ingredients (Indexed)','index','ALL',true,32,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Iron Ore 62%','USD','series',0),
    ('Iron Ore Lump','USD','series',1),
    ('Hard Coking Coal','USD','series',2),
    ('Mangenese','USD','series',3)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Iron Ore 62%','value','ALL',true,33,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Iron Ore 62%','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Iron Ore Lump','value','ALL',true,34,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Iron Ore Lump','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Iron Ore Lump Premium','spread','ALL',true,35,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Iron Ore Lump','USD','spread_a',0),
    ('Iron Ore 62%','USD','spread_b',1)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Hard Coking Coal','value','ALL',true,36,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Hard Coking Coal','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Manganese','value','ALL',true,37,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Mangenese','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Commodity Producers Capex','value','ALL',true,38,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Commodity Producers Capex','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Local Wheat','value','ALL',true,39,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Local Wheat Price','ZAR','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Maize','value','ALL',true,40,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Generic Yellow Maize Futures','ZAR','series',0),
    ('Export Parity Maize','ZAR','series',1),
    ('Import Parity Maize','ZAR','series',2)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('SA Corn vs World Corn','value','ALL',true,41,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Generic Yellow Maize Futures','USD','series',0),
    ('CBOT Corn','','series',1)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Agri Prices (Indexed)','index','ALL',true,42,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Corn','ZAR','series',0),
    ('Soybean','ZAR','series',1),
    ('Wheat','ZAR','series',2),
    ('ICE Sugar','','series',3),
    ('ICE Coffee','','series',4),
    ('ICE Cocoa','','series',5)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Corn','value','ALL',true,43,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('CBOT Corn','','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Soybean','value','ALL',true,44,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('CBOT Soybean','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Wheat','value','ALL',true,45,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('CBOT Wheat','USD','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Sugar','value','ALL',true,46,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('ICE Sugar','','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Coffee','value','ALL',true,47,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('ICE Coffee','','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Cocoa','value','ALL',true,48,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('ICE Cocoa','','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Peru Fishmeal','value','ALL',true,49,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Peru Fishmeal','','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Macau Visitors','value','ALL',true,50,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Macau Total Visitors','','series',0),
    ('Macau Chinese Visitors','','series',1)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;

do $$ declare cid bigint; begin
  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) values ('Macau Hotel Occupancy Rates','value','ALL',true,51,null) returning id into cid;
  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)
  select cid, i.id, v.role, v.ord from (values
    ('Macau Hotel Occupancy Rates','','series',0)
  ) as v(nm,ccy,role,ord)
  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;
end $$;
