"""
Rewire the Chicken charts so nothing is entered twice and the feed/ratio charts
are computed (not manual):
 - Run Rate & Long Term  -> use the single 'Poultry Price' series (the chicken price)
 - Proxy Feed Price       -> computed: 0.67*Maize(YW1) + 0.33*0.9229*SSPPSBID,
                              with stored history fallback (Proxy Feed Price series)
 - IQF/Proxy & IQF/6m-lag -> ARL share vs (Poultry/100)*1000 / Proxy Feed
Idempotent. Public key. Run: py supabase/chicken_rewire.py
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


def main():
    insts = api('GET', '/rest/v1/instruments?select=id,name,bloomberg_ticker,category')
    chick = [i for i in insts if i['category'] == 'Chicken']

    def by_name(n):
        m = [i for i in chick if i['name'] == n]
        if not m:
            print('missing instrument:', n); sys.exit(1)
        return m[0]['id']

    def by_ticker(sub):
        m = [i for i in chick if (i['bloomberg_ticker'] or '').replace(' ', '').startswith(sub)]
        if not m:
            print('missing ticker:', sub); sys.exit(1)
        return m[0]['id']

    poultry = by_name('Poultry Price')
    proxy_store = by_name('Proxy Feed Price')
    arl = by_name('ARL Share Price')
    maize = by_ticker('YW1')
    ssp = by_ticker('SSPPSBID')

    charts = api('GET', '/rest/v1/charts?select=id,title')
    cid = {c['title']: c['id'] for c in charts}

    def wire(title, ctype, rows):
        i = cid[title]
        api('PATCH', '/rest/v1/charts?id=eq.%d' % i, prefer='return=minimal', body={'chart_type': ctype})
        api('DELETE', '/rest/v1/chart_series?chart_id=eq.%d' % i, prefer='return=minimal')
        api('POST', '/rest/v1/chart_series', prefer='return=minimal',
            body=[{'chart_id': i, 'instrument_id': iid, 'role': role, 'sort_order': si}
                  for si, (role, iid) in enumerate(rows)])
        print('wired', title)

    wire('Chicken Price - Run Rate', 'seasonal', [('series', poultry)])
    wire('Chicken Price Long Term C/KG', 'value', [('series', poultry)])
    wire('Proxy Feed Price', 'proxy_feed',
         [('maize', maize), ('soya', ssp), ('feedstore', proxy_store)])
    wire('IQF/Proxy Feed Price', 'iqf_ratio',
         [('share', arl), ('poultry', poultry), ('maize', maize), ('soya', ssp), ('feedstore', proxy_store)])
    wire('IQF/6-Month Lagged Proxy Feed Price', 'iqf_ratio_lag',
         [('share', arl), ('poultry', poultry), ('maize', maize), ('soya', ssp), ('feedstore', proxy_store)])

    # Retire the now-unused duplicate manual series' data (instruments left empty).
    for n in ['Chicken Price', 'IQF Price']:
        m = [i for i in chick if i['name'] == n]
        if m:
            api('DELETE', '/rest/v1/pack_data?instrument_id=eq.%d' % m[0]['id'], prefer='return=minimal')
            print('cleared unused', n)
    print('done')


if __name__ == '__main__':
    main()
