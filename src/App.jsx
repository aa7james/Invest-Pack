import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchInstruments, fetchLatestValues, fetchSummary, fetchLatestRequest,
  queueRefresh, fetchRequestById,
} from './lib/data'
import { fetchCharts } from './lib/charts'
import { fmtTimestamp } from './lib/format'
import ChartBuilder from './components/ChartBuilder'
import MyCharts from './components/MyCharts'
import InvestmentPack from './components/InvestmentPack'

const POLL_MS = 3000
const POLL_TIMEOUT_MS = 30000

const TABS = [
  { key: 'pack', label: 'Investment Pack' },
  { key: 'builder', label: 'Chart Builder' },
  { key: 'mycharts', label: 'My Charts' },
]

export default function App() {
  const [instruments, setInstruments] = useState([])
  const [latest, setLatest] = useState(new Map())
  const [summary, setSummary] = useState(null)
  const [lastRequest, setLastRequest] = useState(null)
  const [charts, setCharts] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [banner, setBanner] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState('pack')

  const pollTimer = useRef(null)

  const loadAll = useCallback(async () => {
    setError(null)
    // Supabase's free tier pauses when idle, so the first query after a break can
    // time out while it wakes up. Retry a few times before showing an error.
    const withRetry = async (fn, tries = 4) => {
      for (let i = 0; i < tries; i++) {
        try { return await fn() } catch (e) {
          const msg = e.message || String(e)
          const transient = /timeout|fetch|network|502|503|504/i.test(msg)
          if (i === tries - 1 || !transient) throw e
          await new Promise((r) => setTimeout(r, 800 * (i + 1)))
        }
      }
    }
    try {
      const [insts, lv, sum, req] = await Promise.all([
        withRetry(fetchInstruments), withRetry(fetchLatestValues),
        withRetry(fetchSummary), withRetry(fetchLatestRequest),
      ])
      setInstruments(insts)
      setLatest(lv)
      setSummary(sum)
      setLastRequest(req)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
    // Charts tables may not exist yet — tolerate that so the rest of the app works.
    try { setCharts(await fetchCharts()) } catch { setCharts([]) }
  }, [])

  const reloadCharts = useCallback(async () => {
    try { setCharts(await fetchCharts()) } catch { setCharts([]) }
  }, [])

  useEffect(() => {
    loadAll()
    return () => { if (pollTimer.current) clearInterval(pollTimer.current) }
  }, [loadAll])

  const onRefresh = useCallback(async (mode) => {
    setRefreshing(true)
    setBanner({ kind: 'info', text: 'Queuing refresh request…' })
    try {
      const req = await queueRefresh(mode)
      setBanner({ kind: 'info', text: `Refresh queued (request #${req.id}). Waiting for the Bloomberg watcher…` })
      const startedAt = Date.now()
      if (pollTimer.current) clearInterval(pollTimer.current)
      pollTimer.current = setInterval(async () => {
        try {
          const r = await fetchRequestById(req.id)
          setLastRequest(r)
          if (r.status === 'done') {
            clearInterval(pollTimer.current); setRefreshing(false)
            setBanner({ kind: 'good', text: `Refresh complete — ${r.rows_written ?? 0} rows written.` })
            await loadAll()
          } else if (r.status === 'error') {
            clearInterval(pollTimer.current); setRefreshing(false)
            setBanner({ kind: 'bad', text: `Refresh failed: ${r.message || 'unknown error'}` })
          } else if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            clearInterval(pollTimer.current); setRefreshing(false)
            setBanner({ kind: 'warn', text: `Request #${req.id} is still "${r.status}". The watcher (on the Bloomberg PC) will process it — not installed yet.` })
          }
        } catch (e) {
          clearInterval(pollTimer.current); setRefreshing(false)
          setBanner({ kind: 'bad', text: `Error polling request: ${e.message || e}` })
        }
      }, POLL_MS)
    } catch (e) {
      setRefreshing(false)
      setBanner({ kind: 'bad', text: `Could not queue refresh: ${e.message || e}` })
    }
  }, [loadAll])

  const instrumentsById = useMemo(() => {
    const m = new Map()
    for (const i of instruments) m.set(i.id, i)
    return m
  }, [instruments])

  const activeInstruments = useMemo(
    () => instruments.filter((i) => i.is_active !== false),
    [instruments],
  )

  const anchorISO = summary?.date_max || null
  const packCount = charts.filter((c) => c.in_pack).length

  return (
    <div className="app">
      <div className="header no-print">
        <div>
          <h1>Invest-Pack Dashboard</h1>
          <div className="sub">Bloomberg-driven commodity &amp; equity drivers · isolated <code>pack</code> schema</div>
        </div>
        <div className="updated">
          <div className="stamp">Data last updated: <strong>{fmtTimestamp(summary?.last_updated)}</strong></div>
          <div className="btn-row">
            <button className="btn ghost" onClick={loadAll} disabled={loading}>Reload view</button>
            <button className="btn" onClick={() => onRefresh('snapshot')} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh from Bloomberg'}
            </button>
          </div>
        </div>
      </div>

      <div className="tabs no-print">
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}{t.key === 'pack' && packCount ? ` (${packCount})` : ''}
          </button>
        ))}
      </div>

      {banner && <div className={`banner ${banner.kind} no-print`}>{banner.text}</div>}
      {error && (
        <div className="banner bad no-print">
          <strong>Couldn't load data.</strong> {error}
        </div>
      )}

      {loading ? (
        <div className="center">Loading…</div>
      ) : (
        <>
          {tab === 'builder' && (
            <ChartBuilder instruments={activeInstruments} instrumentsById={instrumentsById}
              anchorISO={anchorISO} onSaved={() => { reloadCharts(); setTab('mycharts') }} />
          )}
          {tab === 'mycharts' && (
            <MyCharts charts={charts} instrumentsById={instrumentsById}
              anchorISO={anchorISO} onChanged={reloadCharts} />
          )}
          {tab === 'pack' && (
            <InvestmentPack charts={charts} instrumentsById={instrumentsById}
              anchorISO={anchorISO} onChanged={reloadCharts} />
          )}
        </>
      )}

      <div className="footer no-print">Invest-Pack · Chart Builder + Investment Pack</div>
    </div>
  )
}
