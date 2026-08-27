import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import {
  buildValueSeries, buildSpreadSeries, buildIndexedSeries, buildNitrogenSpread,
  buildRatioSeries, buildCorrelation, buildSpongePremium, buildCornCompare, buildSeasonal,
  buildCropProgress, buildIqfRatio, buildProxyFeed,
} from '../lib/series'
import { fmtNum } from '../lib/format'

export const CHART_COLORS = [
  '#4f8cff', '#35c78a', '#e0a13a', '#e5674f', '#b06fe0',
  '#3ec9c9', '#e56fae', '#8fb03a', '#ff8c42', '#6c8cff',
]

// Distinct colour per series; golden-angle hues when there are many (e.g. seasons).
function lineColor(i, n) {
  if (n > CHART_COLORS.length) return `hsl(${Math.round((i * 137.508) % 360)}, 65%, 55%)`
  return CHART_COLORS[i % CHART_COLORS.length]
}

function axisDate(iso) {
  // Data spans many years, so label the axis by year only.
  return String(iso).slice(0, 4)
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

export default function SeriesChart({ def, range, anchorISO, instrumentsById, height = 280, reloadKey = 0 }) {
  const [state, setState] = useState({ loading: true, data: [], keys: [], error: null, last: {}, xKey: 'date', ticks: null, tickLabels: null, dual: null })

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    ;(async () => {
      try {
        let res
        if (def.chart_type === 'crop_progress') {
          const d = def.series.find((s) => s.role === 'deliveries')
          const a = def.series.find((s) => s.role === 'adjustments')
          res = await buildCropProgress(d?.instrument_id, a?.instrument_id)
        } else if (def.chart_type === 'proxy_feed') {
          const mz = def.series.find((s) => s.role === 'maize')
          const so = def.series.find((s) => s.role === 'soya')
          const st = def.series.find((s) => s.role === 'feedstore')
          res = await buildProxyFeed(mz?.instrument_id, so?.instrument_id, st?.instrument_id)
        } else if (def.chart_type === 'iqf_ratio' || def.chart_type === 'iqf_ratio_lag') {
          const sh = def.series.find((s) => s.role === 'share')
          const po = def.series.find((s) => s.role === 'poultry')
          const mz = def.series.find((s) => s.role === 'maize')
          const so = def.series.find((s) => s.role === 'soya')
          const st = def.series.find((s) => s.role === 'feedstore')
          const lag = def.chart_type === 'iqf_ratio_lag' ? 6 : 0
          res = await buildIqfRatio(sh?.instrument_id, po?.instrument_id, mz?.instrument_id,
            so?.instrument_id, st?.instrument_id, lag)
        } else if (def.chart_type === 'seasonal') {
          res = await buildSeasonal(def.series[0].instrument_id)
        } else if (def.chart_type === 'nitrogen_spread') {
          const a = def.series.find((s) => s.role === 'spread_a')
          const b = def.series.find((s) => s.role === 'spread_b')
          const an = instrumentsById.get(a?.instrument_id)
          const bn = instrumentsById.get(b?.instrument_id)
          const label = `${(an?.name || 'A').split(' ')[0]} − 0.58×${(bn?.name || 'B').split(' ')[0]}`
          res = await buildNitrogenSpread(
            { instrumentId: a.instrument_id }, { instrumentId: b.instrument_id },
            anchorISO, range, 0.58, label,
          )
        } else if (def.chart_type === 'correlation') {
          const a = def.series.find((s) => s.role === 'spread_a')
          const b = def.series.find((s) => s.role === 'spread_b')
          res = await buildCorrelation(
            { instrumentId: a.instrument_id }, { instrumentId: b.instrument_id },
            anchorISO, range, 'Platinum–Gold correlation (1y)',
          )
        } else if (def.chart_type === 'sponge_premium') {
          const na = def.series.find((s) => s.role === 'na')
          const eu = def.series.find((s) => s.role === 'eu')
          const spot = def.series.find((s) => s.role === 'spot')
          res = await buildSpongePremium(
            { instrumentId: na.instrument_id }, { instrumentId: eu.instrument_id },
            { instrumentId: spot.instrument_id }, anchorISO, range, 'Sponge premium (60dma, $/oz)',
          )
        } else if (def.chart_type === 'corn_compare') {
          const sa = def.series.find((s) => s.role === 'sa')
          const world = def.series.find((s) => s.role === 'world')
          res = await buildCornCompare(
            { instrumentId: sa.instrument_id }, { instrumentId: world.instrument_id },
            anchorISO, range,
          )
        } else if (def.chart_type === 'ratio') {
          const a = def.series.find((s) => s.role === 'spread_a')
          const b = def.series.find((s) => s.role === 'spread_b')
          const an = instrumentsById.get(a?.instrument_id)
          const bn = instrumentsById.get(b?.instrument_id)
          res = await buildRatioSeries(
            { instrumentId: a.instrument_id }, { instrumentId: b.instrument_id },
            anchorISO, range, `${an?.name || 'A'} / ${bn?.name || 'B'}`,
          )
        } else if (def.chart_type === 'spread') {
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
          const args = [withKeys.map((s) => ({ key: s.key, instrumentId: s.instrument_id })), anchorISO, range]
          res = def.chart_type === 'index'
            ? await buildIndexedSeries(...args)
            : await buildValueSeries(...args)
          // Capex convention: Bloomberg returns TRAIL_12M_CAP_EXPEND as a negative
          // (cash outflow). Show it positive (as the pack does) and drop glitches.
          const negKeys = new Set(withKeys
            .filter((s) => instrumentsById.get(s.instrument_id)?.bloomberg_field === 'TRAIL_12M_CAP_EXPEND')
            .map((s) => s.key))
          if (negKeys.size) {
            res = {
              ...res,
              data: res.data.map((row) => {
                const r = { ...row }
                for (const k of negKeys) {
                  if (r[k] != null) r[k] = Math.abs(r[k]) > 2000 ? null : -r[k]
                }
                return r
              }),
            }
          }
        }
        if (!alive) return
        const last = {}
        for (const k of res.keys) {
          for (let i = res.data.length - 1; i >= 0; i--) {
            if (res.data[i][k] != null) { last[k] = res.data[i][k]; break }
          }
        }
        setState({ loading: false, data: res.data, keys: res.keys, error: null, last, xKey: res.xKey || 'date', ticks: res.ticks || null, tickLabels: res.tickLabels || null, dual: res.dual || null })
      } catch (e) {
        if (alive) setState({ loading: false, data: [], keys: [], error: e.message || String(e), last: {} })
      }
    })()
    return () => { alive = false }
  }, [def, range, anchorISO, instrumentsById, reloadKey])

  if (state.error) return <div className="chart-msg err">Chart error: {state.error}</div>
  if (state.loading) return <div className="chart-msg" style={{ height }}>Loading chart…</div>
  if (!state.data.length) return <div className="chart-msg" style={{ height }}>No data in this range.</div>

  // Dual-axis chart (e.g. share price line + ratio bars on a second axis).
  if (state.dual) {
    const { left, right } = state.dual
    return (
      <div>
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer>
            <ComposedChart data={state.data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="#2a3550" strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={axisDate}
                tick={{ fill: '#93a0bd', fontSize: 11 }} minTickGap={60} stroke="#2a3550" />
              <YAxis yAxisId="L" tick={{ fill: '#93a0bd', fontSize: 11 }} stroke="#2a3550"
                domain={['auto', 'auto']} tickFormatter={(v) => fmtNum(v)} width={64} />
              <YAxis yAxisId="R" orientation="right" tick={{ fill: '#93a0bd', fontSize: 11 }} stroke="#2a3550"
                domain={['auto', 'auto']} tickFormatter={(v) => fmtNum(v)} width={52} />
              <Tooltip contentStyle={{ background: '#171e2e', border: '1px solid #2a3550', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e7ecf5' }} labelFormatter={axisDate} formatter={(v) => fmtNum(v)} />
              {right.map((k, i) => (
                <Bar key={k} yAxisId="R" dataKey={k} fill="#e0a13a" fillOpacity={0.85} isAnimationActive={false} />
              ))}
              {left.map((k, i) => (
                <Line key={k} yAxisId="L" type="monotone" dataKey={k} stroke="#6c7a99"
                  dot={false} strokeWidth={1.8} connectNulls isAnimationActive={false} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-legend">
          {state.keys.map((k, i) => (
            <span className="leg" key={k}>
              <i style={{ background: left.includes(k) ? '#6c7a99' : '#e0a13a' }} />
              {k}: <strong>{fmtNum(state.last[k])}</strong>
            </span>
          ))}
        </div>
      </div>
    )
  }

  // On a seasonal overlay, highlight the current (latest) crop year: bright,
  // thick, and drawn on top of the faded historical years.
  const seasonal = state.xKey === 'month' || state.xKey === 'week'
  const currentKey = seasonal ? state.keys[state.keys.length - 1] : null
  const colorFor = (k, i) => (k === currentKey ? '#ffffff' : lineColor(i, state.keys.length))
  const orderedKeys = seasonal
    ? [...state.keys.filter((k) => k !== currentKey), currentKey]
    : state.keys

  return (
    <div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <LineChart data={state.data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="#2a3550" strokeDasharray="3 3" />
            <XAxis dataKey={state.xKey}
              tickFormatter={state.xKey === 'date' ? axisDate
                : state.xKey === 'week' ? (w) => (state.tickLabels && state.tickLabels[w]) || ''
                : undefined}
              ticks={state.xKey === 'week' && state.ticks ? state.ticks : undefined}
              tick={{ fill: '#93a0bd', fontSize: 11 }} minTickGap={state.xKey === 'date' ? 60 : 0} stroke="#2a3550" />
            <YAxis tick={{ fill: '#93a0bd', fontSize: 11 }} stroke="#2a3550"
              domain={['auto', 'auto']} tickFormatter={(v) => fmtNum(v)} width={70} />
            <Tooltip
              contentStyle={{ background: '#171e2e', border: '1px solid #2a3550', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#e7ecf5' }}
              labelFormatter={state.xKey === 'week'
                ? (w) => `${(state.tickLabels && state.tickLabels[w]) || 'Week'} · week ${w}`
                : undefined}
              formatter={(v) => fmtNum(v)} />
            {orderedKeys.map((k) => {
              const i = state.keys.indexOf(k)
              const isCurrent = k === currentKey
              return (
                <Line key={k} type="monotone" dataKey={k} stroke={colorFor(k, i)}
                  dot={false} strokeWidth={isCurrent ? 3.4 : 1.4}
                  strokeOpacity={seasonal && !isCurrent ? 0.55 : 1}
                  connectNulls isAnimationActive={false} />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend">
        {state.keys.map((k, i) => {
          const isCurrent = k === currentKey
          return (
            <span className="leg" key={k}
              style={isCurrent ? { color: '#fff', fontWeight: 700 } : undefined}>
              <i style={{ background: colorFor(k, i) }} />
              {k}: <strong>{fmtNum(state.last[k])}</strong>
            </span>
          )
        })}
      </div>
    </div>
  )
}
