"""
Make the Gaming charts match the PDF:
 - National Total GGR -> stacked bar by mode (Casino/Bingo/LPM/Betting)
 - Macau Total Visitors -> stacked bar (Chinese + rest)
 - Macau Daily Avg LT/ST, GGR per Visitor -> bars (handled by builders)
 - Provincial GGR charts -> show from 2019 (time_range) like the pack
Idempotent. Public key. Run after the National-modes SQL migration.
Run: py supabase/gaming_polish.py
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
        print('ERROR: instrument "%s" missing.' % name); sys.exit(1)
    return r[0]['id']


def seed(name, rows):
    i = iid(name)
    api('DELETE', '/rest/v1/pack_data?instrument_id=eq.%d' % i, prefer='return=minimal')
    payload = [{'instrument_id': i, 'obs_date': d, 'value': v} for d, v in rows]
    for k in range(0, len(payload), 1000):
        api('POST', '/rest/v1/pack_data?on_conflict=instrument_id,obs_date',
            body=payload[k:k + 1000], prefer='resolution=merge-duplicates,return=minimal')
    return i


def wire(title, ctype, rows, time_range=None):
    charts = api('GET', '/rest/v1/charts?select=id,title&title=eq.' + urllib.parse.quote(title))
    if not charts:
        print('  WARN chart not found:', title); return
    cid = charts[0]['id']
    body = {'chart_type': ctype}
    if time_range:
        body['time_range'] = time_range
    api('PATCH', '/rest/v1/charts?id=eq.%d' % cid, prefer='return=minimal', body=body)
    if rows is not None:
        api('DELETE', '/rest/v1/chart_series?chart_id=eq.%d' % cid, prefer='return=minimal')
        api('POST', '/rest/v1/chart_series', prefer='return=minimal',
            body=[{'chart_id': cid, 'instrument_id': iid_, 'role': role, 'sort_order': si}
                  for si, (role, iid_) in enumerate(rows)])
    print('  wired', title)


def main():
    modes = json.load(open(os.path.join(HERE, 'nat_modes.json')))
    ids = {name: seed(name, rows) for name, rows in modes.items()}
    print('  seeded National modes')

    # National Total GGR -> stacked bar by mode
    wire('National Total GGR', 'ggr_stack', [
        ('series', ids['National Casino']), ('series', ids['National Bingo']),
        ('series', ids['National LPM']), ('series', ids['National Betting'])])

    # Macau Total Visitors -> stacked bar (Chinese + rest)
    wire('Macau Total Visitors', 'visitors_stack', [
        ('chinese', iid('Macau Chinese Visitors')), ('total', iid('Macau Total Visitors'))])

    # Provincial GGR charts -> show from 2019 like the pack
    prov = [
        'GP Weekly GGR Casino', 'GP Weekly GGR LPM', 'GP Weekly GGR Bingo', 'GP Weekly GGR Bookmakers',
        'WC Monthly GGR Casino', 'WC Monthly GGR LPM', 'WC Monthly GGR Horse Races', 'WC Monthly GGR Sports Betting',
        'KZN Monthly GGR Casino', 'KZN Monthly GGR LPM', 'KZN Monthly GGR Bingo', 'KZN Monthly GGR Horse Racing',
        'KZN Monthly GGR Sports Betting', 'KZN Monthly GGR Contingencies',
        'EC Monthly GGR Casino', 'EC Monthly GGR Bingo', 'EC Monthly GGR Horse Racing', 'EC Monthly GGR LPM',
        'MPUM Quarterly GGR Casino', 'MPUM Quarterly GGR Bingo', 'MPUM Quarterly GGR Sports Betting', 'MPUM Quarterly LPM',
    ]
    for t in prov:
        wire(t, 'value', None, time_range='2019-01-01')
    print('done')


if __name__ == '__main__':
    main()
