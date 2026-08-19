import { useEffect, useRef, useState } from 'react'

// Renders `children` only once the element scrolls near the viewport, so pages
// with many charts don't fire dozens of data fetches at once.
export default function Lazy({ height = 260, eager = false, children }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (eager) { setVisible(true); return }
    if (visible || !ref.current) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    io.observe(ref.current)
    return () => io.disconnect()
  }, [visible, eager])

  return (
    <div ref={ref}>
      {visible ? children : <div className="chart-msg" style={{ height }}>…</div>}
    </div>
  )
}
