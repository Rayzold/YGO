import { describe, expect, it } from 'vitest'
import { deck, hasRealData, realIndex } from '../test/fixtures'
import { normName } from './data'
import { EMPTY_QUERY, search } from './search'
import { suggest } from './suggest'

// These run against the real TCG data built by `npm run data` (CI builds it first).
describe.skipIf(!hasRealData)('suggestions on real data', () => {
  const idx = hasRealData ? realIndex() : null!
  const id = (name: string) => {
    const c = idx.byName.get(normName(name))
    if (!c) throw new Error(`missing ${name}`)
    return c.id
  }
  const lightsworn = deck(
    [
      'Charge of the Light Brigade',
      'Lumina, Lightsworn Summoner',
      'Ryko, Lightsworn Hunter',
      'Wulf, Lightsworn Beast',
      'Judgment Dragon',
      'Raiden, Hand of the Lightsworn',
      'Solar Recharge',
    ].map(id),
  )

  it('proposes Lightsworn main deck cards with reasons', () => {
    const { main } = suggest(lightsworn, idx.cards, idx.byId)
    const names = main.map((s) => s.card.name)
    expect(names).toEqual(expect.arrayContaining(['Minerva, Lightsworn Maiden', 'Lightsworn Dragonling']))
    expect(main.every((s) => s.reasons.length > 0)).toBe(true)
  })

  it('proposes Lightsworn Extra Deck monsters the deck can make', () => {
    const names = suggest(lightsworn, idx.cards, idx.byId).extra.map((s) => s.card.name)
    expect(names).toEqual(expect.arrayContaining(['Minerva, the Exalted Lightsworn', 'Michael, the Arch-Lightsworn']))
  })

  it('never suggests Forbidden cards or cards already in the deck', () => {
    const all = Object.values(suggest(lightsworn, idx.cards, idx.byId, { limit: 50 })).flat()
    expect(all.every((s) => s.card.limit !== 0)).toBe(true)
    expect(all.some((s) => lightsworn.main.includes(s.card.id))).toBe(false)
  })

  it('ownedOnly restricts to the collection', () => {
    const owned = { [id('Minerva, Lightsworn Maiden')]: 1 }
    const { main, extra } = suggest(lightsworn, idx.cards, idx.byId, { collection: owned, ownedOnly: true })
    expect(main.map((s) => s.card.name)).toEqual(['Minerva, Lightsworn Maiden'])
    expect(extra).toEqual([])
  })

  it('side deck: generic hand traps for a non-archetype deck', () => {
    const { side } = suggest(lightsworn, idx.cards, idx.byId, { limit: 30 })
    expect(side.map((s) => s.card.name)).toContain('Ash Blossom & Joyous Spring')
  })

  it('search ranks exact and prefix name matches first', () => {
    const res = search(idx.cards, { ...EMPTY_QUERY, text: 'ash blossom' })
    expect(res[0].name).toBe('Ash Blossom & Joyous Spring')
    const handTraps = search(idx.cards, { ...EMPTY_QUERY, tag: 'hand_trap', type: 'Monster' })
    expect(handTraps.length).toBeGreaterThan(50)
  })
})
