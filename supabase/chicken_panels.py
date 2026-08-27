"""
Add the Chicken Dashboard as six screenshot panels (category 'Chicken'), matching
the pack order. All are external/derived sources (FNB, SAPA, Aylett estimates),
so they are image panels you paste the latest screenshot into each month.
Idempotent: re-running replaces the same six panels. Public key.
Run: py supabase/chicken_panels.py
"""
import sys, json, urllib.request, urllib.error
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

URL = 'https://knciqlbngtmsgmhnbfce.supabase.co'
KEY = 'sb_publishable_YwMLfMra6vzUnfvkn9uqTw_akegqlYp'

PANELS = [
    ('Protein Prices',
     'Beef, Mutton, Pork, Poultry and Import parity (R/ton). Source: FNB Agri. Paste the latest screenshot.'),
    ('Chicken Price - Run Rate',
     'Chicken price by month, one line per year (cents per kg). Source: SAPA, FNB. Paste the latest screenshot.'),
    ('Chicken Price Long Term C/KG',
     'Long-term chicken price (cents per kg). Source: SAPA, FNB. Paste the latest screenshot.'),
    ('Proxy Feed Price',
     'Proxy broiler feed price. Source: Bloomberg, Aylett estimates. Paste the latest screenshot.'),
    ('IQF/Proxy Feed Price',
     'ARL share price vs IQF / Proxy Feed ratio. Source: SAPA, FNB, Bloomberg, Aylett estimates. Paste the latest screenshot.'),
    ('IQF/6-Month Lagged Proxy Feed Price',
     'ARL share price vs IQF / 6-month-lagged Proxy Feed ratio. Source: SAPA, FNB, Bloomberg, Aylett estimates. Paste the latest screenshot.'),
]


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


def main():
    charts = api('GET', '/rest/v1/charts?select=id,title,pack_order')
    titles = {t for t, _ in PANELS}
    for c in [c for c in charts if c['title'] in titles]:
        api('DELETE', '/rest/v1/charts?id=eq.%d' % c['id'], prefer='return=minimal')

    charts = api('GET', '/rest/v1/charts?select=pack_order')
    order = max([c['pack_order'] for c in charts], default=0)
    for title, ann in PANELS:
        order += 1
        api('POST', '/rest/v1/charts', prefer='return=minimal', body={
            'title': title, 'chart_type': 'image', 'category': 'Chicken', 'time_range': 'ALL',
            'in_pack': True, 'pack_order': order, 'annotation': ann,
        })
        print('added', title)
    print('done - Chicken section has %d panels' % len(PANELS))


if __name__ == '__main__':
    main()
