import type { Card, CardIndex, CardMeta } from './types'

const base = import.meta.env.BASE_URL

export function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”]/g, (q) => (q === '‘' || q === '’' ? "'" : '"'))
    .replace(/\s+/g, ' ')
    .trim()
}

/** Fill the optional fields the pipeline drops when empty. */
export function normaliseCard(c: Partial<Card> & Pick<Card, 'id' | 'name' | 'type'>): Card {
  return {
    ...c,
    line: c.line ?? '',
    series: c.series ?? [],
    mentions: c.mentions ?? [],
    tags: c.tags ?? [],
    extra: c.extra ?? false,
    limit: c.limit ?? 3,
  } as Card
}

export function indexCards(cards: Card[]): CardIndex {
  const byId = new Map<number, Card>()
  const byName = new Map<string, Card>()
  for (const c of cards) {
    byId.set(c.id, c)
    byName.set(normName(c.name), c)
  }
  return { cards, byId, byName }
}

export async function loadCards(): Promise<{ meta: CardMeta; index: CardIndex }> {
  const res = await fetch(`${base}data/cards.json`)
  if (!res.ok) throw new Error(`cards.json: HTTP ${res.status}`)
  const raw = (await res.json()) as { meta: CardMeta; cards: Card[] }
  return { meta: raw.meta, index: indexCards(raw.cards.map(normaliseCard)) }
}

export async function loadTexts(): Promise<Record<string, string>> {
  const res = await fetch(`${base}data/texts.json`)
  if (!res.ok) throw new Error(`texts.json: HTTP ${res.status}`)
  return res.json()
}

const imageBase = (import.meta.env.VITE_IMAGE_BASE as string | undefined)?.replace(/\/$/, '')

/** Re-hosted card image (Supabase Storage). Null when not configured. */
export function imageUrl(card: Card): string | null {
  if (!imageBase || card.noImage) return null
  return `${imageBase}/${card.id}.jpg`
}
