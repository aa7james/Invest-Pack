// Supabase connection for the Invest-Pack dashboard.
//
// These two values are SAFE to commit and ship to the browser:
//   - The Project URL is public.
//   - The *publishable* key is designed to be exposed in client apps; it can only
//     do what Row-Level Security (RLS) policies allow, and those policies restrict
//     it to the isolated `pack` schema only.
//
// The *secret* key is NEVER placed here or anywhere in this repo. It lives only in
// the watcher's local .env on the Bloomberg PC.
//
// If you ever rotate the key, you can override these at build time on Vercel by
// setting VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY env vars.

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://knciqlbngtmsgmhnbfce.supabase.co'

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_YwMLfMra6vzUnfvkn9uqTw_akegqlYp'

// All dashboard tables live in this isolated schema, never `public`.
export const DB_SCHEMA = 'pack'
