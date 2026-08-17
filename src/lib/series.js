import { supabase } from '../supabaseClient'

// Time-range keys -> number of months back (null = all history).
const RANGE_MONTHS = {
  '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '2Y': 24, '5Y': 60, '10Y': 120, 'ALL': null,
}

export const RANGES = ['1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y', 'ALL']

// Given an anchor date (the latest data date) and a range key, return the ISO
// start date to filter from (or null for ALL).
export function rangeStart(anchorISO, range) {
  const months = RANGE_MONTHS[range]
  if (!months || !anchorISO) return null
  const d = new Date(anchorISO + 'T00:00:00')
  d.setMonth(d.getMonth() - months)
  return d.toISOString().slice(0, 10)
}

// Fetch all observations for the given instrument ids from `fromISO` onward,
// paginating past the 1000-row limit. Returns Map<instrument_id, [{date,value}]>.
export async function fetchObservations(instrumentIds, fromISO) {
  const out = new Map()
  if (!instrumentIds.length) return out
  for (const id of instrumentIds) out.set(id, [])

  const PAGE = 1000
  let offset = 0
  while (true) {
    let q = supabase
      .from('pack_data')
      .select('instrument_id, obs_date, value')
      .in('instrument_id', instrumentIds)
      .order('obs_date', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (fromISO) q = q.gte('obs_date', fromISO)

    const { data, error } = await q
    if (error) throw error
    if (!data || data.length === 0) break
    for (const row of data) {
      const arr = out.get(row.instrument_id)
      if (arr) arr.push({ date: row.obs_date, value: row.value })
    }
    if (data.length < PAGE) break
    offset += PAGE
  }
  return out
}

// Decimate a sorted array to at most `max` points (keeps first & last).
function downsample(points, max = 800) {
  if (points.length <= max) return points
  const step = points.length / max
  const out = []
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)])
  const last = points[points.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}

// Build a Recharts-ready dataset.
//   series: [{ key, instrumentId }]  (for 'value' mode)
//   For 'spread' mode: seriesA/seriesB are single {key,instrumentId}, result key 'spread'.
// Returns { data: [{date, key1, key2, ...}], keys: [key,...] }
export async function buildValueSeries(series, anchorISO, range) {
  const from = rangeStart(anchorISO, range)
  const ids = series.map((s) => s.instrumentId)
  const obs = await fetchObservations(ids, from)

  // union of dates
  const dateSet = new Set()
  const perKey = {}
  for (const s of series) {
    const pts = downsample(obs.get(s.instrumentId) || [])
    perKey[s.key] = new Map(pts.map((p) => [p.date, p.value]))
    for (const p of pts) dateSet.add(p.date)
  }
  const dates = Array.from(dateSet).sort()
  const data = dates.map((date) => {
    const row = { date }
    for (const s of series) row[s.key] = perKey[s.key].get(date) ?? null
    return row
  })
  return { data, keys: series.map((s) => s.key) }
}

// Like buildValueSeries but rebases each series to 100 at its first value in range.
export async function buildIndexedSeries(series, anchorISO, range) {
  const base = await buildValueSeries(series, anchorISO, range)
  const firsts = {}
  for (const k of base.keys) {
    for (const row of base.data) {
      if (row[k] != null) { firsts[k] = row[k]; break }
    }
  }
  const data = base.data.map((row) => {
    const r = { date: row.date }
    for (const k of base.keys) {
      r[k] = (row[k] != null && firsts[k]) ? (row[k] / firsts[k]) * 100 : null
    }
    return r
  })
  return { data, keys: base.keys }
}

// Computed "nitrogen margin": (A - coeffB*B) on common dates, plus its expanding
// (cumulative) average. Mirrors the Excel "Urea Price − 0.58×Ammonia" chart.
export async function buildNitrogenSpread(a, b, anchorISO, range, coeffB = 0.58, spreadLabel = 'Spread') {
  const from = rangeStart(anchorISO, range)
  const obs = await fetchObservations([a.instrumentId, b.instrumentId], from)
  const ma = new Map((obs.get(a.instrumentId) || []).map((p) => [p.date, p.value]))
  const mb = new Map((obs.get(b.instrumentId) || []).map((p) => [p.date, p.value]))
  const dates = Array.from(ma.keys()).filter((d) => mb.has(d)).sort()

  let cum = 0
  let n = 0
  const full = dates.map((date) => {
    const v = ma.get(date) - coeffB * mb.get(date)
    cum += v
    n += 1
    return { date, [spreadLabel]: v, 'Moving average': cum / n }
  })
  const ds = downsample(full)
  return { data: ds, keys: [spreadLabel, 'Moving average'] }
}

// Spread A - B on dates where both exist.
export async function buildSpreadSeries(a, b, anchorISO, range, label) {
  const from = rangeStart(anchorISO, range)
  const obs = await fetchObservations([a.instrumentId, b.instrumentId], from)
  const ma = new Map((obs.get(a.instrumentId) || []).map((p) => [p.date, p.value]))
  const mb = new Map((obs.get(b.instrumentId) || []).map((p) => [p.date, p.value]))
  const dates = Array.from(ma.keys()).filter((d) => mb.has(d)).sort()
  let pts = dates.map((date) => ({ date, value: ma.get(date) - mb.get(date) }))
  pts = downsample(pts)
  const key = label || 'spread'
  return { data: pts.map((p) => ({ date: p.date, [key]: p.value })), keys: [key] }
}
