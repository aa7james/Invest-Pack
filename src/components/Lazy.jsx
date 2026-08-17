import { useEffect, useRef, useState } from 'react'

// Renders `children` only once the element scrolls near the viewport, so pages
// with many charts don't fire dozens of data fetches at once.
export default function Lazy({ height = 260, children }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
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
  }, [visible])

  return (
    <div ref={ref}>
      {visible ? children : <div className="chart-msg" style={{ height }}>…</div>}
    </div>
  )
}
