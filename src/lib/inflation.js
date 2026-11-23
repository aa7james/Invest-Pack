// SA CPI (inflation) read live from the Fixed Income dashboard's Supabase — the
// same Bloomberg-fed database that powers that app — so the "vs inflation"
// comparison here updates on its own, with no extra pipeline to maintain.
//
// The `SA CPI` series in that DB is the year-on-year inflation RATE (%), stored
// daily (forward-filled between monthly Stats SA prints), going back to 2008.
// We read it once per session (paginated, then reduced to one reading per
// month) and cache it. Read-only, publishable key — safe in the frontend.

const FI_URL = 'https://yhakiuyxupdkxsfzdhec.supabase.co'
const FI_KEY = 'sb_publishable_Ra6s4qyrFduZoWNc3Jr22w_BMEnr97F'
// select=date, cpi:data->>"SA CPI"  (arrows/quotes/space url-encoded; commas kept literal)
const SELECT = 'date,cpi:data-%3E%3E%22SA%20CPI%22'

let cache = null
let inflight = null

export async function loadCPI() {
  if (cache) return cache
  if (!inflight) {
    inflight = (async () => {
      const headers = { apikey: FI_KEY, Authorization: `Bearer ${FI_KEY}` }
      const step = 1000
      const byMonth = new Map()
      for (let offset = 0; ; offset += step) {
        const url = `${FI_URL}/rest/v1/bond_data?select=${SELECT}&order=date.asc&limit=${step}&offset=${offset}`
        const res = await fetch(url, { headers })
        if (!res.ok) throw new Error(`CPI load failed: ${res.status}`)
        const rows = await res.json()
        for (const r of rows) {
          if (r.cpi == null) continue
          const yoy = Number(r.cpi)
          if (Number.isNaN(yoy)) continue
          const ym = String(r.date).slice(0, 7)
          if (!byMonth.has(ym)) byMonth.set(ym, yoy) // first (earliest) reading in the month
        }
        if (rows.length < step) break
      }
      cache = Array.from(byMonth, ([ym, yoy]) => ({ ym, yoy })).sort((a, b) => (a.ym < b.ym ? -1 : 1))
      return cache
    })()
  }
  return inflight
}

// Average annual inflation between two dates: the geometric mean of the monthly
// year-on-year readings inside the window. YoY is already an annualised rate, so
// the geometric average of (1 + YoY) is the representative inflation per year
// over the span — no price-index reconstruction needed. Returns a decimal.
export function inflationRate(series, fromISO, toISO) {
  if (!series || !series.length) return null
  const from = String(fromISO).slice(0, 7)
  const to = String(toISO).slice(0, 7)
  const rows = series.filter((r) => r.ym >= from && r.ym <= to)
  if (rows.length < 6) return null // too short a window to be meaningful
  let logsum = 0
  for (const r of rows) logsum += Math.log(1 + r.yoy / 100)
  return Math.exp(logsum / rows.length) - 1
}
