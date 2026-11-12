// Glue between the card index and Gemini: what we send, and checking what comes back against real cards.
import { normName } from './data'
import type { AiCard, ComboLine } from './gemini'
import type { Card, CardIndex, Collection, Deck } from './types'

export function toAi(card: Card, texts: Record<string, string> | null): AiCard {
  const kind = card.type === 'Monster' ? card.line || 'Monster' : `${card.prop ?? ''} ${card.type}`.trim()
  return { name: card.name, kind, text: texts?.[card.id] ?? '' }
}

/** Model output names -> real cards. Unknown names are dropped; Forbidden cards too unless `allowForbidden`. */
export function resolveNames(names: string[], index: CardIndex, allowForbidden = false): Card[] {
  const out: Card[] = []
  const seen = new Set<number>()
  for (const n of names) {
    const c = index.byName.get(normName(n))
    if (!c || seen.has(c.id) || (!allowForbidden && c.limit === 0)) continue
    seen.add(c.id)
    out.push(c)
  }
  return out
}

/** Keep only combos whose every card is in `allowed` (case/quote-insensitive). */
export function validateCombos(lines: ComboLine[], allowed: string[]) {
  const ok = new Set(allowed.map(normName))
  const valid: ComboLine[] = []
  let rejected = 0
  for (const line of lines) {
    const used = line.cardsUsed ?? []
    if (used.length && used.every((n) => ok.has(normName(n)))) valid.push(line)
    else rejected++
  }
  return { valid, rejected }
}

/** Cards the player has: collection plus whatever is in the current deck. */
export function playerCards(collection: Collection, deck: Deck, index: CardIndex): Card[] {
  const ids = new Set<number>([...Object.keys(collection).map(Number), ...deck.main, ...deck.extra, ...deck.side])
  return [...ids].map((id) => index.byId.get(id)).filter((c): c is Card => !!c)
}

/** Archetype names, most cards first, for the opponent picker. */
export function archetypeList(cards: Card[]): string[] {
  const n = new Map<string, number>()
  for (const c of cards) for (const s of c.series) n.set(s, (n.get(s) ?? 0) + 1)
  return [...n.entries()].filter(([, k]) => k >= 3).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s)
}

export function archetypeCards(cards: Card[], name: string): Card[] {
  const key = normName(name)
  return cards.filter((c) => c.series.some((s) => normName(s) === key))
}
