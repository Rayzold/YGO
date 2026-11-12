// Re-host card images from YGOPRODeck into the public `card-images` Storage bucket.
//
// YGOPRODeck asks API users not to hotlink: download each image once, host it yourself,
// and keep the request rate low. pg_cron calls this function every 2 minutes (see
// supabase/migrations/20261112000100_card_images.sql) with a one-time `x-job-token`;
// without a valid token the database hands out no work, so the function does nothing.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SOURCE = 'https://images.ygoprodeck.com/images/cards_small'
const PER_RUN = 120 // ~2-3 requests/second -> about a minute per run
const DELAY_MS = 250
const USER_AGENT = 'ygo-deck-builder-image-sync (+https://github.com/Rayzold/YGO)'

type Status = 'ok' | 'missing' | 'error'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function adminKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>
    if (parsed.default) return parsed.default
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
}

Deno.serve(async (req) => {
  const token = req.headers.get('x-job-token')
  if (!token) return json({ error: 'missing job token' }, 401)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, adminKey(), { auth: { persistSession: false } })
  const { data: jobs, error } = await sb.rpc('claim_image_job', { job_token: token, max_rows: PER_RUN })
  if (error) return json({ error: error.message }, 403)

  const results: { card_id: number; status: Status; attempts: number; synced_at: string }[] = []
  const counts: Record<Status, number> = { ok: 0, missing: 0, error: 0 }
  for (const job of (jobs ?? []) as { card_id: number; attempts: number }[]) {
    let status: Status = 'error'
    try {
      const res = await fetch(`${SOURCE}/${job.card_id}.jpg`, { headers: { 'User-Agent': USER_AGENT } })
      if (res.status === 404) {
        status = 'missing'
        await res.body?.cancel()
      } else if (res.ok) {
        const body = new Uint8Array(await res.arrayBuffer())
        const { error: upErr } = await sb.storage
          .from('card-images')
          .upload(`${job.card_id}.jpg`, body, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' })
        if (upErr) console.error(`upload ${job.card_id}: ${upErr.message}`)
        else status = 'ok'
      } else {
        console.error(`fetch ${job.card_id}: HTTP ${res.status}`)
        await res.body?.cancel()
      }
    } catch (e) {
      console.error(`fetch ${job.card_id}: ${e}`)
    }
    counts[status]++
    results.push({ card_id: job.card_id, status, attempts: job.attempts + 1, synced_at: new Date().toISOString() })
    await sleep(DELAY_MS)
  }

  if (results.length) {
    const { error: e2 } = await sb.from('card_images').upsert(results)
    if (e2) return json({ error: e2.message, ...counts }, 500)
  }
  return json({ processed: results.length, ...counts })
})
