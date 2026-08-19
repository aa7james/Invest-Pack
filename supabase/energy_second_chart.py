"""
Restore the second 'Energy Prices' chart (indexed from 2012-11-29) that pairs
with the long-run one (indexed from 2001). Non-destructive; uses the public key.

Run: py supabase/energy_second_chart.py
"""
import sys
import json
import urllib.request
import urllib.error

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

URL = 'https://knciqlbngtmsgmhnbfce.supabase.co'
KEY = 'sb_publishable_YwMLfMra6vzUnfvkn9uqTw_akegqlYp'

FIRST_OLD = 'Energy Prices (Indexed)'
FIRST_NEW = 'Energy Prices (Indexed from 2001)'
SECOND = 'Energy Prices (Indexed from 2012)'
SERIES = [('Brent Crude Oil', 'USD'), ('Natural Gas (Henry Hub)', 'USD'),
          ('EU Carbon Prices', 'USD'), ('Thermal Coal', 'USD')]


def api(method, path, body=None, prefer=None):
    headers = {'apikey': KEY, 'Authorization': f'Bearer {KEY}',
               'Content-Type': 'application/json',
               'Accept-Profile': 'pack', 'Content-Profile': 'pack'}
    if prefer:
        headers['Prefer'] = prefer
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(URL + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode('utf-8')
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        print(f'HTTP {e.code} on {method} {path}: {e.read().decode("utf-8")[:400]}')
        raise


def main():
    insts = api('GET', '/rest/v1/instruments?select=id,name,currency&limit=10000')
    lookup = {(r['name'], r.get('currency') or ''): r['id'] for r in insts}

    charts = api('GET', '/rest/v1/charts?select=id,title,pack_order')

    # Rename the existing long-run chart if still on the old title.
    first = next((c for c in charts if c['title'] in (FIRST_OLD, FIRST_NEW)), None)
    if first and first['title'] == FIRST_OLD:
        api('PATCH', f'/rest/v1/charts?id=eq.{first["id"]}', prefer='return=minimal', body={'title': FIRST_NEW})
        print(f'Renamed "{FIRST_OLD}" -> "{FIRST_NEW}"')

    # Idempotent: remove any existing second chart.
    for c in [c for c in charts if c['title'] == SECOND]:
        api('DELETE', f'/rest/v1/charts?id=eq.{c["id"]}', prefer='return=minimal')

    max_order = max([c['pack_order'] for c in charts], default=0)
    created = api('POST', '/rest/v1/charts', prefer='return=representation', body={
        'title': SECOND, 'chart_type': 'index', 'time_range': '2012-11-29',
        'category': 'Energy', 'in_pack': True, 'pack_order': max_order + 1,
    })
    cid = created[0]['id']
    rows = [{'chart_id': cid, 'instrument_id': lookup[(n, c)], 'role': 'series', 'sort_order': i}
            for i, (n, c) in enumerate(SERIES)]
    api('POST', '/rest/v1/chart_series', prefer='return=minimal', body=rows)

    # Place the second chart right after the first.
    charts = api('GET', '/rest/v1/charts?select=id,title,pack_order')
    others = sorted([c for c in charts if c['id'] != cid], key=lambda c: c['pack_order'])
    ordered = []
    for c in others:
        ordered.append(c)
        if c['title'] == FIRST_NEW:
            ordered.append(next(c2 for c2 in charts if c2['id'] == cid))
    for i, c in enumerate(ordered, 1):
        if c['pack_order'] != i:
            api('PATCH', f'/rest/v1/charts?id=eq.{c["id"]}', prefer='return=minimal', body={'pack_order': i})

    print(f'Added "{SECOND}" right after "{FIRST_NEW}".')


if __name__ == '__main__':
    main()
