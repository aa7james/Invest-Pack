// Per-chart axis overrides (date window + y-axis min/max), saved in the browser.
//
// These are *display preferences* on top of the chart's own data — blank means
// "automatic" (the chart's normal behaviour). We keep them in localStorage,
// keyed by the chart's database id, so they persist across reloads and print
// into the PDF, with no database change and no setup. They're per-browser: a
// different computer or a cleared cache starts fresh.

const FIELDS = ['x_min', 'x_max', 'y_min', 'y_max', 'height']
const keyFor = (id) => `investpack_axis_${id}`

export function getAxis(id) {
  try {
    const raw = localStorage.getItem(keyFor(id))
    const obj = raw ? JSON.parse(raw) : {}
    return obj && typeof obj === 'object' ? obj : {}
  } catch {
    return {}
  }
}

export function saveAxis(id, values) {
  try {
    const clean = {}
    for (const f of FIELDS) {
      const v = values[f]
      if (v !== '' && v != null) clean[f] = v
    }
    if (Object.keys(clean).length) {
      localStorage.setItem(keyFor(id), JSON.stringify(clean))
    } else {
      localStorage.removeItem(keyFor(id))
    }
  } catch {
    /* storage unavailable — settings just won't persist; not fatal */
  }
}
