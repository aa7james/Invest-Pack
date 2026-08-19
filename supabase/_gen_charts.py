"""Generate create_charts.sql from a curated catalog of the investment pack's
Bloomberg-driven charts. Validates every series against the known instrument
set so no series is silently dropped."""

# (name, currency) exactly as stored in pack.instruments
KNOWN = {
    ('PolyPropylene USD','USD'),('LDPE USD','USD'),('LLDPE USD','USD'),('HDPE USD','USD'),('PH USD','USD'),
    ('PolyPropylene ZAR','ZAR'),('LDPE ZAR','ZAR'),('LLDPE ZAR','ZAR'),('HDPE ZAR','ZAR'),('PH ZAR','ZAR'),
    ('Urea Black Sea Spot ZAR','ZAR'),('Ammonia Caribbean Spot ZAR','ZAR'),('Urea Black Sea Spot USD','USD'),('Ammonia Caribbean Spot USD','USD'),
    ('Ukraine Ammonium Nitrate Fertilizer USD','USD'),('Black Sea Ammonium Nitrate Fertilizer USD','USD'),('Germany Calcium Ammonium Nitrate Fertilizer USD','USD'),
    ('Ukraine Ammonium Nitrate Fertilizer ZAR','ZAR'),('Black Sea Ammonium Nitrate Fertilizer ZAR','ZAR'),('Germany Calcium Ammonium Nitrate Fertilizer ZAR','ZAR'),
    ('SA ELECTRICITY PRICE INDEX',''),('Brent Crude Oil','USD'),('Natural Gas (Henry Hub)','USD'),('EU Carbon Prices','USD'),('Thermal Coal','USD'),
    ('Total World Oil & Gas Rig Count',''),('US Oil & Gas Rig Count',''),('Liquified Natural Gas (Tokyo)','USD'),('Natural Gas (Dutch)','USD'),('Uranium','USD'),
    ('Aluminium','USD'),('Copper','USD'),('Lead','USD'),('Nickel','USD'),('Zinc','USD'),('Gold','USD'),('PGM Price','USD'),
    ('Platinum','USD'),('Palladium','USD'),('Rhodium','USD'),('Iron Ore 62%','USD'),('Iron Ore Lump','USD'),('Hard Coking Coal','USD'),('Mangenese','USD'),
    ('Commodity Producers Capex','USD'),('Platinum 1 month Forward','ZAR'),('Platinum 3 month Forward','USD'),('Platinum 6 month Forward','USD'),('Platinum 12 month Forward','USD'),
    ('Platinum  - NYMEX inventory','USD'),('Palladium  - NYMEX inventory','USD'),('Platinum price North America','USD'),('Platinum price Europe','USD'),
    ('Platinum ETF Holdings','USD'),('Palladium ETF Holdings','USD'),('Rhodium ETF Holdings (Proxy)','USD'),
    ('Impala Platinum','ZAR'),('Sibanye Siltwater','ZAR'),('Northam Platinum','ZAR'),('Valterra Platinum','ZAR'),
    ('Local Wheat Price','ZAR'),('Generic Yellow Maize Futures','ZAR'),('Export Parity Maize','ZAR'),('Import Parity Maize','ZAR'),('Generic Yellow Maize Futures','USD'),
    ('CBOT Corn',''),('Corn','ZAR'),('Soybean','ZAR'),('CBOT Soybean','USD'),('Wheat','ZAR'),('CBOT Wheat','USD'),
    ('ICE Sugar',''),('ICE Coffee',''),('ICE Cocoa',''),('Peru Fishmeal',''),('Milk','USD'),('World Tea Price','USD'),('Palm Oil','USD'),
    ('Macau Total Visitors',''),('Macau Chinese Visitors',''),('Macau Hotel Occupancy Rates',''),
    ('Electricity Consumed (SA)',''),
}

# Each chart: (title, type, range, series). series = list of (name, ccy) for value/index,
# or ('spread', (a_name,a_ccy), (b_name,b_ccy)). Optional 4th elem in tuple = annotation.
V, I, S = 'value', 'index', 'spread'
CATALOG = [
    ('Polymers ZAR', V, 'ALL', [('PolyPropylene ZAR','ZAR'),('LDPE ZAR','ZAR'),('LLDPE ZAR','ZAR'),('HDPE ZAR','ZAR'),('PH ZAR','ZAR')]),
    ('Polymers USD', V, 'ALL', [('PolyPropylene USD','USD'),('LDPE USD','USD'),('LLDPE USD','USD'),('HDPE USD','USD'),('PH USD','USD')]),
    ('Fertiliser Prices ZAR', V, 'ALL', [('Urea Black Sea Spot ZAR','ZAR'),('Ammonia Caribbean Spot ZAR','ZAR')]),
    ('Fertiliser Prices USD', V, 'ALL', [('Urea Black Sea Spot USD','USD'),('Ammonia Caribbean Spot USD','USD')]),
    ('Ammonium Nitrate USD', V, 'ALL', [('Ukraine Ammonium Nitrate Fertilizer USD','USD'),('Black Sea Ammonium Nitrate Fertilizer USD','USD'),('Germany Calcium Ammonium Nitrate Fertilizer USD','USD')]),
    ('Ammonium Nitrate ZAR', V, 'ALL', [('Ukraine Ammonium Nitrate Fertilizer ZAR','ZAR'),('Black Sea Ammonium Nitrate Fertilizer ZAR','ZAR'),('Germany Calcium Ammonium Nitrate Fertilizer ZAR','ZAR')]),
    ('Ammonium Nitrate ZAR (Urea − 0.58×Ammonia)', 'nitrogen_spread', 'ALL', ('spread', ('Urea Black Sea Spot ZAR','ZAR'), ('Ammonia Caribbean Spot ZAR','ZAR')),
        'Urea Black Sea Spot minus 0.58× Ammonia Caribbean Spot (ZAR) — a nitrogen-margin proxy — with its cumulative average.'),

    ('SA Electricity Price Index', V, 'ALL', [('SA ELECTRICITY PRICE INDEX','')]),
    ('Electricity consumed in South Africa', V, 'ALL', [('Electricity Consumed (SA)','')],
        'Source: StatsSA — electricity available for distribution (GWh). Use the link on this chart to fetch new months.'),
    ('Energy Prices (Indexed from 2001)', I, 'ALL', [('Brent Crude Oil','USD'),('Natural Gas (Henry Hub)','USD'),('EU Carbon Prices','USD'),('Thermal Coal','USD')]),
    ('Energy Prices (Actual)', V, '2012-11-29', [('Brent Crude Oil','USD'),('Natural Gas (Henry Hub)','USD'),('EU Carbon Prices','USD'),('Thermal Coal','USD')]),
    ('Brent Crude Oil (10Y)', V, '10Y', [('Brent Crude Oil','USD')]),
    ('Brent Crude Oil', V, 'ALL', [('Brent Crude Oil','USD')]),
    ('Total World Oil & Gas Rig Count', V, 'ALL', [('Total World Oil & Gas Rig Count','')]),
    ('US Oil & Gas Rig Count', V, 'ALL', [('US Oil & Gas Rig Count','')]),
    ('Natural Gas (Henry Hub)', V, 'ALL', [('Natural Gas (Henry Hub)','USD')]),
    ('Natural Gas (Henry Hub) (10Y)', V, '10Y', [('Natural Gas (Henry Hub)','USD')]),
    ('Natural Gas (Dutch)', V, 'ALL', [('Natural Gas (Dutch)','USD')]),
    ('Natural Gas (Dutch) (10Y)', V, '10Y', [('Natural Gas (Dutch)','USD')]),
    ('Natural Gas (Tokyo)', V, 'ALL', [('Liquified Natural Gas (Tokyo)','USD')]),
    ('Thermal Coal', V, 'ALL', [('Thermal Coal','USD')]),
    ('Thermal Coal (10Y)', V, '10Y', [('Thermal Coal','USD')]),
    ('EU Carbon', V, 'ALL', [('EU Carbon Prices','USD')]),
    ('EU Carbon (10Y)', V, '10Y', [('EU Carbon Prices','USD')]),

    ('Base Metals Index', I, 'ALL', [('Aluminium','USD'),('Copper','USD'),('Lead','USD'),('Nickel','USD'),('Zinc','USD')]),
    ('LME Aluminium', V, 'ALL', [('Aluminium','USD')]),
    ('LME Copper', V, 'ALL', [('Copper','USD')]),
    ('LME Lead', V, 'ALL', [('Lead','USD')]),
    ('LME Nickel', V, 'ALL', [('Nickel','USD')]),
    ('LME Zinc', V, 'ALL', [('Zinc','USD')]),
    ('Gold', V, 'ALL', [('Gold','USD')]),
    ('PGMs (Indexed)', I, 'ALL', [('PGM Price','USD'),('Platinum','USD'),('Palladium','USD'),('Rhodium','USD')]),
    ('PGM vs Equities (Indexed)', I, 'ALL', [('PGM Price','USD'),('Impala Platinum','ZAR'),('Sibanye Siltwater','ZAR'),('Northam Platinum','ZAR'),('Valterra Platinum','ZAR')]),
    ('Platinum Lease Rates', V, 'ALL', [('Platinum 1 month Forward','ZAR'),('Platinum 3 month Forward','USD'),('Platinum 6 month Forward','USD'),('Platinum 12 month Forward','USD')],
        'Lease rates are the cost of borrowing platinum for a period. High costs indicate high demand.'),
    ('NYMEX Exchange Stocks', V, 'ALL', [('Platinum  - NYMEX inventory','USD'),('Palladium  - NYMEX inventory','USD')],
        'Physical inventory held at NYMEX. High platinum stores suggest store-of-value demand; low stores suggest industrial usage.'),
    ('Platinum ETF Holdings', V, 'ALL', [('Platinum ETF Holdings','USD')],
        'ETF holdings of the physical metal. Rising holdings indicate financial (store-of-value) demand, not consumption.'),
    ('Palladium ETF Holdings', V, 'ALL', [('Palladium ETF Holdings','USD')],
        'ETF holdings of the physical metal. Rising holdings indicate financial (store-of-value) demand, not consumption.'),
    ('Rhodium ETF Holdings (Proxy)', V, 'ALL', [('Rhodium ETF Holdings (Proxy)','USD')]),
    ('Steel Making Ingredients (Indexed)', I, 'ALL', [('Iron Ore 62%','USD'),('Iron Ore Lump','USD'),('Hard Coking Coal','USD'),('Mangenese','USD')]),
    ('Iron Ore 62%', V, 'ALL', [('Iron Ore 62%','USD')]),
    ('Iron Ore Lump', V, 'ALL', [('Iron Ore Lump','USD')]),
    ('Iron Ore Lump Premium', S, 'ALL', ('spread', ('Iron Ore Lump','USD'), ('Iron Ore 62%','USD'))),
    ('Hard Coking Coal', V, 'ALL', [('Hard Coking Coal','USD')]),
    ('Manganese', V, 'ALL', [('Mangenese','USD')]),
    ('Commodity Producers Capex', V, 'ALL', [('Commodity Producers Capex','USD')]),

    ('Local Wheat', V, 'ALL', [('Local Wheat Price','ZAR')]),
    ('Maize', V, 'ALL', [('Generic Yellow Maize Futures','ZAR'),('Export Parity Maize','ZAR'),('Import Parity Maize','ZAR')]),
    ('SA Corn vs World Corn', V, 'ALL', [('Generic Yellow Maize Futures','USD'),('CBOT Corn','')]),
    ('Agri Prices (Indexed)', I, 'ALL', [('Corn','ZAR'),('Soybean','ZAR'),('Wheat','ZAR'),('ICE Sugar',''),('ICE Coffee',''),('ICE Cocoa','')]),
    ('Corn', V, 'ALL', [('CBOT Corn','')]),
    ('Soybean', V, 'ALL', [('CBOT Soybean','USD')]),
    ('Wheat', V, 'ALL', [('CBOT Wheat','USD')]),
    ('Sugar', V, 'ALL', [('ICE Sugar','')]),
    ('Coffee', V, 'ALL', [('ICE Coffee','')]),
    ('Cocoa', V, 'ALL', [('ICE Cocoa','')]),
    ('Peru Fishmeal', V, 'ALL', [('Peru Fishmeal','')]),

    ('Macau Visitors', V, 'ALL', [('Macau Total Visitors',''),('Macau Chinese Visitors','')]),
    ('Macau Hotel Occupancy Rates', V, 'ALL', [('Macau Hotel Occupancy Rates','')]),
]


def esc(s):
    return s.replace("'", "''")


def main():
    # validate
    errors = []
    for entry in CATALOG:
        title, typ, rng, series = entry[0], entry[1], entry[2], entry[3]
        pairs = []
        if typ in ('spread', 'nitrogen_spread'):
            pairs = [series[1], series[2]]
        else:
            pairs = series
        for p in pairs:
            if (p[0], p[1]) not in KNOWN:
                errors.append(f'{title}: unknown series {p}')
    if errors:
        print('VALIDATION ERRORS:')
        for e in errors:
            print('  ', e)
        raise SystemExit(1)

    out = []
    out.append('-- Auto-generated: recreates the investment pack charts from Bloomberg-driven data.')
    out.append('-- Self-contained: creates the chart tables if needed, then rebuilds the pack.')
    out.append('-- NOTE: this RESETS all saved charts and rebuilds the pack.')
    out.append("""
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
""")
    out.append('truncate table pack.charts restart identity cascade;')
    out.append('')

    for order, entry in enumerate(CATALOG, 1):
        title, typ, rng, series = entry[0], entry[1], entry[2], entry[3]
        annot = entry[4] if len(entry) > 4 else None
        annot_sql = f"'{esc(annot)}'" if annot else 'null'
        rows = []
        if typ in ('spread', 'nitrogen_spread'):
            _, a, b = series
            rows.append((a[0], a[1], 'spread_a', 0))
            rows.append((b[0], b[1], 'spread_b', 1))
        else:
            for i, (nm, ccy) in enumerate(series):
                rows.append((nm, ccy, 'series', i))
        values = ',\n    '.join(
            f"('{esc(nm)}','{esc(ccy)}','{role}',{ordn})" for nm, ccy, role, ordn in rows
        )
        out.append('do $$ declare cid bigint; begin')
        out.append(
            f"  insert into pack.charts(title,chart_type,time_range,in_pack,pack_order,annotation) "
            f"values ('{esc(title)}','{typ}','{rng}',true,{order},{annot_sql}) returning id into cid;"
        )
        out.append('  insert into pack.chart_series(chart_id,instrument_id,role,sort_order)')
        out.append('  select cid, i.id, v.role, v.ord from (values')
        out.append('    ' + values)
        out.append('  ) as v(nm,ccy,role,ord)')
        out.append("  join pack.instruments i on i.name = v.nm and coalesce(i.currency,'') = v.ccy;")
        out.append('end $$;')
        out.append('')

    import os
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'create_charts.sql')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))
    print(f'OK: {len(CATALOG)} charts written to create_charts.sql')


if __name__ == '__main__':
    main()
