import { RANGES } from '../lib/series'

// Row of time-range buttons (1M, 3M, ... ALL).
export default function TimeRange({ value, onChange }) {
  return (
    <div className="range-row">
      {RANGES.map((r) => (
        <button
          key={r}
          className={`range-btn ${value === r ? 'active' : ''}`}
          onClick={() => onChange(r)}
        >
          {r}
        </button>
      ))}
    </div>
  )
}
