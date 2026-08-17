import { supabase } from '../supabaseClient'

// All queries run against the `pack` schema (pinned in supabaseClient.js).

// Every active + inactive instrument, ordered for display.
export async function fetchInstruments() {
  const { data, error } = await supabase
    .from('instruments')
    .select('id, category, name, bloomberg_ticker, bloomberg_field, currency, is_active')
    .order('category', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Latest stored value per instrument (from the v_latest_values view).
export async function fetchLatestValues() {
  const { data, error } = await supabase
    .from('v_latest_values')
    .select('instrument_id, obs_date, value, updated_at')
  if (error) throw error
  const map = new Map()
  for (const row of data ?? []) map.set(row.instrument_id, row)
  return map
}

// One-row summary powering the header.
export async function fetchSummary() {
  const { data, error } = await supabase
    .from('v_data_summary')
    .select('*')
    .single()
  if (error) throw error
  return data
}

// The most recent refresh request (to show status).
export async function fetchLatestRequest() {
  const { data, error } = await supabase
    .from('data_update_requests')
    .select('id, status, mode, requested_at, started_at, completed_at, rows_written, message')
    .order('requested_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return (data && data[0]) || null
}

// Queue a refresh: insert a single 'pending' row. This is ALL the button does —
// the watcher on the Bloomberg PC does the actual pull. `mode` is 'snapshot'
// (today's values) or 'backfill' (full history).
export async function queueRefresh(mode = 'snapshot') {
  const { data, error } = await supabase
    .from('data_update_requests')
    .insert({ status: 'pending', mode })
    .select()
    .single()
  if (error) throw error
  return data
}

// Poll a single request by id.
export async function fetchRequestById(id) {
  const { data, error } = await supabase
    .from('data_update_requests')
    .select('id, status, mode, requested_at, started_at, completed_at, rows_written, message')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}
