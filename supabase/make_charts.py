"""
Create the 50 investment-pack charts in Supabase using the PUBLIC publishable
key (no secret needed). Wipes existing charts, then rebuilds the pack.

Run via "MAKE CHARTS.bat". Requires the pack.charts / pack.chart_series tables
to already exist (run charts_schema.sql once in the Supabase SQL Editor first).
"""
import os
import sys
import json
import urllib.request
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _gen_charts import CATALOG, KNOWN  # noqa: E402

URL = 'https://knciqlbngtmsgmhnbfce.supabase.co'
KEY = 'sb_publishable_YwMLfMra6vzUnfvkn9uqTw_akegqlYp'


def api(method, path, body=None, prefer=None):
    headers = {
        'apikey': KEY, 'Authorization': f'Bearer {KEY}',
        'Content-Type': 'application/json',
        'Accept-Profile': 'pack', 'Content-Profile': 'pack',
    }
    if prefer:
        headers['Prefer'] = prefer
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(URL + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode('utf-8')
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        msg = e.read().decode('utf-8')
        if e.code == 404 or 'does not exist' in msg or 'relation' in msg.lower():
            print('\nERROR: the chart tables do not exist yet.')
            print('Run supabase/charts_schema.sql once in the Supabase SQL Editor, then retry.\n')
        else:
            print(f'HTTP {e.code} on {method} {path}: {msg[:400]}')
        raise


def main():
    print('Fetching instruments...')
    insts = api('GET', '/rest/v1/instruments?select=id,name,currency&limit=10000')
    lookup = {(r['name'], r.get('currency') or ''): r['id'] for r in insts}

    print('Clearing existing charts...')
    api('DELETE', '/rest/v1/charts?id=gte.0', prefer='return=minimal')

    made = 0
    for order, entry in enumerate(CATALOG, 1):
        title, typ, rng, series = entry[0], entry[1], entry[2], entry[3]
        annot = entry[4] if len(entry) > 4 else None

        chart = api('POST', '/rest/v1/charts', prefer='return=representation', body={
            'title': title, 'chart_type': typ, 'time_range': rng,
            'in_pack': True, 'pack_order': order, 'annotation': annot,
        })
        cid = chart[0]['id']

        rows = []
        if typ == 'spread':
            _, a, b = series
            rows.append({'chart_id': cid, 'instrument_id': lookup[(a[0], a[1])], 'role': 'spread_a', 'sort_order': 0})
            rows.append({'chart_id': cid, 'instrument_id': lookup[(b[0], b[1])], 'role': 'spread_b', 'sort_order': 1})
        else:
            for i, (nm, ccy) in enumerate(series):
                rows.append({'chart_id': cid, 'instrument_id': lookup[(nm, ccy)], 'role': 'series', 'sort_order': i})
        api('POST', '/rest/v1/chart_series', prefer='return=minimal', body=rows)
        made += 1
        print(f'  [{made}/{len(CATALOG)}] {title}')

    print(f'\nDONE. Created {made} charts and added them to the pack.')


if __name__ == '__main__':
    main()
