import { useMemo, useState } from 'react'
import TimeRange from './TimeRange'
import SeriesChart from './SeriesChart'
import { createChart } from '../lib/charts'

// Dropdown of instruments filtered by a search box.
function InstrumentSelect({ instruments, value, onChange, placeholder }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return instruments
    return instruments.filter(
      (i) => i.name.toLowerCase().includes(t) || i.category.toLowerCase().includes(t),
    )
  }, [q, instruments])

  return (
    <div className="picker">
      <input className="input" placeholder="Search instruments…" value={q}
        onChange={(e) => setQ(e.target.value)} />
      <select className="input" value={value || ''} onChange={(e) => onChange(Number(e.target.value) || null)}>
        <option value="">{placeholder || 'Select instrument…'}</option>
        {filtered.map((i) => (
          <option key={i.id} value={i.id}>
            {i.category} · {i.name}{i.currency ? ` (${i.currency})` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function ChartBuilder({ instruments, instrumentsById, anchorISO, onSaved }) {
  const [mode, setMode] = useState('value')      // 'value' | 'spread'
  const [valueIds, setValueIds] = useState([])   // instrument ids
  const [pick, setPick] = useState(null)
  const [spreadA, setSpreadA] = useState(null)
  const [spreadB, setSpreadB] = useState(null)
  const [range, setRange] = useState('1Y')
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const def = useMemo(() => {
    if (mode === 'spread') {
      if (!spreadA || !spreadB) return null
      return {
        chart_type: 'spread',
        series: [
          { instrument_id: spreadA, role: 'spread_a', sort_order: 0 },
          { instrument_id: spreadB, role: 'spread_b', sort_order: 1 },
        ],
      }
    }
    if (!valueIds.length) return null
    return {
      chart_type: mode === 'index' ? 'index' : 'value',
      series: valueIds.map((id, i) => ({ instrument_id: id, role: 'series', sort_order: i })),
    }
  }, [mode, valueIds, spreadA, spreadB])

  const defaultTitle = useMemo(() => {
    if (mode === 'spread' && spreadA && spreadB) {
      return `${instrumentsById.get(spreadA)?.name} − ${instrumentsById.get(spreadB)?.name}`
    }
    if (mode === 'value' && valueIds.length) {
      return valueIds.map((id) => instrumentsById.get(id)?.name).filter(Boolean).join(', ').slice(0, 60)
    }
    return ''
  }, [mode, valueIds, spreadA, spreadB, instrumentsById])

  function addValue() {
    if (pick && !valueIds.includes(pick)) setValueIds([...valueIds, pick])
    setPick(null)
  }
  function removeValue(id) {
    setValueIds(valueIds.filter((x) => x !== id))
  }

  async function save() {
    if (!def) return
    setSaving(true)
    setMsg(null)
    try {
      await createChart({
        title: (title.trim() || defaultTitle || 'Untitled chart'),
        chart_type: def.chart_type,
        time_range: range,
        series: def.series,
      })
      setMsg({ kind: 'good', text: 'Saved to My Charts.' })
      setValueIds([]); setSpreadA(null); setSpreadB(null); setTitle('')
      onSaved && onSaved()
    } catch (e) {
      setMsg({ kind: 'bad', text: `Could not save: ${e.message || e}` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="builder">
      <div className="builder-left panel">
        <div className="panel-label">Add series</div>

        <div className="seg">
          <button className={mode === 'value' ? 'on' : ''} onClick={() => setMode('value')}>Value</button>
          <button className={mode === 'index' ? 'on' : ''} onClick={() => setMode('index')}>Index =100</button>
          <button className={mode === 'spread' ? 'on' : ''} onClick={() => setMode('spread')}>Spread</button>
        </div>

        {mode !== 'spread' ? (
          <>
            <InstrumentSelect instruments={instruments} value={pick} onChange={setPick} />
            <button className="btn" onClick={addValue} disabled={!pick}>+ Add to Chart</button>
            <div className="chip-list">
              {valueIds.map((id) => (
                <span className="chip" key={id}>
                  {instrumentsById.get(id)?.name}
                  <button onClick={() => removeValue(id)}>×</button>
                </span>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="sub-label">Series A</div>
            <InstrumentSelect instruments={instruments} value={spreadA} onChange={setSpreadA} placeholder="Select A…" />
            <div className="sub-label">Series B</div>
            <InstrumentSelect instruments={instruments} value={spreadB} onChange={setSpreadB} placeholder="Select B…" />
            <div className="muted small">Chart plots A − B where both have data.</div>
          </>
        )}

        <hr className="sep" />
        <div className="sub-label">Chart title</div>
        <input className="input" placeholder={defaultTitle || 'Untitled chart'} value={title}
          onChange={(e) => setTitle(e.target.value)} />
        <button className="btn wide" onClick={save} disabled={!def || saving}>
          {saving ? 'Saving…' : 'Save to My Charts'}
        </button>
        {msg && <div className={`inline-msg ${msg.kind}`}>{msg.text}</div>}
      </div>

      <div className="builder-right panel">
        <TimeRange value={range} onChange={setRange} />
        {def ? (
          <SeriesChart def={def} range={range} anchorISO={anchorISO}
            instrumentsById={instrumentsById} height={360} />
        ) : (
          <div className="chart-msg" style={{ height: 360 }}>
            Add a series on the left to preview your chart
          </div>
        )}
      </div>
    </div>
  )
}
