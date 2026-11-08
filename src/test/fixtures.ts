import { existsSync, readFileSync } from 'node:fs'
import { indexCards, normaliseCard } from '../lib/data'
import type { Card, Deck } from '../lib/types'

export function card(id: number, name: string, extra: Partial<Card> = {}): Card {
  return normaliseCard({ id, name, type: 'Monster', line: 'Warrior / Effect', limit: 3, ...extra })
}

export const ASH = card(14558127, 'Ash Blossom & Joyous Spring', { line: 'Zombie / Tuner / Effect', lvl: 3, tags: ['hand_trap', 'negate'] })
export const POT = card(55144522, 'Pot of Greed', { type: 'Spell', line: '', limit: 0, tags: ['draw'] })
export const FOOLISH = card(81439173, 'Foolish Burial', { type: 'Spell', line: '', limit: 1, tags: ['mill'] })
export const CALLED = card(24224830, 'Called by the Grave', { type: 'Spell', line: '', limit: 2, next: 1, tags: ['negate'] })
export const LINK = card(86066372, 'Accesscode Talker', { line: 'Cyberse / Link / Effect', extra: true, link: 4 })
export const FILLER = card(1, 'Filler Monster', { lvl: 4 })

export const SMALL = indexCards([ASH, POT, FOOLISH, CALLED, LINK, FILLER])

export function deck(main: number[] = [], extra: number[] = [], side: number[] = []): Deck {
  return { id: 'd', name: 'Test', main, extra, side, updatedAt: '2026-01-01T00:00:00Z' }
}

const DATA = new URL('../../public/data/cards.json', import.meta.url)
export const hasRealData = existsSync(DATA)
export function realIndex() {
  const raw = JSON.parse(readFileSync(DATA, 'utf-8')) as { cards: Card[] }
  return indexCards(raw.cards.map(normaliseCard))
}
