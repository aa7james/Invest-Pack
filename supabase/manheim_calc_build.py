"""
Build the computed Manheim charts from raw inputs:
 - OEM Market Share  -> 16 brand-unit series, grouped & divided in the app
 - Cars Sold For Hire-> % sold for hire * total cars, then 12-month rolling
Also adds the "Global xEVs (BEV + PHEV) Monthly Sales" screenshot panel.
Idempotent. Public key. Run after manheim_calc_migration.sql.
Run: py supabase/manheim_calc_build.py
"""
import os, sys, json, urllib.request, urllib.error, urllib.parse
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

URL = 'https://knciqlbngtmsgmhnbfce.supabase.co'
KEY = 'sb_publishable_YwMLfMra6vzUnfvkn9uqTw_akegqlYp'
HERE = os.path.dirname(os.path.abspath(__file__))


def api(method, path, body=None, prefer=None):
    h = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json',
         'Accept-Profile': 'pack', 'Content-Profile': 'pack'}
    if prefer:
        h['Prefer'] = prefer
    d = json.dumps(body).encode('utf-8') if body is not None else None
    r = urllib.request.Request(URL + path, data=d, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=90) as resp:
            raw = resp.read().decode('utf-8')
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        print('HTTP %d %s: %s' % (e.code, path, e.read().decode('utf-8')[:300])); raise


def iid(name):
    r = api('GET', '/rest/v1/instruments?select=id&name=eq.' + urllib.parse.quote(name))
    if not r:
        print('ERROR: instrument "%s" missing - run manheim_calc_migration.sql first.' % name); sys.exit(1)
    return r[0]['id']


def seed(name, rows):
    i = iid(name)
    api('DELETE', '/rest/v1/pack_data?instrument_id=eq.%d' % i, prefer='return=minimal')
    payload = [{'instrument_id': i, 'obs_date': d, 'value': v} for d, v in rows]
    for k in range(0, len(payload), 1000):
        api('POST', '/rest/v1/pack_data?on_conflict=instrument_id,obs_date',
            body=payload[k:k + 1000], prefer='resolution=merge-duplicates,return=minimal')
    return i


def main():
    data = json.load(open(os.path.join(HERE, 'mh_raw.json')))
    brand_ids = {}
    for name, rows in data['brands'].items():
        brand_ids[name] = seed('OEM: ' + name, rows)
        print('  seeded OEM:', name, len(rows))
    pct = seed('% Cars Sold For Hire', data['pct_hire'])
    tot = seed('Total Cars Sold', data['total_cars'])
    print('  seeded % hire & total cars')

    charts = api('GET', '/rest/v1/charts?select=id,title,pack_order')
    cid = {c['title']: c['id'] for c in charts}

    def wire(title, ctype, rows):
        i = cid[title]
        api('PATCH', '/rest/v1/charts?id=eq.%d' % i, prefer='return=minimal', body={'chart_type': ctype})
        api('DELETE', '/rest/v1/chart_series?chart_id=eq.%d' % i, prefer='return=minimal')
        api('POST', '/rest/v1/chart_series', prefer='return=minimal',
            body=[{'chart_id': i, 'instrument_id': iid_, 'role': role, 'sort_order': si}
                  for si, (role, iid_) in enumerate(rows)])
        print('  wired', title)

    # OEM share: all 16 brands as role 'brand'
    ORDER = ['Toyota', 'Suzuki', 'VW', 'Hyundai', 'Ford', 'GWM/haval', 'Chery', 'Isuzu',
             'Kia', 'Jetour', 'Omoda and Jaecoo', 'Renault', 'Mahindra', 'BMW', 'BYD', 'Nissan']
    wire('OEM Market Share', 'oem_share', [('brand', brand_ids[b]) for b in ORDER])
    wire('12 Month Rolling Cars Sold For Hire', 'hire_rolling', [('pct', pct), ('total', tot)])

    # Clear now-unused series' data (old approach).
    for n in ['OEM Share - China', 'OEM Share - India', 'OEM Share - Motus', 'OEM Share - Toyota',
              'OEM Share - Germany', 'OEM Share - Rest', 'Cars Sold For Hire']:
        r = api('GET', '/rest/v1/instruments?select=id&name=eq.' + urllib.parse.quote(n))
        if r:
            api('DELETE', '/rest/v1/pack_data?instrument_id=eq.%d' % r[0]['id'], prefer='return=minimal')

    # xEV screenshot panel
    XT = 'Global xEVs (BEV + PHEV) Monthly Sales'
    for c in [c for c in charts if c['title'] == XT]:
        api('DELETE', '/rest/v1/charts?id=eq.%d' % c['id'], prefer='return=minimal')
    order = max([c['pack_order'] for c in api('GET', '/rest/v1/charts?select=pack_order')], default=0) + 1
    api('POST', '/rest/v1/charts', prefer='return=minimal', body={
        'title': XT, 'chart_type': 'image', 'category': 'Manheim', 'time_range': 'ALL',
        'in_pack': True, 'pack_order': order,
        'annotation': 'Global BEV + PHEV monthly sales. Source: SNE Research, Bernstein analysis. Paste the latest screenshot.',
    })
    print('  added xEV screenshot panel')
    print('done')


if __name__ == '__main__':
    main()
