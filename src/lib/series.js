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

// Seasonal overlay: one line per year, x-axis = the 12 months (default calendar
// year, Jan start), plotting each month's value (NOT cumulative). Used for the
// chicken "run rate" chart. Only the most recent `maxSeasons` years are shown.
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export async function buildSeasonal(instrumentId, startMonth = 1, maxSeasons = 8) {
  const obs = await fetchObservations([instrumentId], null)
  const pts = obs.get(instrumentId) || []
  const MONTHS = Array.from({ length: 12 }, (_, i) => MONTH_NAMES[(startMonth - 1 + i) % 12])
  const bySeason = {}
  for (const p of pts) {
    const [y, m] = p.date.split('-').map(Number)
    const season = m >= startMonth ? y : y - 1
    const idx = (m - startMonth + 12) % 12
    if (!bySeason[season]) bySeason[season] = {}
    bySeason[season][idx] = p.value
  }
  let seasons = Object.keys(bySeason).sort()
  if (seasons.length > maxSeasons) seasons = seasons.slice(seasons.length - maxSeasons)
  const data = MONTHS.map((mon, idx) => {
    const row = { month: mon }
    for (const s of seasons) row[s] = bySeason[s][idx] ?? null
    return row
  })
  return { data, keys: seasons, xKey: 'month' }
}

// Macau daily-average GGR = monthly GGR / calendar days in that month.
export async function buildDailyAvg(ggrId, anchorISO, range) {
  const from = rangeStart(anchorISO, range)
  const obs = await fetchObservations([ggrId], from)
  const pts = obs.get(ggrId) || []
  const K = 'Daily Average GGR'
  const data = pts.map((p) => {
    const [y, m] = p.date.split('-').map(Number)
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return { date: p.date, [K]: p.value / days }
  })
  return { data: downsample(data), keys: [K], xKey: 'date', bar: true }
}

// Macau GGR per visitor = monthly GGR (MOP m) / visitors (thousands) * 1000.
export async function buildPerVisitor(ggrId, visitorsId) {
  const obs = await fetchObservations([ggrId, visitorsId].filter((x) => x != null), null)
  const ggr = obs.get(ggrId) || []
  const vis = monthlyLast(obs.get(visitorsId) || [])
  const K = 'GGR per Visitor'
  const data = []
  for (const p of ggr) {
    const v = vis.get(p.date.slice(0, 7))
    if (v) data.push({ date: p.date, [K]: (p.value * 1000) / v })
  }
  return { data: downsample(data), keys: [K], xKey: 'date', bar: true }
}

// Macau visitors as a stacked bar: Chinese visitors + the rest, so the total
// bar height is Total Visitors (matches the pack).
export async function buildVisitorsStack(chineseId, totalId) {
  const obs = await fetchObservations([chineseId, totalId].filter((x) => x != null), null)
  const chinese = monthlyLast(obs.get(chineseId) || [])
  const total = monthlyLast(obs.get(totalId) || [])
  const CH = 'Chinese Visitors'
  const OTHER = 'Other Visitors'
  const months = [...total.keys()].sort()
  const data = months.map((m) => {
    const c = chinese.get(m) ?? 0
    const t = total.get(m) ?? 0
    return { date: `${m}-01`, [CH]: c, [OTHER]: Math.max(0, t - c) }
  })
  return { data: downsample(data), keys: [CH, OTHER], xKey: 'date', stackedBar: true }
}

// Macau year-to-date growth % (line, left axis) vs monthly revenue (bars, right
// axis). YtD growth = this year's Jan..month total vs the same period last year
// — smoother than raw monthly YoY, matching the pack.
export async function buildMacauYtd(ggrId) {
  const obs = await fetchObservations([ggrId], null)
  const pts = (obs.get(ggrId) || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1))
  const REV = 'Monthly Revenue'
  const YTD = 'YtD Growth %'
  const ytd = new Map()
  const runByYear = {}
  for (const p of pts) {
    const [y, m] = p.date.split('-').map(Number)
    runByYear[y] = (runByYear[y] || 0) + p.value
    ytd.set(`${y}-${String(m).padStart(2, '0')}`, runByYear[y])
  }
  const data = pts.map((p) => {
    const key = p.date.slice(0, 7)
    const prev = ytd.get(shiftMonth(key, 12))
    return { date: p.date, [REV]: p.value, [YTD]: prev ? (ytd.get(key) / prev - 1) * 100 : null }
  })
  return { data, keys: [YTD, REV], xKey: 'date', dual: { left: [YTD], right: [REV], rightBar: true } }
}

// OEM market share: each group's brand-unit sum divided by the total, monthly.
// Brands map to groups exactly as the workbook does (BYD sits in China). Input
// is the per-brand monthly units; the shares are computed here.
const OEM_GROUPS = {
  China: ['GWM/haval', 'Chery', 'Jetour', 'Omoda and Jaecoo', 'BYD'],
  India: ['Suzuki', 'Mahindra'],
  Motus: ['Hyundai', 'Kia', 'Renault'],
  Toyota: ['Toyota'],
  Germany: ['VW', 'BMW'],
  Rest: ['Nissan', 'Ford', 'Isuzu'],
}
const OEM_ORDER = ['China', 'India', 'Motus', 'Toyota', 'Germany', 'Rest']

export async function buildOemShare(brandSeries) {
  // brandSeries: [{ name, instrumentId }]
  const ids = brandSeries.map((b) => b.instrumentId)
  const obs = await fetchObservations(ids, null)
  const byBrand = {}
  const monthSet = new Set()
  for (const b of brandSeries) {
    const m = new Map((obs.get(b.instrumentId) || []).map((p) => [p.date, p.value]))
    byBrand[b.name] = m
    for (const d of m.keys()) monthSet.add(d)
  }
  const months = [...monthSet].sort()
  const data = months.map((d) => {
    const row = { date: d }
    const groupVal = {}
    let total = 0
    for (const g of OEM_ORDER) {
      let sum = 0
      for (const brand of OEM_GROUPS[g]) sum += byBrand[brand]?.get(d) || 0
      groupVal[g] = sum
      total += sum
    }
    for (const g of OEM_ORDER) row[g] = total ? (groupVal[g] / total) * 100 : null
    return row
  })
  return { data, keys: OEM_ORDER, xKey: 'date' }
}

// Cars sold for hire: monthly # = (% sold for hire) * (total cars), then the
// trailing 12-month rolling sum. Inputs are the % and the total.
export async function buildHireRolling(pctId, totalId, window = 12) {
  const obs = await fetchObservations([pctId, totalId].filter((x) => x != null), null)
  const pct = new Map((obs.get(pctId) || []).map((p) => [p.date, p.value]))
  const tot = new Map((obs.get(totalId) || []).map((p) => [p.date, p.value]))
  const months = [...pct.keys()].filter((d) => tot.has(d)).sort()
  const monthly = months.map((d) => ({ date: d, n: pct.get(d) * tot.get(d) }))
  const K = 'Rolling 12 Months'
  const out = []
  for (let i = window - 1; i < monthly.length; i++) {
    let sum = 0
    for (let j = i - window + 1; j <= i; j++) sum += monthly[j].n
    out.push({ date: monthly[i].date, [K]: sum })
  }
  return { data: out, keys: [K], xKey: 'date' }
}

// Trailing N-month rolling sum of a monthly series (e.g. SA vehicle volumes,
// cars sold for hire). Auto-extends as new months are added.
export async function buildRolling12(instrumentId, window = 12) {
  const obs = await fetchObservations([instrumentId], null)
  const pts = (obs.get(instrumentId) || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1))
  const K = 'Rolling 12 Months'
  const out = []
  for (let i = window - 1; i < pts.length; i++) {
    let sum = 0
    let ok = true
    for (let j = i - window + 1; j <= i; j++) {
      if (pts[j].value == null) { ok = false; break }
      sum += pts[j].value
    }
    if (ok) out.push({ date: pts[i].date, [K]: sum })
  }
  return { data: downsample(out), keys: [K], xKey: 'date' }
}

// Shift a 'YYYY-MM' month key back by n months.
function shiftMonth(key, n) {
  let [y, m] = key.split('-').map(Number)
  m -= n
  while (m <= 0) { m += 12; y -= 1 }
  return `${y}-${String(m).padStart(2, '0')}`
}

// Reduce daily points to one value per calendar month (the month's last value).
function monthlyLast(pts) {
  const m = new Map()
  for (const p of pts) m.set(p.date.slice(0, 7), p.value)
  return m
}

// Proxy broiler feed price, per the Chicken Dashboard workbook:
//   Proxy Feed = 0.67 * Maize + 0.33 * Soya Meal,   Soya Meal = 0.9229 * SSPPSBID.
// SSPPSBID (the ZAR soybean index) only exists recently, so months in that era
// are computed live from Bloomberg (auto-updating); earlier months fall back to
// the stored historical values loaded from the workbook.
const PROXY_MAIZE_W = 0.67
const PROXY_SOYA_W = 0.33
const SOYA_MEAL_K = 0.9229

function computeProxyMonthly(maizeM, sspM, storedM) {
  const months = new Set([...maizeM.keys(), ...sspM.keys(), ...storedM.keys()])
  const out = new Map()
  for (const m of months) {
    if (sspM.has(m) && maizeM.has(m)) {
      out.set(m, PROXY_MAIZE_W * maizeM.get(m) + PROXY_SOYA_W * SOYA_MEAL_K * sspM.get(m))
    } else if (storedM.has(m)) {
      out.set(m, storedM.get(m))
    }
  }
  return out
}

// Computed Proxy Feed Price line (see computeProxyMonthly above).
export async function buildProxyFeed(maizeId, sspId, storedId) {
  const ids = [maizeId, sspId, storedId].filter((x) => x != null)
  const obs = await fetchObservations(ids, null)
  const proxy = computeProxyMonthly(
    monthlyLast(obs.get(maizeId) || []), monthlyLast(obs.get(sspId) || []),
    monthlyLast(obs.get(storedId) || []),
  )
  const K = 'Proxy Feed Price'
  const data = [...proxy.keys()].sort().map((m) => ({ date: `${m}-01`, [K]: proxy.get(m) }))
  return { data, keys: [K], xKey: 'date' }
}

// IQF-to-feed valuation chart: ARL share price (left axis, line) against the
// IQF / Proxy-Feed ratio (right axis, bars), monthly. IQF = the poultry price
// (c/kg) / 100, i.e. R/kg; the proxy feed is the computed series above (in
// R/ton), so ×1000 puts them on the same per-tonne basis. `lagMonths` lags the
// feed (e.g. the 6-month-lagged chart).
export async function buildIqfRatio(shareId, poultryId, maizeId, sspId, storedFeedId, lagMonths = 0) {
  const ids = [shareId, poultryId, maizeId, sspId, storedFeedId].filter((x) => x != null)
  const obs = await fetchObservations(ids, null)
  const share = monthlyLast(obs.get(shareId) || [])
  const poultry = monthlyLast(obs.get(poultryId) || [])
  const proxy = computeProxyMonthly(
    monthlyLast(obs.get(maizeId) || []), monthlyLast(obs.get(sspId) || []),
    monthlyLast(obs.get(storedFeedId) || []),
  )
  const months = Array.from(new Set([...share.keys(), ...poultry.keys()])).sort()
  const SHARE = 'ARL Share Price'
  const RATIO = lagMonths ? `IQF / ${lagMonths}m-lagged Proxy Feed` : 'IQF / Proxy Feed'
  const data = months.map((k) => {
    const f = proxy.get(shiftMonth(k, lagMonths))
    const iqf = poultry.has(k) ? poultry.get(k) / 100 : null   // c/kg -> R/kg
    return {
      date: `${k}-01`,
      [SHARE]: share.get(k) ?? null,
      [RATIO]: (iqf != null && f) ? (iqf * 1000) / f : null,
    }
  })
  return {
    data, keys: [SHARE, RATIO], xKey: 'date',
    dual: { left: [SHARE], right: [RATIO], rightBar: true },
  }
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
