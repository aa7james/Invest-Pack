import { useState } from 'react'
import { addManualDataPoint, addManualDataPoints } from '../lib/data'

// Parse a pasted date token into YYYY-MM-DD.
function parseDate(s) {
  s = s.trim()
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('-')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const dmy = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/) // DD/MM/YYYY
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

// Parse pasted rows: "date <sep> value" per line (comma / tab / whitespace).
function parseRows(text) {
  const out = []
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    const parts = t.split(/[,\t]+|\s+/).filter(Boolean)
    if (parts.length < 2) continue
    const date = parseDate(parts[0])
    const value = Number(parts[parts.length - 1].replace(/[, ]/g, ''))
    if (date && !Number.isNaN(value)) out.push({ obs_date: date, value })
  }
  return out
}

// Shown under a chart with a manual (non-Bloomberg) series: add one point, or
// paste many rows. Writes straight to Supabase.
export default function ManualDataEntry({ instrument, onAdded }) {
  const [date, setDate] = useState('')
  const [value, setValue] = useState('')
  const [bulk, setBulk] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setMsg(null)
    const v = Number(value)
    if (!date || Number.isNaN(v)) { setMsg({ kind: 'bad', text: 'Enter a date and a number.' }); return }
    setBusy(true)
    try {
      await addManualDataPoint(instrument.id, date, v)
      setMsg({ kind: 'good', text: `Saved ${date} = ${v.toLocaleString()}.` })
      setValue('')
      onAdded && onAdded()
    } catch (err) {
      setMsg({ kind: 'bad', text: `Couldn't save: ${err.message || err}` })
    } finally { setBusy(false) }
  }

  async function submitBulk() {
    setMsg(null)
    const rows = parseRows(bulk)
    if (!rows.length) { setMsg({ kind: 'bad', text: 'No valid "date value" rows found.' }); return }
    setBusy(true)
    try {
      const n = await addManualDataPoints(instrument.id, rows)
      setMsg({ kind: 'good', text: `Saved ${n} rows.` })
      setBulk('')
      onAdded && onAdded()
    } catch (err) {
      setMsg({ kind: 'bad', text: `Couldn't save: ${err.message || err}` })
    } finally { setBusy(false) }
  }

  return (
    <div className="manual-entry no-print">
      <div className="manual-row">
        <span className="manual-label">Manual series{instrument.unit ? ` · ${instrument.unit}` : ''}</span>
        <div className="card-actions">
          {instrument.source_url && (
            <a className="manual-link" href={instrument.source_url} target="_blank" rel="noreferrer">Update from source ↗</a>
          )}
          <button className="btn tiny ghost" onClick={() => setShowBulk((s) => !s)}>
            {showBulk ? 'Single entry' : 'Paste many'}
          </button>
        </div>
      </div>

      {showBulk ? (
        <div>
          <textarea className="annotation" style={{ minHeight: 90 }}
            placeholder={'Paste rows: one per line, "date value"\ne.g.\n2026-08-02 3490\n2026-07-26, 3480'}
            value={bulk} onChange={(e) => setBulk(e.target.value)} />
          <button className="btn small" onClick={submitBulk} disabled={busy}>
            {busy ? 'Saving…' : 'Add all rows'}
          </button>
        </div>
      ) : (
        <form className="manual-form" onSubmit={submit}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          <input type="number" step="any" placeholder="Value" value={value}
            onChange={(e) => setValue(e.target.value)} className="input" />
          <button className="btn small" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add / update'}</button>
        </form>
      )}
      {msg && <div className={`inline-msg ${msg.kind}`}>{msg.text}</div>}
    </div>
  )
}
