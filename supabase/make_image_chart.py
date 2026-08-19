"""
Add the 'Monthly Eskom Generation Capacity Breakdown' image panel to the pack
(Energy section). Non-destructive: only inserts this one panel. Uses the public
key. Requires the pack.charts.image_data and pack.charts.category columns
(add_image_columns.sql) to exist first.

Run: py supabase/make_image_chart.py
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

TITLE = 'Monthly Eskom Generation Capacity Breakdown'
ANNOTATION = (
    'EAF – Energy Availability Factor · PCLF – Planned Capability Loss Factor · '
    'UCLF – Unplanned Capability Loss Factor · OCLF – Other Capability Loss Factor. '
    'Source: Eskom. Paste the latest screenshot each month.'
)


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


# Place the panel right after this chart (matches the source pack order).
AFTER_TITLE = 'SA Electricity Price Index'


def main():
    charts = api('GET', '/rest/v1/charts?select=id,title,pack_order')
    max_order = max([c['pack_order'] for c in charts], default=0)

    # Idempotent: remove any existing panel with this title first.
    for c in [c for c in charts if c['title'] == TITLE]:
        api('DELETE', f'/rest/v1/charts?id=eq.{c["id"]}', prefer='return=minimal')

    inserted = api('POST', '/rest/v1/charts', prefer='return=representation', body={
        'title': TITLE, 'chart_type': 'image', 'category': 'Energy', 'time_range': 'ALL',
        'in_pack': True, 'pack_order': max_order + 1, 'annotation': ANNOTATION,
    })
    new_id = inserted[0]['id']

    # Reorder: put the panel immediately after AFTER_TITLE, renumber sequentially.
    charts = api('GET', '/rest/v1/charts?select=id,title,pack_order')
    others = sorted([c for c in charts if c['id'] != new_id], key=lambda c: c['pack_order'])
    ordered = []
    for c in others:
        ordered.append(c)
        if c['title'] == AFTER_TITLE:
            ordered.append(next(c2 for c2 in charts if c2['id'] == new_id))

    for i, c in enumerate(ordered, 1):
        if c['pack_order'] != i:
            api('PATCH', f'/rest/v1/charts?id=eq.{c["id"]}', prefer='return=minimal', body={'pack_order': i})
    print(f'Added "{TITLE}" right after "{AFTER_TITLE}" in Energy.')


if __name__ == '__main__':
    main()
