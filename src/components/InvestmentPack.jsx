import { useEffect, useMemo, useRef, useState } from 'react'
import SeriesChart from './SeriesChart'
import ManualDataEntry from './ManualDataEntry'
import ImagePanel from './ImagePanel'
import Lazy from './Lazy'
import { updateChart } from '../lib/charts'

// Preferred section order; anything else falls to the end alphabetically.
const CAT_ORDER = ['Chemicals', 'Energy', 'Metals', 'Soft Commodities', 'Chicken', 'Gaming', 'Manheim']

function catRank(cat) {
  const i = CAT_ORDER.indexOf(cat)
  return i === -1 ? CAT_ORDER.length : i
}

function PackItem({ chart, instrumentsById, anchorISO, onChanged, eager, drag }) {
  const [note, setNote] = useState(chart.annotation || '')
  const [reloadKey, setReloadKey] = useState(0)
  const ref = useRef(null)

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
    <div
      ref={ref}
      className={`pack-item panel ${drag.draggingId === chart.id ? 'dragging' : ''}`}
      onDragOver={(e) => drag.onDragOver(e, chart)}
      onDrop={drag.onDrop}
    >
      <div className="card-head no-print">
        <span
          className="drag-handle"
          draggable
          title="Drag to reorder"
          onDragStart={(e) => drag.onDragStart(e, chart, ref.current)}
          onDragEnd={drag.onDragEnd}
        >
          ⠿ drag
        </span>
        <div className="card-actions">
          <button className="btn small ghost" onClick={removeFromPack}>Remove</button>
        </div>
      </div>
      <h3>{chart.title}</h3>
      {chart.chart_type === 'image' ? (
        <ImagePanel chart={chart} onSaved={onChanged} />
      ) : (
        <>
          <Lazy height={420} eager={eager}>
            <SeriesChart def={chart} range={chart.time_range || '1Y'} anchorISO={anchorISO}
              instrumentsById={instrumentsById} height={420} reloadKey={reloadKey} />
          </Lazy>
          {manualInstrument && (
            <ManualDataEntry instrument={manualInstrument} onAdded={() => setReloadKey((k) => k + 1)} />
          )}
        </>
      )}
      <textarea className="annotation" placeholder="Add a comment for the pack…"
        value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} />
    </div>
  )
}

export default function InvestmentPack({ charts, instrumentsById, anchorISO, onChanged }) {
  const catOf = (c) => {
    if (c.category) return c.category
    const s = (c.series || [])[0]
    const inst = s && instrumentsById.get(s.instrument_id)
    return (inst && inst.category) || 'Other'
  }

  const packCharts = useMemo(
    () => charts.filter((c) => c.in_pack).sort((a, b) => (a.pack_order - b.pack_order) || (a.id - b.id)),
    [charts],
  )

  // Local working order (so drag feels instant); re-sync when the data changes.
  const [order, setOrder] = useState(packCharts)
  const idsKey = packCharts.map((c) => c.id).join(',')
  useEffect(() => { setOrder(packCharts) }, [idsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const [collapsed, setCollapsed] = useState({}) // {cat: true} = collapsed. Default = collapsed.
  const [eager, setEager] = useState(false)      // force-render all charts (for PDF)
  const dragId = useRef(null)

  // Group current order into category sections (sections ordered by CAT_ORDER).
  const sections = useMemo(() => {
    const map = new Map()
    for (const c of order) {
      const cat = catOf(c)
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat).push(c)
    }
    return [...map.entries()]
      .map(([cat, items]) => ({ cat, items }))
      .sort((a, b) => catRank(a.cat) - catRank(b.cat) || a.cat.localeCompare(b.cat))
  }, [order]) // eslint-disable-line react-hooks/exhaustive-deps

  const isCollapsed = (cat) => collapsed[cat] !== false // default collapsed
  const toggle = (cat) => setCollapsed((c) => ({ ...c, [cat]: !isCollapsed(cat) }))

  // --- drag & drop (within a category) ---
  const drag = {
    draggingId: dragId.current,
    onDragStart(e, chart, cardEl) {
      dragId.current = chart.id
      if (cardEl) { try { e.dataTransfer.setDragImage(cardEl, 24, 24) } catch { /* noop */ } }
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragOver(e, overChart) {
      if (dragId.current == null || dragId.current === overChart.id) return
      const dragChart = order.find((c) => c.id === dragId.current)
      if (!dragChart || catOf(dragChart) !== catOf(overChart)) return // same section only
      e.preventDefault()
      setOrder((prev) => {
        const arr = [...prev]
        const from = arr.findIndex((c) => c.id === dragId.current)
        const to = arr.findIndex((c) => c.id === overChart.id)
        if (from === -1 || to === -1 || from === to) return prev
        const [moved] = arr.splice(from, 1)
        arr.splice(to, 0, moved)
        return arr
      })
    },
    async onDrop(e) {
      e.preventDefault()
      const id = dragId.current
      dragId.current = null
      if (id == null) return
      // Persist any pack_order that changed.
      const updates = order
        .map((c, i) => ({ c, newOrder: i + 1 }))
        .filter(({ c, newOrder }) => c.pack_order !== newOrder)
      try {
        await Promise.all(updates.map(({ c, newOrder }) => updateChart(c.id, { pack_order: newOrder })))
        onChanged()
      } catch { /* refetch will resync */ onChanged() }
    },
    onDragEnd() { dragId.current = null },
  }

  async function downloadPDF() {
    setEager(true)
    setCollapsed({}) // expand everything (default state is expanded=false→ collapsed; clear = all expanded? see isCollapsed)
    // Force all expanded explicitly:
    const allExpanded = {}
    for (const s of sections) allExpanded[s.cat] = false
    setCollapsed(allExpanded)
    // Give charts a moment to render, then print.
    setTimeout(() => window.print(), 3500)
  }

  if (!packCharts.length) {
    return (
      <div className="center">
        No charts in the pack yet. Go to <strong>My Charts</strong> and click “+ Add to Pack”.
      </div>
    )
  }

  return (
    <div className="pack-print">
      <div className="pack-head pack-title">
        <div>
          <h2>Drivers — Investment Pack</h2>
          <div className="muted">Aylett &amp; Co · {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        <div className="card-actions no-print">
          <button className="btn ghost small" onClick={() => setCollapsed(Object.fromEntries(sections.map((s) => [s.cat, false])))}>Expand all</button>
          <button className="btn ghost small" onClick={() => setCollapsed(Object.fromEntries(sections.map((s) => [s.cat, true])))}>Collapse all</button>
          <button className="btn" onClick={downloadPDF}>⬇ Download PDF</button>
        </div>
      </div>

      {sections.map((section) => {
        const open = !isCollapsed(section.cat)
        return (
          <div className="pack-section" key={section.cat}>
            <button className="pack-section-header no-print" onClick={() => toggle(section.cat)}>
              <span className={`chev ${open ? 'open' : ''}`}>▶</span>
              {section.cat}
              <span className="sec-count">{section.items.length}</span>
            </button>
            <h2 className="pack-section-title print-only">{section.cat}</h2>
            {(open || eager) && (
              <div className="pack-section-body">
                {section.items.map((chart) => (
                  <PackItem key={chart.id} chart={chart} instrumentsById={instrumentsById}
                    anchorISO={anchorISO} onChanged={onChanged} eager={eager} drag={drag} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
