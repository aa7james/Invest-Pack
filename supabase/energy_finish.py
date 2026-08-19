"""
Finish the Energy section: add the missing 'recent 10-year' companion charts for
Brent, Nat Gas (HH), Nat Gas (Dutch), Thermal Coal, EU Carbon, plus the Brent
forward-curve image panel — then order the whole Energy section to match the pack.
Non-destructive (creates missing + updates pack_order only). Uses the public key.
"""
import sys, json, urllib.request, urllib.error
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

URL = 'https://knciqlbngtmsgmhnbfce.supabase.co'
KEY = 'sb_publishable_YwMLfMra6vzUnfvkn9uqTw_akegqlYp'
CAT_ORDER = ['Chemicals', 'Energy', 'Metals', 'Soft Commodities', 'Chicken', 'Gaming', 'Manheim', 'Other']


def api(method, path, body=None, prefer=None):
    h = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json',
         'Accept-Profile': 'pack', 'Content-Profile': 'pack'}
    if prefer:
        h['Prefer'] = prefer
    d = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(URL + path, data=d, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        print('HTTP %d %s: %s' % (e.code, path, e.read().decode()[:300])); raise


# Recent 10Y companion charts: (new title, instrument name, currency)
RECENTS = [
    ('Brent Crude Oil (10Y)', 'Brent Crude Oil', 'USD'),
    ('Natural Gas (Henry Hub) (10Y)', 'Natural Gas (Henry Hub)', 'USD'),
    ('Natural Gas (Dutch) (10Y)', 'Natural Gas (Dutch)', 'USD'),
    ('Thermal Coal (10Y)', 'Thermal Coal', 'USD'),
    ('EU Carbon (10Y)', 'EU Carbon Prices', 'USD'),
]

# Desired Energy section order (by title), matching pack pages 10-28.
ENERGY_ORDER = [
    'Electricity consumed in South Africa',
    'SA Electricity Price Index',
    'Monthly Eskom Generation Capacity Breakdown',
    'Energy Prices (Indexed from 2001)',
    'Energy Prices (Actual)',
    'Brent Crude Oil (10Y)',
    'Brent Crude Oil',
    'Total World Oil & Gas Rig Count',
    'US Oil & Gas Rig Count',
    'Brent Forward Curve',
    'Natural Gas (Henry Hub)',
    'Natural Gas (Henry Hub) (10Y)',
    'Natural Gas (Dutch)',
    'Natural Gas (Dutch) (10Y)',
    'Natural Gas (Tokyo)',
    'Thermal Coal',
    'Thermal Coal (10Y)',
    'EU Carbon',
    'EU Carbon (10Y)',
]


def main():
    insts = api('GET', '/rest/v1/instruments?select=id,name,currency,category&limit=10000')
    lookup = {(r['name'], r.get('currency') or ''): r['id'] for r in insts}
    inst_cat = {r['id']: r['category'] for r in insts}

    charts = api('GET', '/rest/v1/charts?select=id,title,chart_type,pack_order,category')
    series = api('GET', '/rest/v1/chart_series?select=chart_id,instrument_id,sort_order')
    first_inst = {}
    for s in sorted(series, key=lambda x: x['sort_order']):
        first_inst.setdefault(s['chart_id'], s['instrument_id'])
    by_title = {c['title']: c for c in charts}

    # 1. Create missing recent (10Y) charts.
    for title, iname, iccy in RECENTS:
        if title in by_title:
            continue
        created = api('POST', '/rest/v1/charts', prefer='return=representation', body={
            'title': title, 'chart_type': 'value', 'time_range': '10Y',
            'category': 'Energy', 'in_pack': True, 'pack_order': 9999})
        cid = created[0]['id']
        api('POST', '/rest/v1/chart_series', prefer='return=minimal',
            body=[{'chart_id': cid, 'instrument_id': lookup[(iname, iccy)], 'role': 'series', 'sort_order': 0}])
        print('created', title)

    # 2. Create the Brent forward-curve image panel.
    if 'Brent Forward Curve' not in by_title:
        api('POST', '/rest/v1/charts', prefer='return=minimal', body={
            'title': 'Brent Forward Curve', 'chart_type': 'image', 'category': 'Energy',
            'time_range': 'ALL', 'in_pack': True, 'pack_order': 9999,
            'annotation': 'Bloomberg Brent futures curve (COV Comdty). Paste the latest screenshot each month.'})
        print('created Brent Forward Curve (image)')

    # 3. Reorder everything: group by category (CAT_ORDER), Energy in ENERGY_ORDER.
    charts = api('GET', '/rest/v1/charts?select=id,title,pack_order,category')
    def cat_of(c):
        if c.get('category'):
            return c['category']
        iid = first_inst.get(c['id'])
        return inst_cat.get(iid, 'Other') if iid else 'Other'

    groups = {}
    for c in charts:
        groups.setdefault(cat_of(c), []).append(c)

    ordered = []
    for cat in CAT_ORDER:
        items = groups.get(cat, [])
        if cat == 'Energy':
            rank = {t: i for i, t in enumerate(ENERGY_ORDER)}
            items = sorted(items, key=lambda c: rank.get(c['title'], 999))
        else:
            items = sorted(items, key=lambda c: c['pack_order'])
        ordered.extend(items)
    for cat, items in groups.items():
        if cat not in CAT_ORDER:
            ordered.extend(sorted(items, key=lambda c: c['pack_order']))

    for i, c in enumerate(ordered, 1):
        if c['pack_order'] != i:
            api('PATCH', '/rest/v1/charts?id=eq.%d' % c['id'], prefer='return=minimal', body={'pack_order': i})
    print('Reordered %d charts. Energy section now matches the pack.' % len(ordered))


if __name__ == '__main__':
    main()
