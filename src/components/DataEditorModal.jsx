import { useEffect, useState } from 'react'
import { fetchManualSeries, addManualDataPoints, deleteManualDataPoints } from '../lib/data'
import { clearObsCache } from '../lib/series'

// Pop-up editor for a manual series: add / remove / change rows, then Save.
export default function DataEditorModal({ instrument, onClose, onSaved }) {
  const [rows, setRows] = useState([])          // {obs_date, value} newest first
  const [origDates, setOrigDates] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchManualSeries(instrument.id)
        data.sort((a, b) => (a.obs_date < b.obs_date ? 1 : -1)) // newest first
        setRows(data.map((d) => ({ obs_date: d.obs_date, value: String(d.value) })))
        setOrigDates(new Set(data.map((d) => d.obs_date)))
      } catch (e) {
        setMsg({ kind: 'bad', text: e.message || String(e) })
      } finally {
        setLoading(false)
      }
    })()
  }, [instrument.id])

  const setRow = (i, k, v) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)))
  const addRow = () => setRows((r) => [{ obs_date: '', value: '' }, ...r])
  const removeRow = (i) => setRows((r) => r.filter((_, j) => j !== i))

  async function save() {
    setMsg(null)
    const valid = []
    const seen = new Set()
    for (const r of rows) {
      const d = (r.obs_date || '').trim()
      const v = Number(String(r.value).replace(/[, ]/g, ''))
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(v)) continue
      if (seen.has(d)) continue
      seen.add(d)
      valid.push({ obs_date: d, value: v })
    }
    if (!valid.length) { setMsg({ kind: 'bad', text: 'No valid rows to save.' }); return }
    setSaving(true)
    try {
      await addManualDataPoints(instrument.id, valid)
      const removed = [...origDates].filter((d) => !seen.has(d))
      if (removed.length) await deleteManualDataPoints(instrument.id, removed)
      clearObsCache()
      setMsg({ kind: 'good', text: `Saved ${valid.length} rows${removed.length ? `, removed ${removed.length}` : ''}.` })
      onSaved && onSaved()
      setTimeout(onClose, 500)
    } catch (e) {
      setMsg({ kind: 'bad', text: `Save failed: ${e.message || e}` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Edit data — {instrument.name}{instrument.unit ? ` (${instrument.unit})` : ''}</h3>
          <button className="btn small ghost" onClick={onClose}>Close</button>
        </div>

        {loading ? (
          <div className="center">Loading…</div>
        ) : (
          <>
            <div className="modal-toolbar">
              <button className="btn small" onClick={addRow}>+ Add row</button>
              <span className="muted small">{rows.length} rows</span>
            </div>
            <div className="modal-table">
              <table>
                <thead><tr><th>Date</th><th>Value</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td><input type="date" className="input" value={r.obs_date} onChange={(e) => setRow(i, 'obs_date', e.target.value)} /></td>
                      <td><input type="number" step="any" className="input" value={r.value} onChange={(e) => setRow(i, 'value', e.target.value)} /></td>
                      <td><button className="btn tiny ghost" onClick={() => removeRow(i)} title="Remove">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="modal-foot">
          {msg && <div className={`inline-msg ${msg.kind}`}>{msg.text}</div>}
          <div className="spacer" />
          <button className="btn ghost small" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn" onClick={save} disabled={saving || loading}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}
