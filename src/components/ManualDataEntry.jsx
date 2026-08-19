import { useState } from 'react'
import { addManualDataPoint } from '../lib/data'

// Shown under a chart that has a manual (non-Bloomberg) series. Gives a link to
// the data source and a small form to add/update a data point (writes to Supabase).
export default function ManualDataEntry({ instrument, onAdded }) {
  const [date, setDate] = useState('')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setMsg(null)
    const v = Number(value)
    if (!date || Number.isNaN(v)) {
      setMsg({ kind: 'bad', text: 'Enter a date and a number.' })
      return
    }
    setBusy(true)
    try {
      await addManualDataPoint(instrument.id, date, v)
      setMsg({ kind: 'good', text: `Saved ${date} = ${v.toLocaleString()}.` })
      setValue('')
      onAdded && onAdded()
    } catch (err) {
      setMsg({ kind: 'bad', text: `Couldn't save: ${err.message || err}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="manual-entry no-print">
      <div className="manual-row">
        <span className="manual-label">
          Manual series{instrument.unit ? ` · ${instrument.unit}` : ''}
        </span>
        {instrument.source_url && (
          <a className="manual-link" href={instrument.source_url} target="_blank" rel="noreferrer">
            Update from source ↗
          </a>
        )}
      </div>
      <form className="manual-form" onSubmit={submit}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        <input type="number" step="any" placeholder="Value" value={value}
          onChange={(e) => setValue(e.target.value)} className="input" />
        <button className="btn small" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Add / update'}
        </button>
      </form>
      {msg && <div className={`inline-msg ${msg.kind}`}>{msg.text}</div>}
    </div>
  )
}
