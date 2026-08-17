import { supabase } from '../supabaseClient'

// Fetch all saved charts with their series (joined).
export async function fetchCharts() {
  const { data: charts, error } = await supabase
    .from('charts')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error

  const { data: series, error: e2 } = await supabase
    .from('chart_series')
    .select('*')
    .order('sort_order', { ascending: true })
  if (e2) throw e2

  const byChart = new Map()
  for (const s of series ?? []) {
    if (!byChart.has(s.chart_id)) byChart.set(s.chart_id, [])
    byChart.get(s.chart_id).push(s)
  }
  return (charts ?? []).map((c) => ({ ...c, series: byChart.get(c.id) ?? [] }))
}

// Create a chart + its series. `series` = [{ instrument_id, role, sort_order }]
export async function createChart({ title, chart_type, time_range, series }) {
  const { data: chart, error } = await supabase
    .from('charts')
    .insert({ title, chart_type, time_range })
    .select()
    .single()
  if (error) throw error

  if (series && series.length) {
    const rows = series.map((s, i) => ({
      chart_id: chart.id,
      instrument_id: s.instrument_id,
      role: s.role || 'series',
      sort_order: s.sort_order ?? i,
    }))
    const { error: e2 } = await supabase.from('chart_series').insert(rows)
    if (e2) throw e2
  }
  return chart
}

export async function updateChart(id, patch) {
  const { error } = await supabase
    .from('charts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteChart(id) {
  const { error } = await supabase.from('charts').delete().eq('id', id)
  if (error) throw error
}
