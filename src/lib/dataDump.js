import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'

// Category -> the exact sheet name used in "Data Dump - HP.xlsx", so the export
// is a drop-in match.
const SHEET_NAMES = {
  Chemicals: '1.BB Data - Chemicals',
  Energy: '2.BB Data - Energy',
  Metals: '3.BB Data - Metals',
  'Soft Commodities': '4.BB Data - Soft Commodities',
  Chicken: '5. BB Data - Chicken Dashboard',
  Gaming: '7.BB Data - Gaming',
  Manheim: '9.BB Data - Manheim',
}
const CAT_ORDER = ['Chemicals', 'Energy', 'Metals', 'Soft Commodities', 'Chicken', 'Gaming', 'Manheim']

function jsDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

// Build one worksheet in the Data-Dump layout for a set of instruments.
function buildSheet(instruments, dataByInstDate) {
  // Only keep instruments that have at least one datapoint in range.
  const cols = instruments.filter((i) => dataByInstDate.has(i.id))
  if (!cols.length) return null

  // union of dates across these instruments
  const dateSet = new Set()
  for (const i of cols) for (const d of dataByInstDate.get(i.id).keys()) dateSet.add(d)
  const dates = [...dateSet].sort()

  const starts = cols.map((i) => {
    const ks = [...dataByInstDate.get(i.id).keys()].sort()
    return ks.length ? jsDate(ks[0]) : ''
  })
  const ends = cols.map((i) => {
    const ks = [...dataByInstDate.get(i.id).keys()].sort()
    return ks.length ? jsDate(ks[ks.length - 1]) : ''
  })

  const aoa = []
  aoa.push(['Start Date', ...starts])
  aoa.push(['End Date', ...ends])
  aoa.push(['', ...cols.map((i) => i.name)])
  aoa.push(['', ...cols.map((i) => i.bloomberg_ticker || '')])
  aoa.push(['', ...cols.map((i) => (i.currency ? `FX=${i.currency}` : ''))])
  aoa.push(['', ...cols.map(() => 'Last Price')])
  aoa.push(['Dates', ...cols.map((i) => i.bloomberg_field || 'PX_LAST')])
  for (const d of dates) {
    aoa.push([jsDate(d), ...cols.map((i) => {
      const v = dataByInstDate.get(i.id).get(d)
      return v == null ? '' : v
    })])
  }
  return XLSX.utils.aoa_to_sheet(aoa, { cellDates: true })
}

// Download the last `days` of data as an Excel workbook in Data-Dump format.
export async function downloadDataDump(days = 35) {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceISO = since.toISOString().slice(0, 10)

  const { data: insts, error: ie } = await supabase
    .from('instruments')
    .select('id, name, bloomberg_ticker, bloomberg_field, category, currency')
    .order('category').order('name')
  if (ie) throw ie

  const dataByInstDate = new Map() // id -> Map(date -> value)
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('pack_data')
      .select('instrument_id, obs_date, value')
      .gte('obs_date', sinceISO)
      .order('obs_date')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || !data.length) break
    for (const r of data) {
      if (!dataByInstDate.has(r.instrument_id)) dataByInstDate.set(r.instrument_id, new Map())
      dataByInstDate.get(r.instrument_id).set(r.obs_date, r.value)
    }
    if (data.length < PAGE) break
    from += PAGE
  }

  const byCat = new Map()
  for (const i of insts) {
    if (!byCat.has(i.category)) byCat.set(i.category, [])
    byCat.get(i.category).push(i)
  }

  const wb = XLSX.utils.book_new()
  const cats = [...byCat.keys()].sort((a, b) => {
    const ra = CAT_ORDER.indexOf(a); const rb = CAT_ORDER.indexOf(b)
    return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb)
  })
  for (const cat of cats) {
    const ws = buildSheet(byCat.get(cat), dataByInstDate)
    if (ws) XLSX.utils.book_append_sheet(wb, ws, (SHEET_NAMES[cat] || cat).slice(0, 31))
  }
  if (!wb.SheetNames.length) throw new Error('No data in the selected period.')

  const today = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `Data Dump - Invest-Pack ${today}.xlsx`)
}
