import { useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import * as XLSX from 'xlsx'
import { updateChart } from '../lib/charts'
import { fmtNum } from '../lib/format'

// Golden-angle hue stepping so adjacent stacked segments look distinct (not
// two reds in a row), with alternating lightness for extra separation.
function color(i) {
  const h = Math.round((i * 137.508) % 360)
  const l = 42 + (i % 3) * 9
  return `hsl(${h}, 65%, ${l}%)`
}

const isYear = (v) =>
  (typeof v === 'string' && /^\s*\d{4}\s*[AEae]?\s*$/.test(v)) ||
  (typeof v === 'number' && v >= 1990 && v <= 2100)

// Parse a company x year table from a dropped .xlsx (first sheet).
function parseWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })
  let hi = rows.findIndex((r) => r.filter(isYear).length >= 3)
  if (hi < 0) hi = 0
  const header = rows[hi]
  const yearCols = []
  for (let c = 1; c < header.length; c++) {
    if (isYear(header[c])) yearCols.push({ c, label: String(header[c]).trim() })
  }
  const years = yearCols.map((y) => y.label)
  const series = []
  for (let r = hi + 1; r < rows.length; r++) {
    const name = rows[r][0]
    if (name == null || String(name).trim() === '') continue
    const values = yearCols.map(({ c }) => {
      const v = rows[r][c]
      if (v === '' || v == null) return null
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[, ]/g, ''))
      return Number.isNaN(n) ? null : Math.abs(n)
    })
    if (values.some((v) => v != null)) series.push({ name: String(name).trim(), values })
  }
  return { years, series }
}

export default function StackedBarPanel({ chart, onSaved }) {
  const [table, setTable] = useState(() => {
    try { return chart.image_data ? JSON.parse(chart.image_data) : null } catch { return null }
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const fileRef = useRef(null)

  const { data, keys } = useMemo(() => {
    if (!table) return { data: [], keys: [] }
    const k = table.series.map((s) => s.name)
    const d = table.years.map((y, i) => {
      const row = { year: y }
      for (const s of table.series) row[s.name] = s.values[i]
      return row
    })
    return { data: d, keys: k }
  }, [table])

  async function loadFile(file) {
    if (!file) return
    setBusy(true); setMsg(null)
    try {
      const buf = await file.arrayBuffer()
      const parsed = parseWorkbook(buf)
      if (!parsed.years.length || !parsed.series.length) throw new Error('No year columns / rows found')
      await updateChart(chart.id, { image_data: JSON.stringify(parsed) })
      setTable(parsed)
      setMsg({ kind: 'good', text: `Loaded ${parsed.series.length} rows × ${parsed.years.length} years.` })
      onSaved && onSaved()
    } catch (e) {
      setMsg({ kind: 'bad', text: `Couldn't read that file: ${e.message || e}` })
    } finally {
      setBusy(false)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer?.files?.[0]
    if (f) loadFile(f)
  }

  const CustomTip = ({ active, label, payload }) => {
    if (!active || !payload) return null
    const total = payload.reduce((s, p) => s + (p.value || 0), 0)
    return (
      <div style={{ background: '#171e2e', border: '1px solid #2a3550', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
        <strong>{label}</strong>: {fmtNum(total)}
      </div>
    )
  }

  return (
    <div>
      {data.length ? (
        <>
        <div style={{ width: '100%', height: 360 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="#2a3550" strokeDasharray="3 3" />
              <XAxis dataKey="year" tick={{ fill: '#93a0bd', fontSize: 11 }} stroke="#2a3550" />
              <YAxis tick={{ fill: '#93a0bd', fontSize: 11 }} stroke="#2a3550" width={70} tickFormatter={(v) => fmtNum(v)} />
              <Tooltip content={<CustomTip />} />
              {keys.map((k, i) => (
                <Bar key={k} dataKey={k} stackId="a" fill={color(i)} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="stack-legend">
          {keys.map((k, i) => (
            <span className="leg" key={k}>
              <i style={{ background: color(i) }} />{k}
            </span>
          ))}
        </div>
        </>
      ) : (
        <div className="image-drop-empty" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          Drag an Excel table here (company rows × year columns) — or use Upload below.
        </div>
      )}

      <div className="image-controls no-print" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <span className="manual-label">Drag an .xlsx here to rebuild — or</span>
        <div className="btn-row">
          <button className="btn small" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Loading…' : (table ? 'Replace data' : 'Upload Excel')}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
            onChange={(e) => loadFile(e.target.files?.[0])} />
        </div>
      </div>
      {msg && <div className={`inline-msg ${msg.kind} no-print`}>{msg.text}</div>}
    </div>
  )
}
