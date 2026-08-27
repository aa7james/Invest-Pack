"""
Manheim / Jan's Garage: seed the external (non-Bloomberg) data extracted from
"8. Manheim.xlsm" and build the five charts.
  1. SA New Passenger Vehicle Volumes - 12 Month Rolling  (rolling12 of monthly volumes)
  2. 12 Month Rolling Cars Sold For Hire                  (rolling12 of monthly hire)
  3. OEM Market Share                                     (6 group % lines)
  4. Wesbank ZAR Value of New Cars Financed               (value line)
  5. Total No. Wesbank Vehicle Finance Applications       (stacked area: new + used)
Idempotent. Public key. Run after manheim_migration.sql.
Run: py supabase/manheim_build.py
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
        print('ERROR: instrument "%s" missing - run manheim_migration.sql first.' % name); sys.exit(1)
    return r[0]['id']


def seed(name, rows):
    i = iid(name)
    api('DELETE', '/rest/v1/pack_data?instrument_id=eq.%d' % i, prefer='return=minimal')
    payload = [{'instrument_id': i, 'obs_date': d, 'value': v} for d, v in rows]
    for k in range(0, len(payload), 1000):
        api('POST', '/rest/v1/pack_data?on_conflict=instrument_id,obs_date',
            body=payload[k:k + 1000], prefer='resolution=merge-duplicates,return=minimal')
    print('  seeded %-34s %d rows' % (name, len(payload)))
    return i


def main():
    data = json.load(open(os.path.join(HERE, 'manheim_data.json')))
    sa = seed('SA New Passenger Vehicle Volumes', data['sa_volumes'])
    hire = seed('Cars Sold For Hire', data['hire'])
    china = seed('OEM Share - China', data['shares']['China'])
    india = seed('OEM Share - India', data['shares']['India'])
    motus = seed('OEM Share - Motus', data['shares']['Motus'])
    toyota = seed('OEM Share - Toyota', data['shares']['Toyota'])
    germany = seed('OEM Share - Germany', data['shares']['Germany'])
    rest = seed('OEM Share - Rest', data['shares']['Rest'])
    wval = seed('Wesbank New Car Value Financed', data['wesbank_value'])
    wnew = seed('Wesbank New Car Applications', data['wesbank_new'])
    wused = seed('Wesbank Used Car Applications', data['wesbank_used'])

    # (title, chart_type, [(role, instrument_id), ...], annotation)
    charts = [
        ('SA New Passenger Vehicle Volumes - 12 Month Rolling', 'rolling12',
         [('series', sa)], 'Rolling 12-month total of SA new passenger vehicle sales. Source: NAAMSA.'),
        ('12 Month Rolling Cars Sold For Hire', 'rolling12',
         [('series', hire)], 'Rolling 12-month total of cars sold for hire. Source: Lightstone / Manheim.'),
        ('OEM Market Share', 'value',
         [('series', china), ('series', india), ('series', motus), ('series', toyota),
          ('series', germany), ('series', rest)],
         'New-vehicle market share by OEM group (%). Source: Lightstone / NAAMSA.'),
        ('Wesbank ZAR Value of New Cars Financed', 'value',
         [('series', wval)], 'Average ZAR value of new cars financed. Source: Wesbank.'),
        ('Total No. Wesbank Vehicle Finance Applications', 'stacked_area',
         [('series', wnew), ('series', wused)], 'Monthly new + used vehicle finance applications. Source: Wesbank.'),
    ]

    existing = api('GET', '/rest/v1/charts?select=id,title,pack_order')
    titles = {t for t, _, _, _ in charts}
    for c in [c for c in existing if c['title'] in titles]:
        api('DELETE', '/rest/v1/charts?id=eq.%d' % c['id'], prefer='return=minimal')
    order = max([c['pack_order'] for c in api('GET', '/rest/v1/charts?select=pack_order')], default=0)

    for title, ctype, roles, ann in charts:
        order += 1
        ins = api('POST', '/rest/v1/charts', prefer='return=representation', body={
            'title': title, 'chart_type': ctype, 'category': 'Manheim', 'time_range': 'ALL',
            'in_pack': True, 'pack_order': order, 'annotation': ann,
        })
        cid = ins[0]['id']
        api('POST', '/rest/v1/chart_series', prefer='return=minimal',
            body=[{'chart_id': cid, 'instrument_id': iid_, 'role': role, 'sort_order': si}
                  for si, (role, iid_) in enumerate(roles)])
        print('  built', title)
    print('done - Manheim section')


if __name__ == '__main__':
    main()
