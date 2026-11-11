import { useEffect, useMemo, useRef, useState } from 'react'
import SeriesChart from './SeriesChart'
import ManualDataEntry from './ManualDataEntry'
import CropDataEditor from './CropDataEditor'
import ManualMultiEditor from './ManualMultiEditor'
import ImagePanel from './ImagePanel'
import StackedBarPanel from './StackedBarPanel'
import Lazy from './Lazy'
import { updateChart } from '../lib/charts'
import { getAxis, saveAxis } from '../lib/axisPrefs'

// Preferred section order; anything else falls to the end alphabetically.
const CAT_ORDER = ['Chemicals', 'Energy', 'Metals', 'Soft Commodities', 'Chicken', 'Gaming', 'Manheim']

// Chart types whose x-axis is month-of-year or week-of-season rather than a real
// date, so a "from/to date" window doesn't apply — those get Y-axis limits only.
const NON_DATE_X = new Set(['seasonal', 'macau_ytd', 'crop_progress', 'iqf_ratio', 'iqf_ratio_lag'])

// Every graph can be adjusted except pasted-image panels (which have no axes).
const AXIS_CAPABLE = (t) => t !== 'image'

// Which kind of x-axis a chart has, so the controls offer the right inputs:
//  - 'date'  → From/To date pickers (normal time-series charts)
//  - 'year'  → From/To year boxes (the stacked-bar capex-style charts)
//  - 'none'  → no x controls (month/week seasonal overlays) — y + size only
function xKindFor(t) {
  if (t === 'stacked_bar') return 'year'
  if (NON_DATE_X.has(t)) return 'none'
  return 'date'
}

// Chart-height presets for the Size control.
const SIZES = [
  { label: 'S', h: 300 },
  { label: 'M', h: 440 },
  { label: 'L', h: 640 },
]

function catRank(cat) {
  const i = CAT_ORDER.indexOf(cat)
  return i === -1 ? CAT_ORDER.length : i
}

function AxisControls({ chart, xKind, axis, setAxis }) {
  const blank = { x_min: '', x_max: '', y_min: '', y_max: '' }
  const [form, setForm] = useState({ ...blank, ...axis })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Save + apply a whole settings object (so size buttons act instantly, while
  // the min/max boxes wait for Apply).
  function commit(next) {
    setForm(next)
    saveAxis(chart.id, next)
    setAxis({ ...next })
  }
  const apply = () => commit(form)
  const reset = () => commit({ ...blank })
  const setHeight = (h) => commit({ ...form, height: form.height === h ? undefined : h })

  const active = ['x_min', 'x_max', 'y_min', 'y_max', 'height']
    .some((k) => axis[k] != null && axis[k] !== '')

  return (
    <div className="axis-controls no-print">
      {xKind === 'date' && (
        <>
          <label>From<input type="date" value={form.x_min || ''} onChange={set('x_min')} /></label>
          <label>To<input type="date" value={form.x_max || ''} onChange={set('x_max')} /></label>
        </>
      )}
      {xKind === 'year' && (
        <>
          <label>From year<input type="number" placeholder="all" value={form.x_min || ''} onChange={set('x_min')} /></label>
          <label>To year<input type="number" placeholder="all" value={form.x_max || ''} onChange={set('x_max')} /></label>
        </>
      )}
      <label>Y min<input type="number" step="any" placeholder="auto" value={form.y_min || ''} onChange={set('y_min')} /></label>
      <label>Y max<input type="number" step="any" placeholder="auto" value={form.y_max || ''} onChange={set('y_max')} /></label>
      <label className="axis-size">Size
        <span className="size-buttons">
          {SIZES.map((s) => (
            <button key={s.label} type="button"
              className={`btn tiny ghost ${form.height === s.h ? 'on' : ''}`}
              onClick={() => setHeight(s.h)}>{s.label}</button>
          ))}
        </span>
      </label>
      <button className="btn small" onClick={apply}>Apply</button>
      {active && <button className="btn small ghost" onClick={reset}>Reset</button>}
    </div>
  )
}

function PackItem({ chart, instrumentsById, anchorISO, onChanged, eager, drag, editorOwner }) {
  const [note, setNote] = useState(chart.annotation || '')
  const [reloadKey, setReloadKey] = useState(0)
  const [cropOpen, setCropOpen] = useState(false)
  const [multiOpen, setMultiOpen] = useState(false)
  const [axis, setAxis] = useState(() => getAxis(chart.id))
  const [axisOpen, setAxisOpen] = useState(false)
  const ref = useRef(null)

  // Only the chart that "owns" a manual series (its first value chart) shows the
  // editor, so a series reused by a derived view (run-rate, ratios) isn't
  // editable in two places.
  const manualSeries = (chart.series || [])
    .map((s) => instrumentsById.get(s.instrument_id))
    .filter((inst) => inst && inst.source === 'manual')
  const ownedManual = manualSeries.filter((inst) => editorOwner.get(inst.id) === chart.id)
  const manualInstrument = ownedManual[0]

  // A seasonal (run-rate) chart plots a manual series that's "owned" for editing
  // by an earlier chart (e.g. Protein Prices). James still wants to update it
  // straight from the run-rate view, so show its own ✎ editor here too — it's the
  // same underlying rows, so editing from either place is fine.
  const seasonalManual = chart.chart_type === 'seasonal' && !manualInstrument
    ? manualSeries[0]
    : null

  // Weekly crop-progress charts have two manual inputs (deliveries + adjustments).
  const isCrop = chart.chart_type === 'crop_progress'
  const deliveriesInst = isCrop
    ? instrumentsById.get((chart.series || []).find((s) => s.role === 'deliveries')?.instrument_id)
    : null
  const adjustmentsInst = isCrop
    ? instrumentsById.get((chart.series || []).find((s) => s.role === 'adjustments')?.instrument_id)
    : null

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
          {AXIS_CAPABLE(chart.chart_type) && (
            <button className={`btn small ghost ${axisOpen ? 'on' : ''}`} onClick={() => setAxisOpen((v) => !v)}
              title="Resize this chart and set its date range / y-axis min-max">⚙ Adjust</button>
          )}
          <button className="btn small ghost" onClick={removeFromPack}>Remove</button>
        </div>
      </div>
      <h3>{chart.title}</h3>
      {chart.chart_type === 'image' ? (
        <ImagePanel chart={chart} onSaved={onChanged} />
      ) : chart.chart_type === 'stacked_bar' ? (
        <>
          {axisOpen && (
            <AxisControls chart={chart} xKind="year" axis={axis} setAxis={setAxis} />
          )}
          <StackedBarPanel chart={chart} onSaved={onChanged}
            xMin={axis.x_min} xMax={axis.x_max} yMin={axis.y_min} yMax={axis.y_max} height={axis.height} />
        </>
      ) : (
        <>
          {axisOpen && (
            <AxisControls chart={chart} xKind={xKindFor(chart.chart_type)} axis={axis} setAxis={setAxis} />
          )}
          <Lazy height={axis.height || 420} eager={eager}>
            <SeriesChart def={chart} range={chart.time_range || '1Y'} anchorISO={anchorISO}
              instrumentsById={instrumentsById} height={axis.height || 420} reloadKey={reloadKey}
              xMin={axis.x_min} xMax={axis.x_max} yMin={axis.y_min} yMax={axis.y_max} />
          </Lazy>
          {isCrop && deliveriesInst && adjustmentsInst ? (
            <div className="manual-entry no-print">
              <div className="manual-row">
                <span className="manual-label">Weekly SAGIS data · deliveries + adjustments (tons)</span>
                <div className="card-actions">
                  <button className="btn small" onClick={() => setCropOpen(true)}>✎ Edit data</button>
                </div>
              </div>
              {cropOpen && (
                <CropDataEditor
                  chart={chart}
                  deliveriesInst={deliveriesInst}
                  adjustmentsInst={adjustmentsInst}
                  onClose={() => setCropOpen(false)}
                  onSaved={() => setReloadKey((k) => k + 1)}
                  onChanged={onChanged}
                />
              )}
            </div>
          ) : ownedManual.length > 1 ? (
            <div className="manual-entry no-print">
              <div className="manual-row">
                <span className="manual-label">Manual series · add data from the source</span>
                <button className="btn small" onClick={() => setMultiOpen(true)}>✎ Edit data</button>
              </div>
              {multiOpen && (
                <ManualMultiEditor
                  title={chart.title}
                  chart={chart}
                  series={ownedManual.map((inst) => ({ id: inst.id, label: inst.name.replace(/^SA |^Chicken |^OEM: /, '') }))}
                  onClose={() => setMultiOpen(false)}
                  onSaved={() => setReloadKey((k) => k + 1)}
                  onChanged={onChanged}
                />
              )}
            </div>
          ) : (manualInstrument || seasonalManual) ? (
            <ManualDataEntry instrument={manualInstrument || seasonalManual} onAdded={() => setReloadKey((k) => k + 1)} />
          ) : null}
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

  // Each manual series is editable in exactly one place: the first plain value
  // chart (in pack order) that uses it. Derived charts (seasonal / ratios /
  // computed feed) never show an editor — they just display.
  const INPUT_TYPES = new Set(['value', 'bar', 'ggr_stack', 'rolling12', 'stacked_area', 'oem_share', 'hire_rolling'])
  const editorOwner = useMemo(() => {
    const owner = new Map()
    for (const c of packCharts) {
      if (!INPUT_TYPES.has(c.chart_type)) continue
      for (const s of c.series || []) {
        const inst = instrumentsById.get(s.instrument_id)
        if (inst && inst.source === 'manual' && !owner.has(inst.id)) owner.set(inst.id, c.id)
      }
    }
    return owner
  }, [packCharts, instrumentsById])

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
                    anchorISO={anchorISO} onChanged={onChanged} eager={eager} drag={drag} editorOwner={editorOwner} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
