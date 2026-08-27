import { useEffect, useMemo, useState } from 'react'
import { fetchManualSeries, addManualDataPoints, deleteManualDataPoints } from '../lib/data'
import { clearObsCache } from '../lib/series'
import { updateChart } from '../lib/charts'
import { fmtNum } from '../lib/format'

// Weekly crop-progress editor, mirroring the SAGIS table: you enter the raw
// "Prod deliveries" and "Adjustments" for each week; the app shows Week Total
// (= deliveries + adjustments) and the running Prog Total (cumulative within the
// season, May→April). Deliveries and Adjustments are stored as two manual series.
export default function CropDataEditor({ chart, deliveriesInst, adjustmentsInst, onClose, onSaved, onChanged }) {
  const [rows, setRows] = useState([])   // {obs_date, del, adj} newest first
  const [origDates, setOrigDates] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [link, setLink] = useState((chart && chart.source_url) || '')
  const [linkMsg, setLinkMsg] = useState(null)

  async function saveLink() {
    try {
      await updateChart(chart.id, { source_url: link.trim() || null })
      setLinkMsg({ kind: 'good', text: 'Link saved.' })
      onChanged && onChanged()
    } catch (e) {
      setLinkMsg({ kind: 'bad', text: `Couldn't save link: ${e.message || e}` })
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const [del, adj] = await Promise.all([
          fetchManualSeries(deliveriesInst.id),
          fetchManualSeries(adjustmentsInst.id),
        ])
        const adjByDate = new Map(adj.map((d) => [d.obs_date, d.value]))
        const byDate = new Map()
        for (const d of del) byDate.set(d.obs_date, { obs_date: d.obs_date, del: d.value, adj: adjByDate.get(d.obs_date) ?? 0 })
        for (const a of adj) if (!byDate.has(a.obs_date)) byDate.set(a.obs_date, { obs_date: a.obs_date, del: 0, adj: a.value })
        const all = [...byDate.values()].sort((x, y) => (x.obs_date < y.obs_date ? 1 : -1))
        setRows(all.map((r) => ({ obs_date: r.obs_date, del: String(r.del), adj: String(r.adj) })))
        setOrigDates(new Set(all.map((r) => r.obs_date)))
      } catch (e) {
        setMsg({ kind: 'bad', text: e.message || String(e) })
      } finally {
        setLoading(false)
      }
    })()
  }, [deliveriesInst.id, adjustmentsInst.id])

  const setRow = (i, k, v) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)))
  const addRow = () => setRows((r) => [{ obs_date: '', del: '', adj: '0' }, ...r])
  const removeRow = (i) => setRows((r) => r.filter((_, j) => j !== i))

  // Season (May start) for a date, used to reset the running Prog Total.
  const seasonOf = (iso) => {
    const [y, m] = iso.split('-').map(Number)
    return m >= 5 ? y : y - 1
  }
  const numOf = (v) => Number(String(v).replace(/[, ]/g, '')) || 0

  // Compute Week Total + Prog Total for display (chronological cumulative per season).
  const computed = useMemo(() => {
    const valid = rows.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test((r.obs_date || '').trim()))
    const asc = [...valid].sort((a, b) => (a.obs_date < b.obs_date ? -1 : 1))
    const prog = new Map()
    const running = {}
    for (const r of asc) {
      const s = seasonOf(r.obs_date)
      const wt = numOf(r.del) + numOf(r.adj)
      running[s] = (running[s] || 0) + wt
      prog.set(r.obs_date, { weekTotal: wt, progTotal: running[s] })
    }
    return prog
  }, [rows])

  async function save() {
    setMsg(null)
    const delRows = []
    const adjRows = []
    const seen = new Set()
    for (const r of rows) {
      const d = (r.obs_date || '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || seen.has(d)) continue
      seen.add(d)
      delRows.push({ obs_date: d, value: numOf(r.del) })
      adjRows.push({ obs_date: d, value: numOf(r.adj) })
    }
    if (!delRows.length) { setMsg({ kind: 'bad', text: 'No valid rows to save.' }); return }
    setSaving(true)
    try {
      await addManualDataPoints(deliveriesInst.id, delRows)
      await addManualDataPoints(adjustmentsInst.id, adjRows)
      const removed = [...origDates].filter((d) => !seen.has(d))
      if (removed.length) {
        await deleteManualDataPoints(deliveriesInst.id, removed)
        await deleteManualDataPoints(adjustmentsInst.id, removed)
      }
      clearObsCache()
      setMsg({ kind: 'good', text: `Saved ${delRows.length} weeks${removed.length ? `, removed ${removed.length}` : ''}.` })
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
          <h3>Edit data — Maize Crop Progress (weekly, tons)</h3>
          <button className="btn small ghost" onClick={onClose}>Close</button>
        </div>

        <div className="editor-warning">
          Check old data from the source against what is included in here. Data is revised
        </div>

        <div className="editor-link">
          <span className="manual-label">Source link</span>
          <input className="input" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}
            placeholder="Paste the source URL (e.g. https://www.sagis.org.za/...)"
            value={link} onChange={(e) => setLink(e.target.value)} />
          <button className="btn small" onClick={saveLink}>Save link</button>
          {link.trim() && (
            <a className="manual-link" href={link.trim()} target="_blank" rel="noreferrer">Open ↗</a>
          )}
          {linkMsg && <span className={`inline-msg ${linkMsg.kind}`}>{linkMsg.text}</span>}
        </div>

        {loading ? (
          <div className="center">Loading…</div>
        ) : (
          <>
            <div className="modal-toolbar">
              <button className="btn small" onClick={addRow}>+ Add week</button>
              <span className="muted small">{rows.length} weeks · enter Prod deliveries &amp; Adjustments; Week Total and Prog Total are worked out for you</span>
            </div>
            <div className="modal-table">
              <table>
                <thead>
                  <tr>
                    <th>Week ending</th>
                    <th>Prod deliveries</th>
                    <th>Adjustments</th>
                    <th>Week Total</th>
                    <th>Prog Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const c = computed.get((r.obs_date || '').trim())
                    return (
                      <tr key={i}>
                        <td><input type="date" className="input" value={r.obs_date} onChange={(e) => setRow(i, 'obs_date', e.target.value)} /></td>
                        <td><input type="number" step="any" className="input" value={r.del} onChange={(e) => setRow(i, 'del', e.target.value)} /></td>
                        <td><input type="number" step="any" className="input" value={r.adj} onChange={(e) => setRow(i, 'adj', e.target.value)} /></td>
                        <td className="calc">{c ? fmtNum(c.weekTotal) : '—'}</td>
                        <td className="calc">{c ? fmtNum(c.progTotal) : '—'}</td>
                        <td><button className="btn tiny ghost" onClick={() => removeRow(i)} title="Remove">✕</button></td>
                      </tr>
                    )
                  })}
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
