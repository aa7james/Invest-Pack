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
