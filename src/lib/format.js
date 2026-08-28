// Shared formatting helpers.

// Round numbers to 2 decimal places for display (per house preference).
export function fmtNum(v) {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Compact number for axis ticks: 1.2B, 80M, 5.4M, 250k, 1,234. Keeps labels
// short so large values (GGR in millions/billions) don't get clipped.
export function fmtCompact(v) {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  if (Number.isNaN(n)) return ''
  const a = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const trim = (x) => x.toFixed(x < 10 ? 1 : 0).replace(/\.0$/, '')
  if (a >= 1e9) return `${sign}${trim(a / 1e9)}B`
  if (a >= 1e6) return `${sign}${trim(a / 1e6)}M`
  if (a >= 1e3) return `${sign}${trim(a / 1e3)}k`
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

// Format an ISO timestamp as a readable local date-time.
export function fmtTimestamp(ts) {
  if (!ts) return 'never'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return 'unknown'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Format a date-only value (YYYY-MM-DD) without timezone drift.
export function fmtDate(d) {
  if (!d) return '—'
  // d is 'YYYY-MM-DD'; render as-is to avoid timezone shifting the day.
  const [y, m, day] = String(d).split('-')
  if (!y || !m || !day) return String(d)
  return `${day}/${m}/${y}`
}
