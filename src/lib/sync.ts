import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Collection, Deck } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Null until the Supabase env vars are set: the app then runs in local mode. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

interface DeckRow {
  id: string
  user_id?: string
  name: string
  main: number[]
  extra: number[]
  side: number[]
  notes: string | null
  updated_at: string
}

const toRow = (d: Deck, userId: string): DeckRow => ({
  id: d.id,
  user_id: userId,
  name: d.name,
  main: d.main,
  extra: d.extra,
  side: d.side,
  notes: d.notes ?? null,
  updated_at: d.updatedAt,
})

const fromRow = (r: DeckRow): Deck => ({
  id: r.id,
  name: r.name,
  main: r.main ?? [],
  extra: r.extra ?? [],
  side: r.side ?? [],
  notes: r.notes ?? undefined,
  updatedAt: r.updated_at,
})

/** Union by id; the most recently updated copy wins. Returns what the server is missing. */
export function mergeDecks(local: Deck[], remote: Deck[]): { merged: Deck[]; toPush: Deck[] } {
  const byId = new Map(remote.map((d) => [d.id, d]))
  const toPush: Deck[] = []
  for (const d of local) {
    const r = byId.get(d.id)
    if (!r || Date.parse(d.updatedAt) > Date.parse(r.updatedAt)) {
      byId.set(d.id, d)
      toPush.push(d)
    }
  }
  const merged = [...byId.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  return { merged, toPush }
}

/** Per card, keep the larger owned count (first sign-in on a device must not lose cards). */
export function mergeCollections(local: Collection, remote: Collection): { merged: Collection; toPush: Collection } {
  const merged: Collection = { ...remote }
  const toPush: Collection = {}
  for (const [id, qty] of Object.entries(local)) {
    const k = Number(id)
    if (qty > (remote[k] ?? 0)) {
      merged[k] = qty
      toPush[k] = qty
    }
  }
  return { merged, toPush }
}

function client(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export async function fetchRemote(): Promise<{ decks: Deck[]; collection: Collection }> {
  const sb = client()
  const { data: deckRows, error: e1 } = await sb.from('decks').select('id,name,main,extra,side,notes,updated_at')
  if (e1) throw e1
  const collection: Collection = {}
  // PostgREST returns at most 1000 rows per request; page through big collections.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('collection').select('card_id,qty').order('card_id').range(from, from + 999)
    if (error) throw error
    for (const r of data ?? []) collection[r.card_id as number] = r.qty as number
    if (!data || data.length < 1000) break
  }
  return { decks: (deckRows as DeckRow[]).map(fromRow), collection }
}

export async function pushDecks(decks: Deck[], userId: string): Promise<void> {
  if (!decks.length) return
  const { error } = await client().from('decks').upsert(decks.map((d) => toRow(d, userId)))
  if (error) throw error
}

export async function removeDecks(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await client().from('decks').delete().in('id', ids)
  if (error) throw error
}

export async function pushCollection(changes: Collection, userId: string): Promise<void> {
  const sb = client()
  const entries = Object.entries(changes).map(([id, qty]) => ({ card_id: Number(id), qty }))
  const upserts = entries.filter((e) => e.qty > 0).map((e) => ({ ...e, user_id: userId }))
  const deletes = entries.filter((e) => e.qty <= 0).map((e) => e.card_id)
  for (let i = 0; i < upserts.length; i += 500) {
    const { error } = await sb.from('collection').upsert(upserts.slice(i, i + 500), { onConflict: 'user_id,card_id' })
    if (error) throw error
  }
  for (let i = 0; i < deletes.length; i += 500) {
    const { error } = await sb.from('collection').delete().in('card_id', deletes.slice(i, i + 500))
    if (error) throw error
  }
}

export async function sendMagicLink(email: string): Promise<void> {
  const redirect = window.location.origin + import.meta.env.BASE_URL
  const { error } = await client().auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } })
  if (error) throw error
}
