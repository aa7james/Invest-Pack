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

# Windows consoles default to cp1252 and choke on characters like "−"; make prints safe.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


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

    # Resolve every series first; skip a chart (with a warning) if an instrument
    # isn't in the DB yet, so this is safe to run before optional migrations.
    made = 0
    order = 0
    for entry in CATALOG:
        title, typ, rng, series = entry[0], entry[1], entry[2], entry[3]
        annot = entry[4] if len(entry) > 4 else None

        if typ in ('spread', 'nitrogen_spread'):
            pairs = [(series[1], 'spread_a'), (series[2], 'spread_b')]
        else:
            pairs = [((nm, ccy), 'series') for nm, ccy in series]

        missing = [p for (p, _) in pairs if (p[0], p[1]) not in lookup]
        if missing:
            print(f'  SKIP "{title}" - instrument(s) not found: {missing}')
            continue

        order += 1
        chart = api('POST', '/rest/v1/charts', prefer='return=representation', body={
            'title': title, 'chart_type': typ, 'time_range': rng,
            'in_pack': True, 'pack_order': order, 'annotation': annot,
        })
        cid = chart[0]['id']

        rows = [{'chart_id': cid, 'instrument_id': lookup[(p[0], p[1])], 'role': role, 'sort_order': i}
                for i, (p, role) in enumerate(pairs)]
        api('POST', '/rest/v1/chart_series', prefer='return=minimal', body=rows)
        made += 1
        print(f'  [{made}] {title}')

    print(f'\nDONE. Created {made} charts and added them to the pack.')


if __name__ == '__main__':
    main()
