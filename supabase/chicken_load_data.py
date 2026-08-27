"""
Load the non-Bloomberg Chicken Dashboard data extracted from
"5. Chicken Dashboard.xlsm" into the manual series in Supabase.
  Data sheet  -> Beef/Mutton/Pork/Poultry/Import parity (c/kg), + Chicken Price = Poultry
  Profit Data -> Proxy Feed Price (R/ton), IQF Price = FNB IQF (R/kg)
Idempotent (clears each series first). Public key. Run after the manual
instruments exist (chicken_manual_migration.sql).
Run: py supabase/chicken_load_data.py
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
    print('  %-22s %d rows' % (name, len(payload)))


def main():
    data = json.load(open(os.path.join(HERE, 'chx_data.json')))
    prot = data['protein']
    seed('Beef Price', prot['Beef'])
    seed('Mutton Price', prot['Mutton'])
    seed('Pork Price', prot['Pork'])
    seed('Poultry Price', prot['Poultry'])
    seed('Poultry Import Parity', prot['Import parity'])
    seed('Chicken Price', prot['Poultry'])        # run-rate / long-term = poultry price
    seed('Proxy Feed Price', data['proxy'])
    seed('IQF Price', data['iqf'])
    print('done - chicken data loaded')


if __name__ == '__main__':
    main()
