import type { Card, Deck, Limit, Section } from './types'

/** Official TCG deck construction rules. */
export const RULES = { mainMin: 40, mainMax: 60, extraMax: 15, sideMax: 15, copies: 3 } as const

export const LIMIT_MAX: Record<Limit, number> = { 0: 0, 1: 1, 2: 2, 3: 3 }

export type IssueCode =
  | 'mainTooFew'
  | 'mainTooMany'
  | 'extraTooMany'
  | 'sideTooMany'
  | 'tooManyCopies'
  | 'forbidden'
  | 'overLimit'
  | 'wrongSection'
  | 'unknownCard'
  | 'upcomingChange'

export interface Issue {
  level: 'error' | 'warn'
  code: IssueCode
  params: Record<string, string | number>
}

/** Where a card belongs when added without an explicit section. */
export function homeSection(card: Card): Exclude<Section, 'side'> {
  return card.extra ? 'extra' : 'main'
}

export function maxCopies(card: Card): number {
  return Math.min(RULES.copies, LIMIT_MAX[card.limit])
}

/** Copies of this card name across Main + Extra + Side. */
export function copiesInDeck(deck: Deck, card: Card, byId: Map<number, Card>): number {
  let n = 0
  for (const id of [...deck.main, ...deck.extra, ...deck.side]) {
    const c = byId.get(id)
    if (c && c.name === card.name) n++
  }
  return n
}

export function canAdd(
  deck: Deck,
  card: Card,
  section: Section,
  byId: Map<number, Card>,
): { ok: true } | { ok: false; code: IssueCode; params: Record<string, string | number> } {
  if (card.limit === 0) return { ok: false, code: 'forbidden', params: { name: card.name } }
  const copies = copiesInDeck(deck, card, byId)
  if (copies >= maxCopies(card)) {
    return { ok: false, code: card.limit < 3 ? 'overLimit' : 'tooManyCopies', params: { name: card.name, max: maxCopies(card) } }
  }
  if (section === 'main' && card.extra) return { ok: false, code: 'wrongSection', params: { name: card.name } }
  if (section === 'extra' && !card.extra) return { ok: false, code: 'wrongSection', params: { name: card.name } }
  if (section === 'main' && deck.main.length >= RULES.mainMax) return { ok: false, code: 'mainTooMany', params: { n: deck.main.length } }
  if (section === 'extra' && deck.extra.length >= RULES.extraMax) return { ok: false, code: 'extraTooMany', params: { n: deck.extra.length } }
  if (section === 'side' && deck.side.length >= RULES.sideMax) return { ok: false, code: 'sideTooMany', params: { n: deck.side.length } }
  return { ok: true }
}

export function validate(deck: Deck, byId: Map<number, Card>): Issue[] {
  const issues: Issue[] = []
  const err = (code: IssueCode, params: Issue['params'] = {}) => issues.push({ level: 'error', code, params })
  const warn = (code: IssueCode, params: Issue['params'] = {}) => issues.push({ level: 'warn', code, params })

  if (deck.main.length < RULES.mainMin) err('mainTooFew', { n: deck.main.length })
  if (deck.main.length > RULES.mainMax) err('mainTooMany', { n: deck.main.length })
  if (deck.extra.length > RULES.extraMax) err('extraTooMany', { n: deck.extra.length })
  if (deck.side.length > RULES.sideMax) err('sideTooMany', { n: deck.side.length })

  const counts = new Map<string, { card: Card; n: number }>()
  const sections: [Section, number[]][] = [['main', deck.main], ['extra', deck.extra], ['side', deck.side]]
  for (const [section, ids] of sections) {
    for (const id of ids) {
      const card = byId.get(id)
      if (!card) {
        err('unknownCard', { id })
        continue
      }
      if (section === 'main' && card.extra) err('wrongSection', { name: card.name })
      if (section === 'extra' && !card.extra) err('wrongSection', { name: card.name })
      const e = counts.get(card.name) ?? { card, n: 0 }
      e.n++
      counts.set(card.name, e)
    }
  }
  for (const { card, n } of counts.values()) {
    if (card.limit === 0) err('forbidden', { name: card.name })
    else if (n > maxCopies(card)) {
      err(card.limit < 3 ? 'overLimit' : 'tooManyCopies', { name: card.name, n, max: maxCopies(card) })
    }
    if (card.next !== undefined && n > LIMIT_MAX[card.next]) {
      warn('upcomingChange', { name: card.name, n, max: LIMIT_MAX[card.next] })
    }
  }
  return issues
}

export function isLegal(deck: Deck, byId: Map<number, Card>): boolean {
  return validate(deck, byId).every((i) => i.level !== 'error')
}
