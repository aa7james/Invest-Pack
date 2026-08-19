import { useState } from 'react'
import SeriesChart from './SeriesChart'
import ManualDataEntry from './ManualDataEntry'
import { updateChart } from '../lib/charts'

function PackItem({ chart, index, count, instrumentsById, anchorISO, onChanged, onMove }) {
  const [note, setNote] = useState(chart.annotation || '')
  const [reloadKey, setReloadKey] = useState(0)

  // A chart is manually editable if one of its series is a manual (non-Bloomberg) instrument.
  const manualInstrument = (chart.series || [])
    .map((s) => instrumentsById.get(s.instrument_id))
    .find((inst) => inst && inst.source === 'manual')

  async function saveNote() {
    if (note === (chart.annotation || '')) return
    try { await updateChart(chart.id, { annotation: note }) } catch { /* non-fatal */ }
  }
  async function removeFromPack() {
    await updateChart(chart.id, { in_pack: false })
    onChanged()
  }

  return (
    <div className="pack-item panel">
      <div className="card-head no-print">
        <div className="reorder">
          <button className="btn tiny ghost" disabled={index === 0} onClick={() => onMove(index, -1)}>↑</button>
          <button className="btn tiny ghost" disabled={index === count - 1} onClick={() => onMove(index, 1)}>↓</button>
        </div>
        <div className="card-actions">
          <button className="btn small ghost" onClick={removeFromPack}>Remove</button>
        </div>
      </div>
      <h3>{chart.title}</h3>
      <SeriesChart def={chart} range={chart.time_range || '1Y'} anchorISO={anchorISO}
        instrumentsById={instrumentsById} height={420} reloadKey={reloadKey} />
      {manualInstrument && (
        <ManualDataEntry instrument={manualInstrument} onAdded={() => setReloadKey((k) => k + 1)} />
      )}
      <textarea
        className="annotation"
        placeholder="Add a comment for the pack…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
      />
    </div>
  )
}

export default function InvestmentPack({ charts, instrumentsById, anchorISO, onChanged }) {
  const [reordering, setReordering] = useState(false)
  const packCharts = charts
    .filter((c) => c.in_pack)
    .sort((a, b) => (a.pack_order - b.pack_order) || (a.id - b.id))

  async function move(index, dir) {
    const target = index + dir
    if (target < 0 || target >= packCharts.length) return
    setReordering(true)
    try {
      const reordered = [...packCharts]
      const tmp = reordered[index]
      reordered[index] = reordered[target]
      reordered[target] = tmp
      // Persist new pack_order for all (simple + reliable).
      await Promise.all(reordered.map((c, i) => updateChart(c.id, { pack_order: i })))
      onChanged()
    } finally {
      setReordering(false)
    }
  }

  if (!packCharts.length) {
    return (
      <div className="center">
        No charts in the pack yet. Go to <strong>My Charts</strong> and click
        “+ Add to Pack” on the ones you want.
      </div>
    )
  }

  const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="pack-print">
      <div className="pack-head pack-title">
        <div>
          <h2>Drivers — Investment Pack</h2>
          <div className="muted">Aylett &amp; Co · {today}</div>
        </div>
        <div className="card-actions no-print">
          <span className="muted small" style={{ alignSelf: 'center' }}>
            {packCharts.length} charts — use ↑/↓ to reorder
          </span>
          <button className="btn" onClick={() => window.print()}>⬇ Download PDF</button>
        </div>
      </div>
      {packCharts.map((c, i) => (
        <PackItem key={c.id} chart={c} index={i} count={packCharts.length}
          instrumentsById={instrumentsById} anchorISO={anchorISO}
          onChanged={onChanged} onMove={move} />
      ))}
    </div>
  )
}
