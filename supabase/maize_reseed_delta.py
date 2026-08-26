"""
Re-seed SA Maize Crop Progress as INCREMENTAL monthly deliveries (million tons).
The app cumulates these per season to draw the progress curve, so you enter the
month's delivered amount (the 'original number') and the chart works out the
running total. Safe to re-run: it clears the old points first.
Public key only (manual series). Run after maize_migration.sql.
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
    d = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(URL + path, data=d, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        print('HTTP %d %s: %s' % (e.code, path, e.read().decode()[:300])); raise


def main():
    inst = api('GET', '/rest/v1/instruments?select=id&name=eq.' + urllib.parse.quote('SA Maize Crop Progress'))
    if not inst:
        print('ERROR: instrument missing - run maize_migration.sql first.'); sys.exit(1)
    iid = inst[0]['id']

    # Clear any previous points (we are switching from cumulative to incremental).
    api('DELETE', '/rest/v1/pack_data?instrument_id=eq.%d' % iid, prefer='return=minimal')

    rows = json.load(open(os.path.join(HERE, 'maize_delta.json')))
    payload = [{'instrument_id': iid, 'obs_date': d, 'value': v} for d, v in rows]
    for i in range(0, len(payload), 1000):
        api('POST', '/rest/v1/pack_data?on_conflict=instrument_id,obs_date',
            body=payload[i:i + 1000], prefer='resolution=merge-duplicates,return=minimal')
    print('re-seeded', len(payload), 'incremental monthly points')

    c = api('GET', '/rest/v1/charts?select=id&title=eq.' + urllib.parse.quote('Maize Crop Progress'))
    if not c:
        print('WARN: Maize Crop Progress chart not found'); return
    cid = c[0]['id']
    api('PATCH', '/rest/v1/charts?id=eq.%d' % cid, prefer='return=minimal',
        body={'chart_type': 'seasonal', 'time_range': 'ALL', 'image_data': None})
    api('DELETE', '/rest/v1/chart_series?chart_id=eq.%d' % cid, prefer='return=minimal')
    api('POST', '/rest/v1/chart_series', prefer='return=minimal',
        body=[{'chart_id': cid, 'instrument_id': iid, 'role': 'series', 'sort_order': 0}])
    print('confirmed Maize Crop Progress -> seasonal chart')


if __name__ == '__main__':
    main()
