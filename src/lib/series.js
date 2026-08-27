import { supabase } from '../supabaseClient'

// Time-range keys -> number of months back (null = all history).
const RANGE_MONTHS = {
  '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '2Y': 24, '5Y': 60, '10Y': 120, 'ALL': null,
}

export const RANGES = ['1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y', 'ALL']

// Given an anchor date (the latest data date) and a range key, return the ISO
// start date to filter from (or null for ALL).
export function rangeStart(anchorISO, range) {
  // A chart can store an explicit start date (YYYY-MM-DD) instead of a preset,
  // e.g. an index chart rebased from a specific date.
  if (/^\d{4}-\d{2}-\d{2}$/.test(range)) return range
  const months = RANGE_MONTHS[range]
  if (!months || !anchorISO) return null
  const d = new Date(anchorISO + 'T00:00:00')
  d.setMonth(d.getMonth() - months)
  return d.toISOString().slice(0, 10)
}

// Session cache: each instrument's history is downloaded at most once (keyed by
// instrument id + from-date), so charts that share instruments don't refetch.
const _obsCache = new Map()
export function clearObsCache() { _obsCache.clear() }

async function fetchOneInstrument(id, fromISO) {
  const key = `${id}|${fromISO || 'all'}`
  if (_obsCache.has(key)) return _obsCache.get(key)
  const pts = []
  const PAGE = 1000
  let offset = 0
  while (true) {
    let q = supabase
      .from('pack_data')
      .select('obs_date, value')
      .eq('instrument_id', id)
      .order('obs_date', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (fromISO) q = q.gte('obs_date', fromISO)
    const { data, error } = await q
    if (error) throw error
    if (!data || data.length === 0) break
    for (const row of data) pts.push({ date: row.obs_date, value: row.value })
    if (data.length < PAGE) break
    offset += PAGE
  }
  _obsCache.set(key, pts)
  return pts
}

// Fetch all observations for the given instrument ids from `fromISO` onward.
// Returns Map<instrument_id, [{date,value}]>. Uses the session cache above.
export async function fetchObservations(instrumentIds, fromISO) {
  const out = new Map()
  if (!instrumentIds.length) return out
  const results = await Promise.all(instrumentIds.map((id) => fetchOneInstrument(id, fromISO)))
  instrumentIds.forEach((id, i) => out.set(id, results[i]))
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

function pearson(x, y) {
  const n = x.length
  let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxy += x[i] * y[i]; sxx += x[i] * x[i]; syy += y[i] * y[i] }
  const cov = n * sxy - sx * sy
  const dx = Math.sqrt(n * sxx - sx * sx)
  const dy = Math.sqrt(n * syy - sy * sy)
  return (dx && dy) ? cov / (dx * dy) : 0
}

// Rolling `window`-day correlation of the daily log returns of A vs B, with the
// small-sample bias correction used in the pack (Platinum/Gold Correlation).
export async function buildCorrelation(a, b, anchorISO, range, label, window = 252) {
  const from = rangeStart(anchorISO, range)
  const obs = await fetchObservations([a.instrumentId, b.instrumentId], from)
  const ma = new Map((obs.get(a.instrumentId) || []).map((p) => [p.date, p.value]))
  const mb = new Map((obs.get(b.instrumentId) || []).map((p) => [p.date, p.value]))
  const dates = Array.from(ma.keys()).filter((d) => mb.has(d)).sort()
  const ra = [], rb = [], rd = []
  for (let i = 1; i < dates.length; i++) {
    const a0 = ma.get(dates[i - 1]), a1 = ma.get(dates[i])
    const b0 = mb.get(dates[i - 1]), b1 = mb.get(dates[i])
    if (a0 > 0 && a1 > 0 && b0 > 0 && b1 > 0) {
      ra.push(Math.log(a1 / a0)); rb.push(Math.log(b1 / b0)); rd.push(dates[i])
    }
  }
  const out = []
  for (let i = window - 1; i < ra.length; i++) {
    const r = pearson(ra.slice(i - window + 1, i + 1), rb.slice(i - window + 1, i + 1))
    out.push({ date: rd[i], [label]: r * (1 - (1 - r * r) / (2 * (window - 1))) })
  }
  return { data: downsample(out), keys: [label] }
}

// Sponge premium proxy: 60-day average of ((NA + EU)/2 - spot), dropping
// outliers > $30 (matches the pack's 'Combined 60dma').
export async function buildSpongePremium(na, eu, spot, anchorISO, range, label, maWin = 60) {
  const from = rangeStart(anchorISO, range)
  const obs = await fetchObservations([na.instrumentId, eu.instrumentId, spot.instrumentId], from)
  const mn = new Map((obs.get(na.instrumentId) || []).map((p) => [p.date, p.value]))
  const me = new Map((obs.get(eu.instrumentId) || []).map((p) => [p.date, p.value]))
  const ms = new Map((obs.get(spot.instrumentId) || []).map((p) => [p.date, p.value]))
  const dates = Array.from(mn.keys()).filter((d) => me.has(d) && ms.has(d)).sort()
  const prem = dates.map((d) => {
    const p = (mn.get(d) + me.get(d)) / 2 - ms.get(d)
    return Math.abs(p) > 30 ? null : p
  })
  const out = []
  for (let i = 0; i < dates.length; i++) {
    if (i < maWin - 1) continue
    const win = prem.slice(i - maWin + 1, i + 1).filter((v) => v != null)
    if (!win.length) continue
    out.push({ date: dates[i], [label]: win.reduce((s, v) => s + v, 0) / win.length })
  }
  return { data: downsample(out), keys: [label] }
}

// Seasonal overlay: one line per crop year, x-axis = months of the season
// (default starting in May). The stored series holds each period's incremental
// delivery ("the original number"); we cumulate it within each season to draw
// the running progress total. Only the most recent `maxSeasons` years are shown
// (the pack shows the last 11), so the chart stays readable and auto-advances.
export async function buildSeasonal(instrumentId, startMonth = 5, maxSeasons = 11) {
  const obs = await fetchObservations([instrumentId], null)
  const pts = obs.get(instrumentId) || []
  const MONTHS = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr']
  const bySeason = {}
  for (const p of pts) {
    const [y, m] = p.date.split('-').map(Number)
    const season = m >= startMonth ? y : y - 1
    const idx = (m - startMonth + 12) % 12
    if (!bySeason[season]) bySeason[season] = {}
    // Sum deliveries landing in the same season-month before cumulating.
    bySeason[season][idx] = (bySeason[season][idx] ?? 0) + p.value
  }
  let seasons = Object.keys(bySeason).sort()
  if (seasons.length > maxSeasons) seasons = seasons.slice(seasons.length - maxSeasons)

  // Running (cumulative) total across the season's months.
  const cum = {}
  for (const s of seasons) {
    let running = 0
    let started = false
    cum[s] = MONTHS.map((_, idx) => {
      const v = bySeason[s][idx]
      if (v == null) return started ? running : null
      running += v
      started = true
      return running
    })
  }
  const data = MONTHS.map((mon, idx) => {
    const row = { month: mon }
    for (const s of seasons) row[s] = cum[s][idx]
    return row
  })
  return { data, keys: seasons, xKey: 'month' }
}

// Weekly maize crop progress. Two manual series hold the raw SAGIS inputs
// (Prod deliveries + Adjustments, in tons). Per week: Week Total = deliveries +
// adjustments; within a season (May start) we cumulate to the running Prog Total
// and convert to million tons. Seasons overlay on a common week axis (1..52) so
// the current partial season simply ends at its last week (no flat carry-over),
// and only the most recent `maxSeasons` years are shown (the pack shows 11).
const CROP_MONTHS = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr']

export async function buildCropProgress(deliveriesId, adjustmentsId, maxSeasons = 11) {
  const ids = [deliveriesId, adjustmentsId].filter((x) => x != null)
  const obs = await fetchObservations(ids, null)
  const del = obs.get(deliveriesId) || []
  const adj = new Map((obs.get(adjustmentsId) || []).map((p) => [p.date, p.value]))

  const bySeason = {}
  for (const p of del) {
    const [y, m] = p.date.split('-').map(Number)
    const season = m >= 5 ? y : y - 1
    if (!bySeason[season]) bySeason[season] = []
    bySeason[season].push({ date: p.date, total: p.value + (adj.get(p.date) || 0) })
  }
  let seasons = Object.keys(bySeason).sort()
  if (seasons.length > maxSeasons) seasons = seasons.slice(seasons.length - maxSeasons)

  const cumBySeason = {}
  let maxWeeks = 0
  for (const s of seasons) {
    const arr = bySeason[s].sort((a, b) => (a.date < b.date ? -1 : 1))
    let run = 0
    cumBySeason[s] = arr.map((x) => { run += x.total; return run / 1e6 })
    maxWeeks = Math.max(maxWeeks, cumBySeason[s].length)
  }

  const data = []
  for (let i = 0; i < maxWeeks; i++) {
    const row = { week: i + 1 }
    for (const s of seasons) row[s] = i < cumBySeason[s].length ? cumBySeason[s][i] : null
    data.push(row)
  }

  // Month tick positions: label the week where each calendar month first begins.
  const ticks = []
  const tickLabels = {}
  let lastM = -1
  for (let i = 0; i < maxWeeks; i++) {
    const d = new Date(Date.UTC(2025, 4, 1))
    d.setUTCDate(d.getUTCDate() + 7 * i)
    const mi = (d.getUTCMonth() - 4 + 12) % 12
    if (mi !== lastM) { ticks.push(i + 1); tickLabels[i + 1] = CROP_MONTHS[mi]; lastM = mi }
  }
  return { data, keys: seasons, xKey: 'week', ticks, tickLabels }
}

// SA maize (USD/t) vs world corn (CBOT cents/bushel -> $/t via x0.393683) + the
// difference, on a comparable basis. Mirrors the pack's SA Corn vs World Corn.
export async function buildCornCompare(sa, world, anchorISO, range, factor = 0.393683) {
  const from = rangeStart(anchorISO, range)
  const obs = await fetchObservations([sa.instrumentId, world.instrumentId], from)
  const msa = new Map((obs.get(sa.instrumentId) || []).map((p) => [p.date, p.value]))
  const mw = new Map((obs.get(world.instrumentId) || []).map((p) => [p.date, p.value]))
  const dates = Array.from(msa.keys()).filter((d) => mw.has(d)).sort()
  let pts = dates.map((d) => {
    const s = msa.get(d)
    const w = mw.get(d) * factor
    return { date: d, 'SA Yellow Maize ($/t)': s, 'CBOT Corn ($/t)': w, 'Difference ($/t)': s - w }
  })
  pts = downsample(pts)
  return { data: pts, keys: ['SA Yellow Maize ($/t)', 'CBOT Corn ($/t)', 'Difference ($/t)'] }
}

// Ratio A / B on dates where both exist (e.g. Platinum/Gold).
export async function buildRatioSeries(a, b, anchorISO, range, label) {
  const from = rangeStart(anchorISO, range)
  const obs = await fetchObservations([a.instrumentId, b.instrumentId], from)
  const ma = new Map((obs.get(a.instrumentId) || []).map((p) => [p.date, p.value]))
  const mb = new Map((obs.get(b.instrumentId) || []).map((p) => [p.date, p.value]))
  const dates = Array.from(ma.keys()).filter((d) => mb.has(d) && mb.get(d)).sort()
  let pts = dates.map((date) => ({ date, [label]: ma.get(date) / mb.get(date) }))
  pts = downsample(pts)
  return { data: pts, keys: [label] }
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
