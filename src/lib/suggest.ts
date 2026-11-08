import type { Card, Collection, Deck } from './types'

/**
 * Suggestion engine (runs in the browser on the static card data).
 *
 * Signals:
 *  - archetype: series shared with >= 2 cards in the deck, or names the deck mentions
 *  - mechanics: provider -> hook pairs from the tagger (e.g. "mill" feeds "if sent to the GY")
 *  - Extra Deck: materials text checked against the Levels / Tuners / names in the deck
 *  - TCG banlist: Forbidden cards are never suggested
 *  - collection: optionally only cards you own, and owned cards rank higher
 */

/** provider tag -> hook tags on other cards that benefit from it */
export const EDGES: Record<string, string[]> = {
  mill: ['trig_sent_to_gy', 'trig_sent_from_hand_deck', 'gy_effect'],
  discard: ['trig_sent_to_gy', 'trig_sent_from_hand_deck', 'gy_effect'],
  self_discard: ['trig_sent_to_gy', 'gy_effect'],
  ss_from_gy: ['trig_summoned', 'gy_effect'],
  ss_from_deck: ['trig_summoned'],
  ss_self: ['trig_material'],
}
const ALL_HOOKS = new Set(Object.values(EDGES).flat())

export type ReasonCode =
  | 'archetype'
  | 'mentions'
  | 'mentionedBy'
  | 'provides'
  | 'fedBy'
  | 'extraArchetype'
  | 'extraMaterial'
  | 'extraXyz'
  | 'extraSynchro'
  | 'extraLink'
  | 'sideHandTrap'
  | 'sideGeneric'
  | 'owned'

export interface Reason {
  code: ReasonCode
  params: Record<string, string | number>
}

export interface Suggestion {
  card: Card
  score: number
  reasons: Reason[]
}

export interface SuggestOptions {
  collection?: Collection
  ownedOnly?: boolean
  limit?: number
}

function counter<T>(items: T[]): Map<T, number> {
  const m = new Map<T, number>()
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1)
  return m
}

interface DeckProfile {
  cards: Card[]
  names: Set<string>
  series: Map<string, number>
  tags: Map<string, number>
  levels: Map<number, number>
  tuners: Card[]
}

function profile(deck: Deck, byId: Map<number, Card>): DeckProfile {
  const all = [...deck.main, ...deck.extra, ...deck.side].map((id) => byId.get(id)).filter((c): c is Card => !!c)
  const unique = [...new Map(all.map((c) => [c.name, c])).values()]
  const mainMonsters = deck.main.map((id) => byId.get(id)).filter((c): c is Card => !!c && c.type === 'Monster')
  return {
    cards: unique,
    names: new Set(unique.map((c) => c.name)),
    series: counter(unique.flatMap((c) => c.series)),
    tags: counter(unique.flatMap((c) => c.tags)),
    levels: counter(mainMonsters.filter((c) => c.lvl).map((c) => c.lvl as number)),
    tuners: [...new Map(mainMonsters.filter((c) => c.line.includes('Tuner')).map((c) => [c.name, c])).values()],
  }
}

function archetypeScore(c: Card, p: DeckProfile, out: Reason[]): number {
  let score = 0
  const shared = c.series.filter((s) => (p.series.get(s) ?? 0) >= 2)
  if (shared.length) {
    score += 4 + Math.min(...shared.map((s) => p.series.get(s) ?? 0))
    out.push({ code: 'archetype', params: { names: shared.join(', ') } })
  } else {
    const mentioned = c.mentions.filter((m) => p.names.has(m) || (p.series.get(m) ?? 0) >= 2)
    if (mentioned.length) {
      score += 3
      out.push({ code: 'mentions', params: { names: mentioned.join(', ') } })
    }
    const by = p.cards.filter((d) => d.mentions.includes(c.name) || c.series.some((s) => d.mentions.includes(s)))
    if (by.length) {
      score += 3
      out.push({ code: 'mentionedBy', params: { names: by.map((d) => d.name).join(', ') } })
    }
  }
  return score
}

function mechanicScore(c: Card, p: DeckProfile, out: Reason[]): number {
  let score = 0
  for (const [prov, hooks] of Object.entries(EDGES)) {
    if (!c.tags.includes(prov)) continue
    const n = hooks.reduce((acc, h) => acc + (p.tags.get(h) ?? 0), 0)
    if (n) {
      score += Math.min(n, 4)
      out.push({ code: 'provides', params: { tag: prov, n } })
    }
  }
  const hooks = c.tags.filter((t) => ALL_HOOKS.has(t))
  const hookSet = new Set(hooks)
  if (hookSet.has('trig_sent_from_hand_deck')) hookSet.delete('trig_sent_to_gy')
  for (const h of hookSet) {
    const feeders = Object.entries(EDGES)
      .filter(([, hs]) => hs.includes(h))
      .reduce((acc, [prov]) => acc + (p.tags.get(prov) ?? 0), 0)
    if (feeders) {
      score += Math.min(feeders, 3)
      out.push({ code: 'fedBy', params: { tag: h, n: feeders } })
    }
  }
  return score
}

function extraScore(c: Card, p: DeckProfile, out: Reason[]): number {
  let score = 0
  const mats = (c.materials ?? '').toLowerCase()
  if (c.series.some((s) => (p.series.get(s) ?? 0) >= 2)) {
    score += 6
    out.push({ code: 'extraArchetype', params: { names: c.series.join(', ') } })
  }
  for (const q of (c.materials ?? '').match(/"([^"]+)"/g) ?? []) {
    const name = q.slice(1, -1)
    if (p.names.has(name) || (p.series.get(name) ?? 0) >= 1) {
      score += 4
      out.push({ code: 'extraMaterial', params: { name } })
    }
  }
  if (c.line.includes('Xyz')) {
    const m = mats.match(/(\d+)\+? level (\d+)/)
    const n = m ? p.levels.get(Number(m[2])) ?? 0 : 0
    if (m && n >= 2) {
      score += 2 + Math.min(n, 4)
      out.push({ code: 'extraXyz', params: { level: Number(m[2]), n } })
    }
  } else if (c.line.includes('Synchro') && c.lvl) {
    for (const t of p.tuners) {
      const need = c.lvl - (t.lvl ?? 0)
      if (need > 0 && (p.levels.get(need) ?? 0) > 0) {
        score += 3
        out.push({ code: 'extraSynchro', params: { tuner: t.name, tunerLevel: t.lvl ?? 0, need } })
        break
      }
    }
  } else if (c.line.includes('Link') && /^\d\+? effect monsters?$/.test(mats.trim())) {
    score += 1
    out.push({ code: 'extraLink', params: { mats: c.materials ?? '' } })
  }
  return score
}

function sideScore(c: Card, p: DeckProfile, out: Reason[]): number {
  // Archetype support (its text names its own series) only makes sense in that archetype.
  // A bare series tag is not a lock: Ash Blossom is in the "Yo-kai Girl" series.
  const locked = c.mentions.some((m) => c.series.includes(m))
  if (locked && !c.series.some((s) => p.series.has(s))) return 0
  let score = 0
  if (c.tags.includes('hand_trap')) {
    score += 3
    out.push({ code: 'sideHandTrap', params: {} })
  } else if (c.type !== 'Monster' && (c.tags.includes('banish_removal') || c.tags.includes('negate')) && !locked) {
    score += 2
    out.push({ code: 'sideGeneric', params: {} })
  }
  if (score && c.tags.includes('negate')) score += 1
  if (score && c.limit < 3) score -= 1
  return score
}

export function suggest(deck: Deck, cards: Card[], byId: Map<number, Card>, opts: SuggestOptions = {}) {
  const p = profile(deck, byId)
  const k = opts.limit ?? 12
  const main: Suggestion[] = []
  const extra: Suggestion[] = []
  const side: Suggestion[] = []
  if (!p.cards.length) return { main, extra, side }

  for (const c of cards) {
    if (c.limit === 0 || p.names.has(c.name)) continue
    const owned = opts.collection?.[c.id] ?? 0
    if (opts.ownedOnly && !owned) continue
    const ownBonus = owned ? 2 : 0
    const ownReason: Reason[] = owned ? [{ code: 'owned', params: { n: owned } }] : []

    if (c.extra) {
      const r: Reason[] = []
      const s = extraScore(c, p, r)
      if (s >= 5) extra.push({ card: c, score: s + ownBonus, reasons: [...r, ...ownReason] })
      continue
    }
    const ra: Reason[] = []
    const rm: Reason[] = []
    const a = archetypeScore(c, p, ra)
    const m = mechanicScore(c, p, rm)
    if ((a && a + m >= 6) || (!a && m >= 5)) {
      main.push({ card: c, score: a + m + ownBonus, reasons: [...ra, ...rm, ...ownReason] })
    }
    const rs: Reason[] = []
    const s = sideScore(c, p, rs)
    if (s > 0) side.push({ card: c, score: s + ownBonus, reasons: [...rs, ...ownReason] })
  }
  const top = (xs: Suggestion[]) => xs.sort((a, b) => b.score - a.score || a.card.name.localeCompare(b.card.name)).slice(0, k)
  return { main: top(main), extra: top(extra), side: top(side) }
}
