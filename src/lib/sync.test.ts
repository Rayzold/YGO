import { describe, expect, it } from 'vitest'
import { mergeCollections, mergeDecks } from './sync'
import type { Deck } from './types'

const d = (id: string, updatedAt: string, name = id): Deck => ({ id, name, main: [], extra: [], side: [], updatedAt })

describe('first sign-in merge', () => {
  it('keeps the newest copy of each deck and pushes what the server lacks', () => {
    const local = [d('a', '2026-01-02T00:00:00Z', 'local a'), d('b', '2026-01-01T00:00:00Z')]
    const remote = [d('a', '2026-01-01T00:00:00Z', 'remote a'), d('c', '2026-01-03T00:00:00Z')]
    const { merged, toPush } = mergeDecks(local, remote)
    expect(merged.map((x) => x.id)).toEqual(['c', 'a', 'b'])
    expect(merged.find((x) => x.id === 'a')?.name).toBe('local a')
    expect(toPush.map((x) => x.id).sort()).toEqual(['a', 'b'])
  })

  it('keeps the larger owned count per card', () => {
    const { merged, toPush } = mergeCollections({ 1: 3, 2: 1 }, { 1: 2, 2: 2, 3: 1 })
    expect(merged).toEqual({ 1: 3, 2: 2, 3: 1 })
    expect(toPush).toEqual({ 1: 3 })
  })
})
