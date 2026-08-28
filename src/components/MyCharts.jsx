import { useMemo, useState } from 'react'
import TimeRange from './TimeRange'
import SeriesChart from './SeriesChart'
import ImagePanel from './ImagePanel'
import StackedBarPanel from './StackedBarPanel'
import Lazy from './Lazy'
import { updateChart, deleteChart } from '../lib/charts'

// Same section order as the Investment Pack.
const CAT_ORDER = ['Chemicals', 'Energy', 'Metals', 'Soft Commodities', 'Chicken', 'Gaming', 'Manheim']
function catRank(cat) {
  const i = CAT_ORDER.indexOf(cat)
  return i === -1 ? CAT_ORDER.length : i
}

function ChartCard({ chart, instrumentsById, anchorISO, onChanged }) {
  const [range, setRange] = useState(chart.time_range || '1Y')
  const [busy, setBusy] = useState(false)
  const [big, setBig] = useState(false)
  const isSeries = chart.chart_type !== 'image' && chart.chart_type !== 'stacked_bar'

  async function changeRange(r) {
    setRange(r)
    try { await updateChart(chart.id, { time_range: r }) } catch { /* non-fatal */ }
  }
  async function togglePack() {
    setBusy(true)
    try { await updateChart(chart.id, { in_pack: !chart.in_pack }); onChanged() }
    finally { setBusy(false) }
  }
  async function remove() {
    if (!confirm(`Delete "${chart.title}"?`)) return
    setBusy(true)
    try { await deleteChart(chart.id); onChanged() }
    finally { setBusy(false) }
  }

  return (
    <div className="card-chart panel">
      <div className="card-head">
        <h3>{chart.title}</h3>
        <div className="card-actions">
          {isSeries && (
            <button className="btn small ghost" onClick={() => setBig(true)} title="Expand to full screen">⛶ Expand</button>
          )}
          <button className={`btn small ${chart.in_pack ? 'good' : ''}`} onClick={togglePack} disabled={busy}>
            {chart.in_pack ? '✓ In Pack' : '+ Add to Pack'}
          </button>
          <button className="btn small ghost" onClick={remove} disabled={busy}>Delete</button>
        </div>
      </div>
      {chart.chart_type === 'image' ? (
        <ImagePanel chart={chart} onChanged={onChanged} />
      ) : chart.chart_type === 'stacked_bar' ? (
        <StackedBarPanel chart={chart} onSaved={onChanged} />
      ) : (
        <>
          <TimeRange value={range} onChange={changeRange} />
          <Lazy height={260}>
            <SeriesChart def={chart} range={range} anchorISO={anchorISO}
              instrumentsById={instrumentsById} height={260} />
          </Lazy>
        </>
      )}

      {big && isSeries && (
        <div className="modal-overlay" onClick={() => setBig(false)}>
          <div className="chart-fs" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{chart.title}</h3>
              <div className="card-actions">
                <TimeRange value={range} onChange={changeRange} />
                <button className="btn small ghost" onClick={() => setBig(false)}>✕ Close</button>
              </div>
            </div>
            <div className="chart-fs-body">
              <SeriesChart def={chart} range={range} anchorISO={anchorISO}
                instrumentsById={instrumentsById} height={window.innerHeight * 0.72} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MyCharts({ charts, instrumentsById, anchorISO, onChanged }) {
  const catOf = (c) => {
    if (c.category) return c.category
    const s = (c.series || [])[0]
    const inst = s && instrumentsById.get(s.instrument_id)
    return (inst && inst.category) || 'Other'
  }

  const sections = useMemo(() => {
    const map = new Map()
    for (const c of charts) {
      const cat = catOf(c)
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat).push(c)
    }
    return [...map.entries()]
      .map(([cat, items]) => ({ cat, items: items.sort((a, b) => (a.pack_order - b.pack_order) || (a.id - b.id)) }))
      .sort((a, b) => catRank(a.cat) - catRank(b.cat) || a.cat.localeCompare(b.cat))
  }, [charts]) // eslint-disable-line react-hooks/exhaustive-deps

  const [collapsed, setCollapsed] = useState({})
  const isCollapsed = (cat) => collapsed[cat] !== false // default collapsed
  const toggle = (cat) => setCollapsed((c) => ({ ...c, [cat]: !isCollapsed(cat) }))

  if (!charts.length) {
    return <div className="center">No saved charts yet. Build one in the Chart Builder tab.</div>
  }

  return (
    <div>
      <div className="card-actions" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => setCollapsed(Object.fromEntries(sections.map((s) => [s.cat, false])))}>Expand all</button>
        <button className="btn ghost small" onClick={() => setCollapsed(Object.fromEntries(sections.map((s) => [s.cat, true])))}>Collapse all</button>
      </div>
      {sections.map((section) => {
        const open = !isCollapsed(section.cat)
        return (
          <div className="pack-section" key={section.cat}>
            <button className="pack-section-header" onClick={() => toggle(section.cat)}>
              <span className={`chev ${open ? 'open' : ''}`}>▶</span>
              {section.cat}
              <span className="sec-count">{section.items.length}</span>
            </button>
            {open && (
              <div className="chart-grid">
                {section.items.map((c) => (
                  <ChartCard key={c.id} chart={c} instrumentsById={instrumentsById}
                    anchorISO={anchorISO} onChanged={onChanged} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
