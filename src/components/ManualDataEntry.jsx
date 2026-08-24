import { useState } from 'react'
import DataEditorModal from './DataEditorModal'

// Shown under a chart with a manual (non-Bloomberg) series: a button that opens
// the pop-up data editor (add / remove / change rows, then save to Supabase).
export default function ManualDataEntry({ instrument, onAdded }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="manual-entry no-print">
      <div className="manual-row">
        <span className="manual-label">Manual series{instrument.unit ? ` · ${instrument.unit}` : ''}</span>
        <div className="card-actions">
          {instrument.source_url && (
            <a className="manual-link" href={instrument.source_url} target="_blank" rel="noreferrer">Source ↗</a>
          )}
          <button className="btn small" onClick={() => setOpen(true)}>✎ Edit data</button>
        </div>
      </div>
      {open && (
        <DataEditorModal
          instrument={instrument}
          onClose={() => setOpen(false)}
          onSaved={() => onAdded && onAdded()}
        />
      )}
    </div>
  )
}
