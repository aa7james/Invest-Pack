"""
Reorder every pack chart to follow the PDF page order, section by section.
Within a section, charts listed below are placed in that order; any pack chart
in the section not listed is appended after them (nothing is dropped).
Section sequence: Chemicals, Energy, Metals, Soft Commodities, Chicken, Gaming,
Manheim (Chicken/Gaming/Manheim keep their current order — already PDF order).
Public key. Run: py supabase/reorder_pack.py
"""
import sys, json, urllib.request, urllib.error
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

URL = 'https://knciqlbngtmsgmhnbfce.supabase.co'
KEY = 'sb_publishable_YwMLfMra6vzUnfvkn9uqTw_akegqlYp'


def api(method, path, body=None, prefer=None):
    h = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json',
         'Accept-Profile': 'pack', 'Content-Profile': 'pack'}
    if prefer:
        h['Prefer'] = prefer
    d = json.dumps(body).encode('utf-8') if body is not None else None
    r = urllib.request.Request(URL + path, data=d, method=method, headers=h)
    with urllib.request.urlopen(r, timeout=60) as resp:
        raw = resp.read().decode('utf-8')
        return json.loads(raw) if raw else None


CHEM = ['Polymers ZAR', 'Polymers USD', 'Fertiliser Prices ZAR', 'Fertiliser Prices USD',
        'Ammonium Nitrate USD', 'Ammonium Nitrate ZAR', 'Ammonium Nitrate ZAR (Urea − 0.58×Ammonia)']
ENERGY = ['Electricity consumed in South Africa', 'SA Electricity Price Index',
          'Monthly Eskom Generation Capacity Breakdown', 'Energy Prices (Indexed from 2001)',
          'Energy Prices (Actual)', 'Brent Crude Oil (10Y)', 'Brent Crude Oil', 'Brent Forward Curve',
          'Total World Oil & Gas Rig Count', 'US Oil & Gas Rig Count',
          'Natural Gas (Henry Hub) (10Y)', 'Natural Gas (Henry Hub)',
          'Natural Gas (Dutch) (10Y)', 'Natural Gas (Dutch)', 'Natural Gas (Tokyo)',
          'Thermal Coal (10Y)', 'Thermal Coal', 'EU Carbon (10Y)', 'EU Carbon']
METALS = ['Base Metals Index (Indexed from 2016)', 'Base Metals Index (Indexed from 2001)',
          'LME Aluminium (10Y)', 'LME Aluminium', 'LME Copper (10Y)', 'LME Copper',
          'LME Lead (10Y)', 'LME Lead', 'LME Nickel (10Y)', 'LME Nickel', 'LME Zinc (10Y)', 'LME Zinc',
          'Gold (10Y)', 'Gold', 'PGMs (Indexed from 2022)', 'PGM vs Equities (Indexed from 2001)',
          'Platinum/Gold Correlation', 'Platinum/Gold', 'Platinum Lease Rates', 'NYMEX Exchange Stocks',
          'Sponge Premium (Proxy)', 'Platinum ETF Holdings', 'Palladium ETF Holdings',
          'Rhodium ETF Holdings (Proxy)', 'Global Rough Diamond Index',
          'Steel Making Ingredients (Indexed from 2016)', 'Steel Making Ingredients (Indexed from 2001)',
          'Iron Ore 62% (10Y)', 'Iron Ore 62%', 'Iron Ore Lump Premium (10Y)', 'Iron Ore Lump Premium',
          'Hard Coking Coal (10Y)', 'Hard Coking Coal', 'Manganese (10Y)', 'Manganese',
          'Commodity Producers Capex', 'Cap Ex for Top Spenders', 'Pre-owned Watch Market',
          'Investec Mining Clock']
SOFT = ['Local Wheat (10Y)', 'Local Wheat', 'Maize (10Y)', 'Maize',
        'SA Corn vs World Corn (10Y)', 'SA Corn vs World Corn', 'Maize Crop Progress',
        'Agri Prices (Indexed from 2016)', 'Agri Prices (Indexed from 2001)', 'Corn (10Y)', 'Corn',
        'Soybean (10Y)', 'Soybean', 'Wheat (10Y)', 'Wheat', 'Sugar (10Y)', 'Sugar',
        'Coffee (10Y)', 'Coffee', 'Cocoa (10Y)', 'Cocoa', 'Cocoa Futures Curve',
        'Peru Fishmeal (10Y)', 'Peru Fishmeal', 'Super Prime Fishmeal Price', 'Fishoil Price (Aquagrade)']

# effective-category sequence, with explicit intra-section order where known.
SECTIONS = [('Chemicals', CHEM), ('Energy', ENERGY), ('Metals', METALS),
            ('Soft Commodities', SOFT), ('Chicken', None), ('Gaming', None), ('Manheim', None)]


def main():
    insts = {i['id']: i['category'] for i in api('GET', '/rest/v1/instruments?select=id,category')}
    charts = api('GET', '/rest/v1/charts?select=id,title,category,pack_order,in_pack,chart_series(instrument_id)')
    charts = [c for c in charts if c.get('in_pack')]

    def eff_cat(c):
        if c.get('category'):
            return c['category']
        cs = c.get('chart_series') or []
        if cs:
            return insts.get(cs[0]['instrument_id'])
        return None

    by_cat = {}
    for c in charts:
        by_cat.setdefault(eff_cat(c), []).append(c)

    order = 0
    updates = []
    used = set()
    for cat, titles in SECTIONS:
        pool = by_cat.get(cat, [])
        by_title = {}
        for c in pool:
            by_title.setdefault(c['title'], c)
        seq = []
        if titles:
            for t in titles:
                if t in by_title and by_title[t]['id'] not in used:
                    seq.append(by_title[t]); used.add(by_title[t]['id'])
        # append leftovers (unlisted, or Chicken/Gaming/Manheim) in current order
        for c in sorted(pool, key=lambda x: x['pack_order']):
            if c['id'] not in used:
                seq.append(c); used.add(c['id'])
        for c in seq:
            order += 1
            if c['pack_order'] != order:
                updates.append((c['id'], order))
        print('%-18s %d charts' % (cat, len(seq)))

    for cid, po in updates:
        api('PATCH', '/rest/v1/charts?id=eq.%d' % cid, prefer='return=minimal', body={'pack_order': po})
    print('reordered %d charts' % len(updates))


if __name__ == '__main__':
    main()
