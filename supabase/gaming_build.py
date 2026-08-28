"""
Gambling section: seed the external GGR data extracted from "7. Gaming Stats.xlsx"
and build all 29 charts.
  - 22 provincial GGR value charts (GP/WC/KZN/EC/MPUM) + National Total GGR
  - Macau: monthly-revenue vs YoY (dual), daily-average LT/ST (computed),
    Total Visitors + Hotel Occupancy (Bloomberg), GGR per Visitor (computed)
Idempotent. Public key. Run after gaming_migration.sql.
Run: py supabase/gaming_build.py
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
    dedup = {}
    for d, v in rows:
        dedup[d] = v          # keep last value if a date repeats
    payload = [{'instrument_id': i, 'obs_date': d, 'value': v} for d, v in dedup.items()]
    for k in range(0, len(payload), 1000):
        api('POST', '/rest/v1/pack_data?on_conflict=instrument_id,obs_date',
            body=payload[k:k + 1000], prefer='resolution=merge-duplicates,return=minimal')
    return i


def main():
    data = json.load(open(os.path.join(HERE, 'gaming_data.json')))
    ids = {}
    for name, rows in data.items():
        ids[name] = seed(name, rows)
        print('  seeded %-22s %d' % (name, len(rows)))
    visitors = iid('Macau Total Visitors')
    occupancy = iid('Macau Hotel Occupancy Rates')
    ggr = ids['Macau Monthly GGR']

    # (title, chart_type, time_range, [(role, instrument_id), ...])
    def v(title, key):
        return (title, 'value', 'ALL', [('series', ids[key])])
    charts = [
        v('GP Weekly GGR Casino', 'GP Casino'),
        v('GP Weekly GGR LPM', 'GP LPM'),
        v('GP Weekly GGR Bingo', 'GP Bingo'),
        v('GP Weekly GGR Bookmakers', 'GP Bookmakers'),
        v('WC Monthly GGR Casino', 'WC Casino'),
        v('WC Monthly GGR LPM', 'WC LPM'),
        v('WC Monthly GGR Horse Races', 'WC Horse Races'),
        v('WC Monthly GGR Sports Betting', 'WC Sports Betting'),
        v('KZN Monthly GGR Casino', 'KZN Casino'),
        v('KZN Monthly GGR LPM', 'KZN LPM'),
        v('KZN Monthly GGR Bingo', 'KZN Bingo'),
        v('KZN Monthly GGR Horse Racing', 'KZN Horse Racing'),
        v('KZN Monthly GGR Sports Betting', 'KZN Sports Betting'),
        v('KZN Monthly GGR Contingencies', 'KZN Contingencies'),
        v('EC Monthly GGR Casino', 'EC Casino'),
        v('EC Monthly GGR Bingo', 'EC Bingo'),
        v('EC Monthly GGR Horse Racing', 'EC Horse Racing'),
        v('EC Monthly GGR LPM', 'EC LPM'),
        v('MPUM Quarterly GGR Casino', 'MPUM Casino'),
        v('MPUM Quarterly GGR Bingo', 'MPUM Bingo'),
        v('MPUM Quarterly GGR Sports Betting', 'MPUM Sports Betting'),
        v('MPUM Quarterly LPM', 'MPUM LPM'),
        v('National Total GGR', 'National Total GGR'),
        ('Macau YtD Growth vs Monthly Revenue', 'macau_ytd', 'ALL', [('series', ggr)]),
        ('Macau Daily Average GGR LT', 'macau_daily_avg', 'ALL', [('series', ggr)]),
        ('Macau Daily Average GGR ST', 'macau_daily_avg', '5Y', [('series', ggr)]),
        ('Macau Total Visitors', 'value', 'ALL', [('series', visitors)]),
        ('Macau Hotel Occupancy Rates', 'value', 'ALL', [('series', occupancy)]),
        ('Macau GGR per Visitor', 'macau_per_visitor', 'ALL',
         [('ggr', ggr), ('visitors', visitors)]),
    ]

    existing = api('GET', '/rest/v1/charts?select=id,title')
    titles = {c[0] for c in charts}
    for c in [c for c in existing if c['title'] in titles]:
        api('DELETE', '/rest/v1/charts?id=eq.%d' % c['id'], prefer='return=minimal')
    order = max([c['pack_order'] for c in api('GET', '/rest/v1/charts?select=pack_order')], default=0)

    for title, ctype, rng, roles in charts:
        order += 1
        ins = api('POST', '/rest/v1/charts', prefer='return=representation', body={
            'title': title, 'chart_type': ctype, 'category': 'Gaming', 'time_range': rng,
            'in_pack': True, 'pack_order': order,
        })
        cid = ins[0]['id']
        api('POST', '/rest/v1/chart_series', prefer='return=minimal',
            body=[{'chart_id': cid, 'instrument_id': iid_, 'role': role, 'sort_order': si}
                  for si, (role, iid_) in enumerate(roles)])
        print('  built', title)
    print('done - Gambling section (%d charts)' % len(charts))


if __name__ == '__main__':
    main()
