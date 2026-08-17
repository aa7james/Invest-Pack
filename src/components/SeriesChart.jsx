import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { buildValueSeries, buildSpreadSeries } from '../lib/series'
import { fmtNum } from '../lib/format'

export const CHART_COLORS = [
  '#4f8cff', '#35c78a', '#e0a13a', '#e5674f', '#b06fe0',
  '#3ec9c9', '#e56fae', '#8fb03a', '#ff8c42', '#6c8cff',
]

function axisDate(iso) {
  const [y, m] = String(iso).split('-')
  return `${m}/${y.slice(2)}`
}

// Build unique, human-readable keys for a chart's series.
function keysFor(series, instrumentsById) {
  const seen = new Map()
  return series.map((s) => {
    const inst = instrumentsById.get(s.instrument_id)
    let label = inst ? inst.name : `#${s.instrument_id}`
    if (inst && inst.currency) label += ` (${inst.currency})`
    const n = (seen.get(label) || 0) + 1
    seen.set(label, n)
    if (n > 1) label += ` #${n}`
    return { ...s, key: label }
  })
}

export default function SeriesChart({ def, range, anchorISO, instrumentsById, height = 280 }) {
  const [state, setState] = useState({ loading: true, data: [], keys: [], error: null, last: {} })

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    ;(async () => {
      try {
        let res
        if (def.chart_type === 'spread') {
          const a = def.series.find((s) => s.role === 'spread_a')
          const b = def.series.find((s) => s.role === 'spread_b')
          const an = instrumentsById.get(a?.instrument_id)
          const bn = instrumentsById.get(b?.instrument_id)
          const label = `${an?.name || '?'} − ${bn?.name || '?'}`
          res = await buildSpreadSeries(
            { instrumentId: a.instrument_id }, { instrumentId: b.instrument_id },
            anchorISO, range, label,
          )
        } else {
          const withKeys = keysFor(def.series, instrumentsById)
          res = await buildValueSeries(
            withKeys.map((s) => ({ key: s.key, instrumentId: s.instrument_id })),
            anchorISO, range,
          )
        }
        if (!alive) return
        const last = {}
        for (const k of res.keys) {
          for (let i = res.data.length - 1; i >= 0; i--) {
            if (res.data[i][k] != null) { last[k] = res.data[i][k]; break }
          }
        }
        setState({ loading: false, data: res.data, keys: res.keys, error: null, last })
      } catch (e) {
        if (alive) setState({ loading: false, data: [], keys: [], error: e.message || String(e), last: {} })
      }
    })()
    return () => { alive = false }
  }, [def, range, anchorISO, instrumentsById])

  if (state.error) return <div className="chart-msg err">Chart error: {state.error}</div>
  if (state.loading) return <div className="chart-msg" style={{ height }}>Loading chart…</div>
  if (!state.data.length) return <div className="chart-msg" style={{ height }}>No data in this range.</div>

  return (
    <div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <LineChart data={state.data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="#2a3550" strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={axisDate} tick={{ fill: '#93a0bd', fontSize: 11 }}
              minTickGap={40} stroke="#2a3550" />
            <YAxis tick={{ fill: '#93a0bd', fontSize: 11 }} stroke="#2a3550"
              tickFormatter={(v) => fmtNum(v)} width={70} />
            <Tooltip
              contentStyle={{ background: '#171e2e', border: '1px solid #2a3550', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#e7ecf5' }}
              formatter={(v) => fmtNum(v)} />
            {state.keys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]}
                dot={false} strokeWidth={1.6} connectNulls isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend">
        {state.keys.map((k, i) => (
          <span className="leg" key={k}>
            <i style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            {k}: <strong>{fmtNum(state.last[k])}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}
