"""
Replace the six Chicken screenshot panels with real charts:
 - Protein Prices        -> 5 manual FNB series (Beef/Mutton/Pork/Poultry/Import)
 - Chicken Price Run Rate-> seasonal overlay of the manual Chicken Price (c/kg)
 - Chicken Price Long Term-> value line of the manual Chicken Price
 - Proxy Feed Price      -> value line of the manual Proxy Feed
 - IQF/Proxy Feed Price  -> ARL share (Bloomberg) vs IQF/Proxy Feed ratio
 - IQF/6-Month Lagged... -> ARL share vs IQF / 6m-lagged Proxy Feed
Manual series are empty until you add data in the app. Idempotent.
Run after chicken_manual_migration.sql.  Run: py supabase/chicken_build_charts.py
"""
import sys, json, urllib.request, urllib.error, urllib.parse
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

URL = 'https://knciqlbngtmsgmhnbfce.supabase.co'
KEY = 'sb_publishable_YwMLfMra6vzUnfvkn9uqTw_akegqlYp'


def api(method, path, body=None, prefer=None):
    h = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json',
         'Accept-Profile': 'pack', 'Content-Profile': 'pack'}
    if prefer:
        h['Prefer'] = prefer
    d = json.dumps(body).encode('utf-8') if body is not None else None
    r = urllib.request.Request(URL + path, data=d, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            raw = resp.read().decode('utf-8')
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        print('HTTP %d %s: %s' % (e.code, path, e.read().decode('utf-8')[:400])); raise


def iid(name):
    r = api('GET', '/rest/v1/instruments?select=id&name=eq.' + urllib.parse.quote(name))
    if not r:
        print('ERROR: instrument "%s" missing - run chicken_manual_migration.sql first.' % name); sys.exit(1)
    return r[0]['id']


# (title, chart_type, [(role, instrument_name), ...], annotation)
CHARTS = [
    ('Protein Prices', 'value', [
        ('series', 'Beef Price'), ('series', 'Mutton Price'), ('series', 'Pork Price'),
        ('series', 'Poultry Price'), ('series', 'Poultry Import Parity')],
     'Beef, Mutton, Pork, Poultry and Import parity (R/ton). Source: FNB Agri.'),
    ('Chicken Price - Run Rate', 'seasonal', [('series', 'Chicken Price')],
     'Chicken price by month, one line per year (c/kg). Source: SAPA, FNB.'),
    ('Chicken Price Long Term C/KG', 'value', [('series', 'Chicken Price')],
     'Long-term chicken price (c/kg). Source: SAPA, FNB.'),
    ('Proxy Feed Price', 'value', [('series', 'Proxy Feed Price')],
     'Proxy broiler feed price (R/ton). Source: Bloomberg, Aylett estimates.'),
    ('IQF/Proxy Feed Price', 'iqf_ratio', [
        ('share', 'ARL Share Price'), ('iqf', 'IQF Price'), ('feed', 'Proxy Feed Price')],
     'ARL share price vs IQF / Proxy Feed ratio. Source: SAPA, FNB, Bloomberg, Aylett estimates.'),
    ('IQF/6-Month Lagged Proxy Feed Price', 'iqf_ratio_lag', [
        ('share', 'ARL Share Price'), ('iqf', 'IQF Price'), ('feed', 'Proxy Feed Price')],
     'ARL share price vs IQF / 6-month-lagged Proxy Feed ratio. Source: SAPA, FNB, Bloomberg, Aylett estimates.'),
]


def main():
    existing = api('GET', '/rest/v1/charts?select=id,title,pack_order')
    titles = {t for t, _, _, _ in CHARTS}
    for c in [c for c in existing if c['title'] in titles]:
        api('DELETE', '/rest/v1/charts?id=eq.%d' % c['id'], prefer='return=minimal')

    existing = api('GET', '/rest/v1/charts?select=pack_order')
    order = max([c['pack_order'] for c in existing], default=0)

    for title, ctype, roles, ann in CHARTS:
        order += 1
        ins = api('POST', '/rest/v1/charts', prefer='return=representation', body={
            'title': title, 'chart_type': ctype, 'category': 'Chicken', 'time_range': 'ALL',
            'in_pack': True, 'pack_order': order, 'annotation': ann,
        })
        cid = ins[0]['id']
        rows = [{'chart_id': cid, 'instrument_id': iid(nm), 'role': role, 'sort_order': i}
                for i, (role, nm) in enumerate(roles)]
        api('POST', '/rest/v1/chart_series', prefer='return=minimal', body=rows)
        print('built', title, '(%s, %d series)' % (ctype, len(rows)))
    print('done - 6 Chicken charts')


if __name__ == '__main__':
    main()
