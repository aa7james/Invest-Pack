"""
Load the Electricity Consumed (SA) history into pack_data using the PUBLIC key.
Requires electricity_migration.sql to have been run first (creates the manual
instrument + the RLS policy that lets the public key write manual data).

Run: py supabase/load_electricity.py
"""
import os
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
HERE = os.path.dirname(os.path.abspath(__file__))


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
        print(f'HTTP {e.code} on {method} {path}: {e.read().decode("utf-8")[:400]}')
        raise


def main():
    insts = api('GET', "/rest/v1/instruments?select=id,name,source&name=eq.Electricity Consumed (SA)".replace(' ', '%20'))
    if not insts:
        print('ERROR: instrument not found. Run electricity_migration.sql first.')
        sys.exit(1)
    iid = insts[0]['id']
    print(f'Instrument id = {iid} (source={insts[0].get("source")})')

    rows = json.load(open(os.path.join(HERE, 'electricity_data.json')))
    payload = [{'instrument_id': iid, 'obs_date': d, 'value': v} for d, v in rows]

    B = 2000
    total = 0
    for i in range(0, len(payload), B):
        batch = payload[i:i + B]
        api('POST', '/rest/v1/pack_data?on_conflict=instrument_id,obs_date',
            body=batch, prefer='resolution=merge-duplicates,return=minimal')
        total += len(batch)
        print(f'  loaded {total}/{len(payload)}')
    print(f'DONE. Loaded {total} electricity datapoints.')


if __name__ == '__main__':
    main()
