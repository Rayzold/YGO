/** 0 Forbidden, 1 Limited, 2 Semi-Limited, 3 Unlimited (TCG Forbidden & Limited List). */
export type Limit = 0 | 1 | 2 | 3

export interface Card {
  id: number
  name: string
  type: 'Monster' | 'Spell' | 'Trap'
  /** e.g. "Zombie / Tuner / Effect"; empty for Spells/Traps */
  line: string
  /** Spell/Trap property, e.g. "Quick-Play" */
  prop?: string
  attr?: string
  /** Level or Rank */
  lvl?: number
  link?: number
  atk?: number | string
  def?: number | string
  scale?: number
  series: string[]
  /** names in quotes in the card text */
  mentions: string[]
  materials?: string
  limit: Limit
  /** limit on the announced (upcoming) list, only when it differs */
  next?: Limit
  /** Fusion / Synchro / Xyz / Link */
  extra: boolean
  tags: string[]
  noImage?: boolean
}

export interface CardMeta {
  built: string
  format: 'tcg'
  banlist: string | null
  upcoming: string | null
  count: number
}

export type Section = 'main' | 'extra' | 'side'

export interface Deck {
  id: string
  name: string
  main: number[]
  extra: number[]
  side: number[]
  notes?: string
  updatedAt: string
}

/** card id -> copies owned */
export type Collection = Record<number, number>

export interface CardIndex {
  cards: Card[]
  byId: Map<number, Card>
  byName: Map<string, Card>
}
