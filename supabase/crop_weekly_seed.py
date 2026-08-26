"""
Seed the weekly Maize Crop Progress data (Prod deliveries + Adjustments, in tons)
and wire the chart to the 'crop_progress' type. The app computes Week Total and
the cumulative Prog Total, so you enter the raw weekly numbers exactly like the
SAGIS report. Safe to re-run. Run after crop_weekly_migration.sql.
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


def inst_id(name):
    r = api('GET', '/rest/v1/instruments?select=id&name=eq.' + urllib.parse.quote(name))
    if not r:
        print('ERROR: instrument "%s" missing - run crop_weekly_migration.sql first.' % name); sys.exit(1)
    return r[0]['id']


def seed(iid, rows):
    api('DELETE', '/rest/v1/pack_data?instrument_id=eq.%d' % iid, prefer='return=minimal')
    payload = [{'instrument_id': iid, 'obs_date': d, 'value': v} for d, v in rows]
    for i in range(0, len(payload), 1000):
        api('POST', '/rest/v1/pack_data?on_conflict=instrument_id,obs_date',
            body=payload[i:i + 1000], prefer='resolution=merge-duplicates,return=minimal')
    return len(payload)


def main():
    did = inst_id('SA Maize Prod Deliveries')
    aid = inst_id('SA Maize Adjustments')

    deliveries = json.load(open(os.path.join(HERE, 'crop_deliveries.json')))
    adjustments = json.load(open(os.path.join(HERE, 'crop_adjustments.json')))
    print('seeded deliveries:', seed(did, deliveries))
    print('seeded adjustments:', seed(aid, adjustments))

    c = api('GET', '/rest/v1/charts?select=id&title=eq.' + urllib.parse.quote('Maize Crop Progress'))
    if not c:
        print('WARN: Maize Crop Progress chart not found'); return
    cid = c[0]['id']
    api('PATCH', '/rest/v1/charts?id=eq.%d' % cid, prefer='return=minimal',
        body={'chart_type': 'crop_progress', 'time_range': 'ALL', 'image_data': None})
    api('DELETE', '/rest/v1/chart_series?chart_id=eq.%d' % cid, prefer='return=minimal')
    api('POST', '/rest/v1/chart_series', prefer='return=minimal', body=[
        {'chart_id': cid, 'instrument_id': did, 'role': 'deliveries', 'sort_order': 0},
        {'chart_id': cid, 'instrument_id': aid, 'role': 'adjustments', 'sort_order': 1},
    ])
    print('wired Maize Crop Progress -> crop_progress (deliveries + adjustments)')


if __name__ == '__main__':
    main()
