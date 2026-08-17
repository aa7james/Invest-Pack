import { fmtDate } from '../lib/format'

// Small stat cards summarising what's currently loaded in Supabase.
export default function SummaryCards({ summary }) {
  const s = summary || {}
  const cards = [
    { label: 'Active instruments', val: s.active_instruments ?? '—' },
    { label: 'Total instruments', val: s.total_instruments ?? '—' },
    { label: 'Data points', val: s.total_rows != null ? Number(s.total_rows).toLocaleString() : '—' },
    { label: 'Earliest date', val: fmtDate(s.date_min) },
    { label: 'Latest date', val: fmtDate(s.date_max) },
  ]
  return (
    <div className="cards">
      {cards.map((c) => (
        <div className="card" key={c.label}>
          <div className="label">{c.label}</div>
          <div className="val">{c.val}</div>
        </div>
      ))}
    </div>
  )
}
