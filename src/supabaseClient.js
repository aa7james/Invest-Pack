import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, DB_SCHEMA } from './config'

// A single shared Supabase client, pinned to the isolated `pack` schema so this
// dashboard can never read or write the `public` tables (bond_data, instruments, etc.).
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: DB_SCHEMA },
  auth: { persistSession: false },
})
