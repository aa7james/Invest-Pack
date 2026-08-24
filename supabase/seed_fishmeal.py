"""
Seed Super Prime Fishmeal + Fishoil (Aquagrade) history from the Promar report
and build their charts. Public key only (manual series). Requires
fishmeal_migration.sql to have created the two manual instruments first.
"""
import os, sys, json, urllib.request, urllib.error
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

URL = 'https://knciqlbngtmsgmhnbfce.supabase.co'
KEY = 'sb_publishable_YwMLfMra6vzUnfvkn9uqTw_akegqlYp'
HERE = os.path.dirname(os.path.abspath(__file__))
CAT = 'Soft Commodities'
CAT_ORDER = ['Chemicals', 'Energy', 'Metals', 'Soft Commodities', 'Chicken', 'Gaming', 'Manheim', 'Other']
SOFTS_ORDER = [
    'Local Wheat (10Y)', 'Local Wheat', 'Maize (10Y)', 'Maize',
    'SA Corn vs World Corn (10Y)', 'SA Corn vs World Corn', 'Maize Crop Progress',
    'Agri Prices (Indexed from 2016)', 'Agri Prices (Indexed from 2001)',
    'Corn (10Y)', 'Corn', 'Soybean (10Y)', 'Soybean', 'Wheat (10Y)', 'Wheat',
    'Sugar (10Y)', 'Sugar', 'Coffee (10Y)', 'Coffee', 'Cocoa (10Y)', 'Cocoa',
    'Cocoa Futures Curve', 'Peru Fishmeal (10Y)', 'Peru Fishmeal',
    'Super Prime Fishmeal Price', 'Fishoil Price (Aquagrade)',
]


def api(method, path, body=None, prefer=None):
    h = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json',
         'Accept-Profile': 'pack', 'Content-Profile': 'pack'}
    if prefer:
        h['Prefer'] = prefer
    d = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(URL + path, data=d, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        print('HTTP %d %s: %s' % (e.code, path, e.read().decode()[:300])); raise


def inst_id(name):
    rows = api('GET', '/rest/v1/instruments?select=id,source&name=eq.' + urllib.parse.quote(name))
    return rows[0]['id'] if rows else None


import urllib.parse


def seed(iid, rows):
    payload = [{'instrument_id': iid, 'obs_date': d, 'value': v} for d, v in rows]
    for i in range(0, len(payload), 1000):
        api('POST', '/rest/v1/pack_data?on_conflict=instrument_id,obs_date',
            body=payload[i:i + 1000], prefer='resolution=merge-duplicates,return=minimal')
    print('  seeded', len(payload), 'points -> instrument', iid)


def main():
    data = json.load(open(os.path.join(HERE, 'promar_data.json')))
    fm = inst_id('Super Prime Fishmeal Price')
    fo = inst_id('Fishoil Price (Aquagrade)')
    if not fm or not fo:
        print('ERROR: instruments missing — run fishmeal_migration.sql first.'); sys.exit(1)
    print('Seeding data...')
    seed(fm, data['fishmeal'])
    seed(fo, data['fishoil'])

    charts = {c['title']: c for c in api('GET', '/rest/v1/charts?select=id,title,chart_type')}
    # Super Prime Fishmeal chart (create)
    if 'Super Prime Fishmeal Price' not in charts:
        c = api('POST', '/rest/v1/charts', prefer='return=representation', body={
            'title': 'Super Prime Fishmeal Price', 'chart_type': 'value', 'time_range': 'ALL',
            'category': CAT, 'in_pack': True, 'pack_order': 9999})
        api('POST', '/rest/v1/chart_series', prefer='return=minimal',
            body=[{'chart_id': c[0]['id'], 'instrument_id': fm, 'role': 'series', 'sort_order': 0}])
        print('created Super Prime Fishmeal Price chart')
    # Fishoil: convert image panel -> value chart
    if 'Fishoil Price (Aquagrade)' in charts:
        fid = charts['Fishoil Price (Aquagrade)']['id']
        api('PATCH', '/rest/v1/charts?id=eq.%d' % fid, prefer='return=minimal',
            body={'chart_type': 'value', 'time_range': 'ALL', 'image_data': None})
        api('DELETE', '/rest/v1/chart_series?chart_id=eq.%d' % fid, prefer='return=minimal')
        api('POST', '/rest/v1/chart_series', prefer='return=minimal',
            body=[{'chart_id': fid, 'instrument_id': fo, 'role': 'series', 'sort_order': 0}])
        print('converted Fishoil (Aquagrade) image panel -> value chart')

    # reorder Softs
    charts = api('GET', '/rest/v1/charts?select=id,title,pack_order,category')
    series = api('GET', '/rest/v1/chart_series?select=chart_id,instrument_id,sort_order')
    insts = api('GET', '/rest/v1/instruments?select=id,category&limit=10000')
    inst_cat = {r['id']: r['category'] for r in insts}
    first_inst = {}
    for s in sorted(series, key=lambda x: x['sort_order']):
        first_inst.setdefault(s['chart_id'], s['instrument_id'])

    def cat_of(c):
        if c.get('category'):
            return c['category']
        iid = first_inst.get(c['id'])
        return inst_cat.get(iid, 'Other') if iid else 'Other'

    groups = {}
    for c in charts:
        groups.setdefault(cat_of(c), []).append(c)
    rank = {t: i for i, t in enumerate(SOFTS_ORDER)}
    ordered = []
    for cat in CAT_ORDER:
        items = groups.get(cat, [])
        items = sorted(items, key=(lambda c: rank.get(c['title'], 999)) if cat == CAT else (lambda c: c['pack_order']))
        ordered.extend(items)
    for cat, items in groups.items():
        if cat not in CAT_ORDER:
            ordered.extend(sorted(items, key=lambda c: c['pack_order']))
    for i, c in enumerate(ordered, 1):
        if c['pack_order'] != i:
            api('PATCH', '/rest/v1/charts?id=eq.%d' % c['id'], prefer='return=minimal', body={'pack_order': i})
    print('DONE. Reordered %d charts.' % len(ordered))


if __name__ == '__main__':
    main()
