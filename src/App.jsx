import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchInstruments,
  fetchLatestValues,
  fetchSummary,
  fetchLatestRequest,
  queueRefresh,
  fetchRequestById,
} from './lib/data'
import { fmtTimestamp } from './lib/format'
import SummaryCards from './components/SummaryCards'
import InstrumentTable from './components/InstrumentTable'

// How long to poll a queued refresh before telling the user it's still pending.
const POLL_MS = 3000
const POLL_TIMEOUT_MS = 30000

export default function App() {
  const [instruments, setInstruments] = useState([])
  const [latest, setLatest] = useState(new Map())
  const [summary, setSummary] = useState(null)
  const [lastRequest, setLastRequest] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [banner, setBanner] = useState(null) // { kind, text }
  const [refreshing, setRefreshing] = useState(false)

  const pollTimer = useRef(null)

  // Re-read everything from Supabase.
  const loadAll = useCallback(async () => {
    setError(null)
    try {
      const [insts, lv, sum, req] = await Promise.all([
        fetchInstruments(),
        fetchLatestValues(),
        fetchSummary(),
        fetchLatestRequest(),
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
  }, [])

  useEffect(() => {
    loadAll()
    return () => { if (pollTimer.current) clearInterval(pollTimer.current) }
  }, [loadAll])

  // Queue a refresh request, then poll it until the watcher finishes it.
  const onRefresh = useCallback(async (mode) => {
    setRefreshing(true)
    setBanner({ kind: 'info', text: 'Queuing refresh request…' })
    try {
      const req = await queueRefresh(mode)
      setBanner({
        kind: 'info',
        text: `Refresh queued (request #${req.id}, ${mode}). Waiting for the Bloomberg watcher to pick it up…`,
      })

      const startedAt = Date.now()
      if (pollTimer.current) clearInterval(pollTimer.current)
      pollTimer.current = setInterval(async () => {
        try {
          const latestReq = await fetchRequestById(req.id)
          setLastRequest(latestReq)

          if (latestReq.status === 'done') {
            clearInterval(pollTimer.current)
            setRefreshing(false)
            setBanner({
              kind: 'good',
              text: `Refresh complete — ${latestReq.rows_written ?? 0} rows written.`,
            })
            await loadAll()
          } else if (latestReq.status === 'error') {
            clearInterval(pollTimer.current)
            setRefreshing(false)
            setBanner({ kind: 'bad', text: `Refresh failed: ${latestReq.message || 'unknown error'}` })
          } else if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            clearInterval(pollTimer.current)
            setRefreshing(false)
            setBanner({
              kind: 'warn',
              text:
                `Request #${req.id} is still "${latestReq.status}". The watcher on the Bloomberg PC ` +
                `will process it (runs ~every minute). This dashboard will show the data once it lands — ` +
                `hit "Reload view" then.`,
            })
          }
        } catch (e) {
          clearInterval(pollTimer.current)
          setRefreshing(false)
          setBanner({ kind: 'bad', text: `Error polling request: ${e.message || e}` })
        }
      }, POLL_MS)
    } catch (e) {
      setRefreshing(false)
      setBanner({ kind: 'bad', text: `Could not queue refresh: ${e.message || e}` })
    }
  }, [loadAll])

  const lastUpdated = summary?.last_updated

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>Invest-Pack Dashboard</h1>
          <div className="sub">Bloomberg-driven commodity &amp; equity drivers · isolated <code>pack</code> schema</div>
        </div>
        <div className="updated">
          <div className="stamp">
            Data last updated: <strong>{fmtTimestamp(lastUpdated)}</strong>
          </div>
          <div className="btn-row">
            <button className="btn ghost" onClick={loadAll} disabled={loading}>
              Reload view
            </button>
            <button className="btn" onClick={() => onRefresh('snapshot')} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh from Bloomberg'}
            </button>
          </div>
        </div>
      </div>

      {banner && <div className={`banner ${banner.kind}`}>{banner.text}</div>}

      {error && (
        <div className="banner bad">
          <strong>Couldn't load data.</strong> {error}
          <div className="muted" style={{ marginTop: 6 }}>
            If this mentions the schema, make sure <code>pack</code> is added under
            Supabase → Settings → Data API → Exposed schemas, and that you've run the schema + seed SQL.
          </div>
        </div>
      )}

      {loading ? (
        <div className="center">Loading…</div>
      ) : (
        <>
          <SummaryCards summary={summary} />
          {lastRequest && (
            <div className="banner info">
              Last refresh request: #{lastRequest.id} · <strong>{lastRequest.status}</strong>
              {lastRequest.mode ? ` · ${lastRequest.mode}` : ''}
              {lastRequest.completed_at ? ` · completed ${fmtTimestamp(lastRequest.completed_at)}` : ''}
              {lastRequest.message ? ` · ${lastRequest.message}` : ''}
            </div>
          )}
          <InstrumentTable instruments={instruments} latest={latest} />
        </>
      )}

      <div className="footer">
        Invest-Pack · milestone 1 (data plumbing). Charts &amp; pack layout come later.
      </div>
    </div>
  )
}
