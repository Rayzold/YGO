/**
 * Public Supabase settings. The publishable key is designed to ship in browser code:
 * every table is protected by Row Level Security (see supabase/migrations).
 * Override with VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / VITE_IMAGE_BASE,
 * or set VITE_SUPABASE_URL=off to run fully local.
 */
const env = import.meta.env

const DEFAULT_URL = 'https://zbzvfkgutcqbyznswvqs.supabase.co'
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_JMzLOTMmhrm1hLpthIapZA_i_8ZNZYB'

const rawUrl = (env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_URL

export const SUPABASE_URL: string | null = rawUrl === 'off' ? null : rawUrl.replace(/\/$/, '')

export const SUPABASE_KEY: string =
  (env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  DEFAULT_PUBLISHABLE_KEY

/** Card images re-hosted in Supabase Storage by the sync-card-images Edge Function. */
export const IMAGE_BASE: string | null =
  ((env.VITE_IMAGE_BASE as string | undefined) || (SUPABASE_URL && `${SUPABASE_URL}/storage/v1/object/public/card-images`) || '')
    .replace(/\/$/, '') || null
