import { useRef, useState } from 'react'
import { updateChart } from '../lib/charts'

// Downscale an image file/blob to a reasonable size and return a JPEG data URL.
function toDataURL(file, maxW = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}

// A pack panel that holds a pasted/uploaded screenshot (for screenshot-based
// sources like the Eskom generation dashboard). Saves the image into Supabase.
export default function ImagePanel({ chart, onSaved }) {
  const [image, setImage] = useState(chart.image_data || null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const fileRef = useRef(null)

  async function save(file) {
    if (!file) return
    setBusy(true); setMsg(null)
    try {
      const dataUrl = await toDataURL(file)
      await updateChart(chart.id, { image_data: dataUrl })
      setImage(dataUrl)
      setMsg({ kind: 'good', text: 'Screenshot updated.' })
      onSaved && onSaved()
    } catch (e) {
      setMsg({ kind: 'bad', text: `Couldn't save image: ${e.message || e}` })
    } finally {
      setBusy(false)
    }
  }

  function onPaste(e) {
    const items = e.clipboardData?.items || []
    for (const it of items) {
      if (it.type && it.type.startsWith('image')) {
        e.preventDefault()
        save(it.getAsFile())
        return
      }
    }
    setMsg({ kind: 'bad', text: 'No image found on the clipboard — copy a screenshot first.' })
  }

  return (
    <div>
      {image
        ? <img className="pack-image" src={image} alt={chart.title} />
        : (
          <div className="image-drop no-print" tabIndex={0} onPaste={onPaste}>
            Click here, then press <strong>Ctrl+V</strong> to paste a screenshot — or use Upload below.
          </div>
        )}

      <div className="image-controls no-print" tabIndex={0} onPaste={onPaste}>
        <span className="manual-label">Screenshot panel — paste (Ctrl+V) here or upload</span>
        <div className="btn-row">
          <button className="btn small" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Saving…' : (image ? 'Replace image' : 'Upload image')}
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={(e) => save(e.target.files?.[0])} />
        </div>
      </div>
      {msg && <div className={`inline-msg ${msg.kind} no-print`}>{msg.text}</div>}
    </div>
  )
}
