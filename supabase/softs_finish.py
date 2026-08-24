"""
Soft Commodities section — add missing recent-10Y companions, the 2016 Agri
index base, and 3 screenshot panels; order to match the pack (pages 72-97).
Non-destructive; public key.
"""
import sys, json, urllib.request, urllib.error
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

URL = 'https://knciqlbngtmsgmhnbfce.supabase.co'
KEY = 'sb_publishable_YwMLfMra6vzUnfvkn9uqTw_akegqlYp'
CAT = 'Soft Commodities'
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


def main():
    insts = api('GET', '/rest/v1/instruments?select=id,name,currency,category&limit=10000')
    lookup = {(r['name'], r.get('currency') or ''): r['id'] for r in insts}
    inst_cat = {r['id']: r['category'] for r in insts}
    charts = api('GET', '/rest/v1/charts?select=id,title,pack_order,category')
    have = {c['title']: c for c in charts}

    def new_chart(title, ctype, rng, series):
        if title in have:
            return
        created = api('POST', '/rest/v1/charts', prefer='return=representation', body={
            'title': title, 'chart_type': ctype, 'time_range': rng,
            'category': CAT, 'in_pack': True, 'pack_order': 9999})
        cid = created[0]['id']
        rows = [{'chart_id': cid, 'instrument_id': lookup[k], 'role': role, 'sort_order': i}
                for i, (k, role) in enumerate(series)]
        api('POST', '/rest/v1/chart_series', prefer='return=minimal', body=rows)
        print('created', title)

    def new_image(title, annotation):
        if title in have:
            return
        api('POST', '/rest/v1/charts', prefer='return=minimal', body={
            'title': title, 'chart_type': 'image', 'category': CAT,
            'time_range': 'ALL', 'in_pack': True, 'pack_order': 9999, 'annotation': annotation})
        print('created image panel', title)

    S = lambda name, ccy: ((name, ccy), 'series')
    # recent-10Y companions (same series as the full charts)
    new_chart('Local Wheat (10Y)', 'value', '10Y', [S('Local Wheat Price', 'ZAR')])
    new_chart('Maize (10Y)', 'value', '10Y', [S('Generic Yellow Maize Futures', 'ZAR'), S('Export Parity Maize', 'ZAR'), S('Import Parity Maize', 'ZAR')])
    new_chart('SA Corn vs World Corn (10Y)', 'value', '10Y', [S('Generic Yellow Maize Futures', 'USD'), S('CBOT Corn', '')])
    new_chart('Corn (10Y)', 'value', '10Y', [S('CBOT Corn', '')])
    new_chart('Soybean (10Y)', 'value', '10Y', [S('CBOT Soybean', 'USD')])
    new_chart('Wheat (10Y)', 'value', '10Y', [S('CBOT Wheat', 'USD')])
    new_chart('Sugar (10Y)', 'value', '10Y', [S('ICE Sugar', '')])
    new_chart('Coffee (10Y)', 'value', '10Y', [S('ICE Coffee', '')])
    new_chart('Cocoa (10Y)', 'value', '10Y', [S('ICE Cocoa', '')])
    new_chart('Peru Fishmeal (10Y)', 'value', '10Y', [S('Peru Fishmeal', '')])

    # Agri Prices — add the 2016 index; rename existing to 2001.
    new_chart('Agri Prices (Indexed from 2016)', 'index', '2016-01-01',
              [S('Corn', 'ZAR'), S('Soybean', 'ZAR'), S('Wheat', 'ZAR'), S('ICE Sugar', ''), S('ICE Coffee', ''), S('ICE Cocoa', '')])
    if 'Agri Prices (Indexed)' in have:
        api('PATCH', '/rest/v1/charts?id=eq.%d' % have['Agri Prices (Indexed)']['id'],
            prefer='return=minimal', body={'title': 'Agri Prices (Indexed from 2001)'})
        print('renamed Agri Prices (Indexed) -> (from 2001)')

    # Screenshot / external panels
    new_image('Maize Crop Progress', 'Cumulative SA maize produced by season (external crop data). Paste the latest screenshot.')
    new_image('Cocoa Futures Curve', 'Bloomberg cocoa futures curve (CCU Comdty). Paste the latest screenshot.')
    new_image('Fishoil Price (Aquagrade)', 'Fishoil aquagrade $/MT (external). Paste the latest screenshot.')

    # --- reorder Softs to match the pack ---
    SOFTS_ORDER = [
        'Local Wheat (10Y)', 'Local Wheat', 'Maize (10Y)', 'Maize',
        'SA Corn vs World Corn (10Y)', 'SA Corn vs World Corn', 'Maize Crop Progress',
        'Agri Prices (Indexed from 2016)', 'Agri Prices (Indexed from 2001)',
        'Corn (10Y)', 'Corn', 'Soybean (10Y)', 'Soybean', 'Wheat (10Y)', 'Wheat',
        'Sugar (10Y)', 'Sugar', 'Coffee (10Y)', 'Coffee', 'Cocoa (10Y)', 'Cocoa',
        'Cocoa Futures Curve', 'Peru Fishmeal (10Y)', 'Peru Fishmeal', 'Fishoil Price (Aquagrade)',
    ]
    charts = api('GET', '/rest/v1/charts?select=id,title,pack_order,category')
    series = api('GET', '/rest/v1/chart_series?select=chart_id,instrument_id,sort_order')
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
        if cat == CAT:
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
    print('Reordered %d charts.' % len(ordered))


if __name__ == '__main__':
    main()
