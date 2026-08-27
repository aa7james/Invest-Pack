import { useEffect, useState } from 'react'
import { fetchManualSeries, addManualDataPoints, deleteManualDataPoints } from '../lib/data'
import { clearObsCache } from '../lib/series'
import { updateChart } from '../lib/charts'

// Fishmeal-style editor for one or more manual series that share a date column.
// One row per date, one editable column per series. Saves each series back to
// Supabase. `series` = [{ id, label }]. Optional source link (saved to chart).
export default function ManualMultiEditor({ title, series, chart, onClose, onSaved, onChanged }) {
  const [rows, setRows] = useState([])          // {obs_date, v0, v1, ...}
  const [origDates, setOrigDates] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [link, setLink] = useState((chart && chart.source_url) || '')
  const [linkMsg, setLinkMsg] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const all = await Promise.all(series.map((s) => fetchManualSeries(s.id)))
        const byDate = new Map()
        all.forEach((pts, si) => {
          for (const p of pts) {
            if (!byDate.has(p.obs_date)) byDate.set(p.obs_date, { obs_date: p.obs_date })
            byDate.get(p.obs_date)['v' + si] = p.value
          }
        })
        const list = [...byDate.values()].sort((a, b) => (a.obs_date < b.obs_date ? 1 : -1))
        setRows(list.map((r) => {
          const row = { obs_date: r.obs_date }
          series.forEach((_, si) => { row['v' + si] = r['v' + si] != null ? String(r['v' + si]) : '' })
          return row
        }))
        setOrigDates(new Set(list.map((r) => r.obs_date)))
      } catch (e) {
        setMsg({ kind: 'bad', text: e.message || String(e) })
      } finally {
        setLoading(false)
      }
    })()
  }, [series])

  const setRow = (i, k, v) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)))
  const addRow = () => setRows((r) => [{ obs_date: '' }, ...r])
  const removeRow = (i) => setRows((r) => r.filter((_, j) => j !== i))
  const numOf = (v) => { const n = Number(String(v).replace(/[, ]/g, '')); return Number.isNaN(n) ? null : n }

  async function saveLink() {
    if (!chart) return
    try {
      await updateChart(chart.id, { source_url: link.trim() || null })
      setLinkMsg({ kind: 'good', text: 'Link saved.' })
      onChanged && onChanged()
    } catch (e) {
      setLinkMsg({ kind: 'bad', text: `Couldn't save link: ${e.message || e}` })
    }
  }

  async function save() {
    setMsg(null)
    const seen = new Set()
    const valid = rows.filter((r) => {
      const d = (r.obs_date || '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || seen.has(d)) return false
      seen.add(d); return true
    })
    if (!valid.length) { setMsg({ kind: 'bad', text: 'No valid rows to save.' }); return }
    setSaving(true)
    try {
      for (let si = 0; si < series.length; si++) {
        const pts = valid
          .filter((r) => numOf(r['v' + si]) != null)
          .map((r) => ({ obs_date: r.obs_date.trim(), value: numOf(r['v' + si]) }))
        if (pts.length) await addManualDataPoints(series[si].id, pts)
        const keep = new Set(pts.map((p) => p.obs_date))
        const removed = [...origDates].filter((d) => !keep.has(d))
        if (removed.length) await deleteManualDataPoints(series[si].id, removed)
      }
      clearObsCache()
      setMsg({ kind: 'good', text: `Saved ${valid.length} rows.` })
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
      <div className="modal-panel wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Edit data — {title}</h3>
          <button className="btn small ghost" onClick={onClose}>Close</button>
        </div>

        {chart && (
          <div className="editor-link">
            <span className="manual-label">Source link</span>
            <input className="input" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}
              placeholder="Paste the source URL"
              value={link} onChange={(e) => setLink(e.target.value)} />
            <button className="btn small" onClick={saveLink}>Save link</button>
            {link.trim() && <a className="manual-link" href={link.trim()} target="_blank" rel="noreferrer">Open ↗</a>}
            {linkMsg && <span className={`inline-msg ${linkMsg.kind}`}>{linkMsg.text}</span>}
          </div>
        )}

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
                <thead>
                  <tr>
                    <th>Date</th>
                    {series.map((s) => <th key={s.id}>{s.label}</th>)}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td><input type="date" className="input" value={r.obs_date} onChange={(e) => setRow(i, 'obs_date', e.target.value)} /></td>
                      {series.map((s, si) => (
                        <td key={s.id}><input type="number" step="any" className="input" value={r['v' + si] || ''} onChange={(e) => setRow(i, 'v' + si, e.target.value)} /></td>
                      ))}
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
