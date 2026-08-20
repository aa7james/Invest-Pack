"""
Metals section — add the Bloomberg-computable charts missing from the first pass:
 - recent 10Y actual-price companions for each metal / steel ingredient
 - second index base (from 2016) for Base Metals + Steel Making (rename existing to 2001)
 - fix PGMs to index from 2022; clarify PGM vs Equities title
 - Platinum/Gold ratio
 - Iron Ore Lump Premium recent (spread)
Then order the Metals section to match the pack (pages 30-70).
Non-destructive; public key. (Computed correlation/sponge + screenshot panels are separate.)
"""
import sys, json, urllib.request, urllib.error
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

URL = 'https://knciqlbngtmsgmhnbfce.supabase.co'
KEY = 'sb_publishable_YwMLfMra6vzUnfvkn9uqTw_akegqlYp'
CAT_ORDER = ['Chemicals', 'Energy', 'Metals', 'Soft Commodities', 'Chicken', 'Gaming', 'Manheim', 'Other']


def api(method, path, body=None, prefer=None):
    h = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json',
         'Accept-Profile': 'pack', 'Content-Profile': 'pack'}
    if prefer:
        h['Prefer'] = prefer
    d = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(URL + path, data=d, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        print('HTTP %d %s: %s' % (e.code, path, e.read().decode()[:300])); raise


def main():
    insts = api('GET', '/rest/v1/instruments?select=id,name,currency,category&limit=10000')
    lookup = {(r['name'], r.get('currency') or ''): r['id'] for r in insts}
    inst_cat = {r['id']: r['category'] for r in insts}
    charts = api('GET', '/rest/v1/charts?select=id,title,pack_order,category')
    have = {c['title']: c for c in charts}

    def new_chart(title, ctype, rng, series):
        if title in have:
            return
        created = api('POST', '/rest/v1/charts', prefer='return=representation', body={
            'title': title, 'chart_type': ctype, 'time_range': rng,
            'category': 'Metals', 'in_pack': True, 'pack_order': 9999})
        cid = created[0]['id']
        rows = [{'chart_id': cid, 'instrument_id': lookup[k], 'role': role, 'sort_order': i}
                for i, (k, role) in enumerate(series)]
        api('POST', '/rest/v1/chart_series', prefer='return=minimal', body=rows)
        print('created', title)

    S = lambda name, ccy='USD': ((name, ccy), 'series')
    # recent 10Y actual-price companions
    for title, name in [('LME Aluminium (10Y)', 'Aluminium'), ('LME Copper (10Y)', 'Copper'),
                        ('LME Lead (10Y)', 'Lead'), ('LME Nickel (10Y)', 'Nickel'),
                        ('LME Zinc (10Y)', 'Zinc'), ('Gold (10Y)', 'Gold'),
                        ('Iron Ore 62% (10Y)', 'Iron Ore 62%'), ('Iron Ore Lump (10Y)', 'Iron Ore Lump'),
                        ('Hard Coking Coal (10Y)', 'Hard Coking Coal'), ('Manganese (10Y)', 'Mangenese')]:
        new_chart(title, 'value', '10Y', [S(name)])

    # Iron Ore Lump Premium recent (spread)
    new_chart('Iron Ore Lump Premium (10Y)', 'spread', '10Y',
              [(('Iron Ore Lump', 'USD'), 'spread_a'), (('Iron Ore 62%', 'USD'), 'spread_b')])

    # 2016 index bases
    new_chart('Base Metals Index (Indexed from 2016)', 'index', '2016-06-01',
              [S('Aluminium'), S('Copper'), S('Lead'), S('Nickel'), S('Zinc')])
    new_chart('Steel Making Ingredients (Indexed from 2016)', 'index', '2016-05-31',
              [S('Iron Ore 62%'), S('Iron Ore Lump'), S('Hard Coking Coal'), S('Mangenese')])

    # Platinum/Gold ratio
    new_chart('Platinum/Gold', 'ratio', 'ALL',
              [(('Platinum', 'USD'), 'spread_a'), (('Gold', 'USD'), 'spread_b')])

    # Renames / base fixes
    def rename(old, new, patch=None):
        c = have.get(old)
        if c:
            body = {'title': new}
            if patch:
                body.update(patch)
            api('PATCH', '/rest/v1/charts?id=eq.%d' % c['id'], prefer='return=minimal', body=body)
            print('renamed', old, '->', new)
    rename('Base Metals Index', 'Base Metals Index (Indexed from 2001)')
    rename('Steel Making Ingredients (Indexed)', 'Steel Making Ingredients (Indexed from 2001)')
    rename('PGMs (Indexed)', 'PGMs (Indexed from 2022)', {'time_range': '2022-01-01'})
    rename('PGM vs Equities (Indexed)', 'PGM vs Equities (Indexed from 2001)')

    # --- reorder Metals to match the pack ---
    METALS_ORDER = [
        'Base Metals Index (Indexed from 2016)', 'Base Metals Index (Indexed from 2001)',
        'LME Aluminium (10Y)', 'LME Aluminium', 'LME Copper (10Y)', 'LME Copper',
        'LME Lead (10Y)', 'LME Lead', 'LME Nickel (10Y)', 'LME Nickel',
        'LME Zinc (10Y)', 'LME Zinc', 'Gold (10Y)', 'Gold',
        'PGMs (Indexed from 2022)', 'PGM vs Equities (Indexed from 2001)',
        'Platinum/Gold Correlation', 'Platinum/Gold', 'Platinum Lease Rates',
        'NYMEX Exchange Stocks', 'Sponge Premium (Proxy)', 'Platinum ETF Holdings',
        'Palladium ETF Holdings', 'Rhodium ETF Holdings (Proxy)', 'Global Rough Diamond Index',
        'Steel Making Ingredients (Indexed from 2016)', 'Steel Making Ingredients (Indexed from 2001)',
        'Iron Ore 62% (10Y)', 'Iron Ore 62%', 'Iron Ore Lump (10Y)', 'Iron Ore Lump',
        'Iron Ore Lump Premium (10Y)', 'Iron Ore Lump Premium', 'Hard Coking Coal (10Y)', 'Hard Coking Coal',
        'Manganese (10Y)', 'Manganese', 'Commodity Producers Capex',
        'Commodity Producers Capex (Estimates)', 'Pre-owned Watch Market', 'Investec Mining Clock',
    ]
    charts = api('GET', '/rest/v1/charts?select=id,title,pack_order,category')
    series = api('GET', '/rest/v1/chart_series?select=chart_id,instrument_id,sort_order')
    first_inst = {}
    for s in sorted(series, key=lambda x: x['sort_order']):
        first_inst.setdefault(s['chart_id'], s['instrument_id'])

    def cat_of(c):
        if c.get('category'):
            return c['category']
        iid = first_inst.get(c['id'])
        return inst_cat.get(iid, 'Other') if iid else 'Other'

    groups = {}
    for c in charts:
        groups.setdefault(cat_of(c), []).append(c)
    rank = {t: i for i, t in enumerate(METALS_ORDER)}
    ordered = []
    for cat in CAT_ORDER:
        items = groups.get(cat, [])
        if cat == 'Metals':
            items = sorted(items, key=lambda c: rank.get(c['title'], 999))
        else:
            items = sorted(items, key=lambda c: c['pack_order'])
        ordered.extend(items)
    for cat, items in groups.items():
        if cat not in CAT_ORDER:
            ordered.extend(sorted(items, key=lambda c: c['pack_order']))
    for i, c in enumerate(ordered, 1):
        if c['pack_order'] != i:
            api('PATCH', '/rest/v1/charts?id=eq.%d' % c['id'], prefer='return=minimal', body={'pack_order': i})
    print('Reordered %d charts.' % len(ordered))


if __name__ == '__main__':
    main()
