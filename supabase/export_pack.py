"""
Export Supabase data to one Excel file: a row per date, a column per instrument
(grouped by category). Read-only (publishable key).
  py supabase/export_pack.py            # all history
  py supabase/export_pack.py --days 45  # only the last 45 days (fast)
"""
import os, sys, json, datetime, urllib.request
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass
try:
    import openpyxl
except ImportError:
    print("ERROR: openpyxl missing. Run:  py -m pip install openpyxl"); sys.exit(1)

URL = 'https://knciqlbngtmsgmhnbfce.supabase.co'
KEY = 'sb_publishable_YwMLfMra6vzUnfvkn9uqTw_akegqlYp'
H = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Accept-Profile': 'pack'}
CAT_ORDER = ['Chemicals', 'Energy', 'Metals', 'Soft Commodities', 'Chicken', 'Gaming', 'Manheim']


def get(path):
    import time
    for attempt in range(5):
        try:
            return json.loads(urllib.request.urlopen(urllib.request.Request(URL + path, headers=H), timeout=120).read().decode())
        except Exception as e:
            if attempt == 4:
                raise
            time.sleep(1.5 * (attempt + 1))


def main():
    days = None
    if '--days' in sys.argv:
        try:
            days = int(sys.argv[sys.argv.index('--days') + 1])
        except (ValueError, IndexError):
            print("--days needs a number, e.g. --days 45"); sys.exit(1)
    date_filter = ''
    label = 'all history'
    if days:
        since = (datetime.date.today() - datetime.timedelta(days=days)).isoformat()
        date_filter = f'&obs_date=gte.{since}'
        label = f'last {days} days (from {since})'

    print("Reading instruments...")
    insts = get('/rest/v1/instruments?select=id,name,category&order=category,name')
    rank = {c: i for i, c in enumerate(CAT_ORDER)}
    insts.sort(key=lambda r: (rank.get(r['category'], 99), r['name'] or ''))
    cols = [(r['id'], f"{r['name']}", r['category']) for r in insts]
    col_index = {iid: i for i, (iid, _, _) in enumerate(cols)}

    print(f"Downloading data ({label})...")
    by_date = {}
    offset, PAGE = 0, 1000
    while True:
        rows = get(f'/rest/v1/pack_data?select=instrument_id,obs_date,value&order=obs_date&limit={PAGE}&offset={offset}{date_filter}')
        if not rows:
            break
        for r in rows:
            d = r['obs_date']
            if d not in by_date:
                by_date[d] = [None] * len(cols)
            ci = col_index.get(r['instrument_id'])
            if ci is not None:
                by_date[d][ci] = r['value']
        if len(rows) < PAGE:
            break
        offset += PAGE
        if offset % 20000 == 0:
            print(f"  ...{offset:,} rows")

    print(f"Writing Excel ({len(by_date):,} dates x {len(cols)} instruments)...")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Data"
    ws.append(['Category'] + [c for _, _, c in cols])
    ws.append(['Date'] + [n for _, n, _ in cols])
    ws.freeze_panes = 'B3'
    for d in sorted(by_date):
        ws.append([d] + by_date[d])

    suffix = f" (last {days}d)" if days else ""
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       f"Invest-Pack Data Export {datetime.date.today().isoformat()}{suffix}.xlsx")
    wb.save(out)
    print("\nSaved:", out)


if __name__ == '__main__':
    main()
