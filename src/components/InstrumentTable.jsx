import { fmtNum, fmtDate } from '../lib/format'

// Instruments grouped by category, each showing its latest stored value.
export default function InstrumentTable({ instruments, latest }) {
  if (!instruments.length) {
    return <div className="center">No instruments found. Have you run the seed SQL?</div>
  }

  // Group by category, preserving the sorted order.
  const groups = []
  const byCat = new Map()
  for (const inst of instruments) {
    if (!byCat.has(inst.category)) {
      const g = { category: inst.category, rows: [] }
      byCat.set(inst.category, g)
      groups.push(g)
    }
    byCat.get(inst.category).rows.push(inst)
  }

  return (
    <>
      {groups.map((g) => (
        <div className="category" key={g.category}>
          <h2>{g.category} <span className="muted">({g.rows.length})</span></h2>
          <table>
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Instrument</th>
                <th>Bloomberg</th>
                <th>Field</th>
                <th>Ccy</th>
                <th className="num">Latest value</th>
                <th className="num">As of</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((inst) => {
                const lv = latest.get(inst.id)
                return (
                  <tr key={inst.id}>
                    <td>{inst.name}</td>
                    <td className="ticker">{inst.bloomberg_ticker || '—'}</td>
                    <td className="ticker">{inst.bloomberg_field}</td>
                    <td>
                      {inst.currency
                        ? <span className="pill ccy">{inst.currency}</span>
                        : <span className="muted">—</span>}
                    </td>
                    <td className="num">{lv ? fmtNum(lv.value) : '—'}</td>
                    <td className="num">{lv ? fmtDate(lv.obs_date) : '—'}</td>
                    <td>
                      {inst.is_active
                        ? <span className="pill ccy">active</span>
                        : <span className="pill off">inactive</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}
