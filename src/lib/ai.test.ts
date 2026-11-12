import { describe, expect, it } from 'vitest'
import { ASH, CALLED, card, deck, FILLER, LINK, POT, SMALL } from '../test/fixtures'
import { indexCards } from './data'
import { archetypeCards, archetypeList, playerCards, resolveNames, toAi, validateCombos } from './ai'
import type { ComboLine } from './gemini'

const line = (cardsUsed: string[]): ComboLine => ({ name: 'x', starter: 'x', steps: [], endBoard: 'x', cardsUsed })

describe('resolveNames', () => {
  it('maps model names to real cards, ignoring case, curly quotes and duplicates', () => {
    const got = resolveNames(['ash blossom & joyous spring', 'Called by the Grave', 'Ash Blossom & Joyous Spring'], SMALL)
    expect(got.map((c) => c.id)).toEqual([ASH.id, CALLED.id])
  })
  it('drops invented cards and Forbidden ones', () => {
    expect(resolveNames(['Totally Real Dragon', 'Pot of Greed'], SMALL)).toEqual([])
    expect(resolveNames(['Pot of Greed'], SMALL, true).map((c) => c.id)).toEqual([POT.id])
  })
})

describe('validateCombos', () => {
  it('keeps only lines that use allowed cards', () => {
    const { valid, rejected } = validateCombos(
      [line(['Ash Blossom & Joyous Spring', 'accesscode talker']), line(['Ash Blossom & Joyous Spring', 'Maxx "C"']), line([])],
      [ASH.name, LINK.name],
    )
    expect(valid).toHaveLength(1)
    expect(rejected).toBe(2)
  })
})

describe('player cards and archetypes', () => {
  it('joins collection and current deck without duplicates', () => {
    const got = playerCards({ [ASH.id]: 3 }, deck([ASH.id, FILLER.id], [LINK.id]), SMALL)
    expect(got.map((c) => c.id).sort()).toEqual([1, ASH.id, LINK.id].sort())
  })
  it('lists archetypes with 3+ cards and finds their members', () => {
    const idx = indexCards([
      card(10, 'Snake-Eye Ash', { series: ['Snake-Eye'] }),
      card(11, 'Snake-Eye Oak', { series: ['Snake-Eye'] }),
      card(12, 'Snake-Eyes Poplar', { series: ['Snake-Eye'] }),
      card(13, 'Lonely One', { series: ['Solo'] }),
    ])
    expect(archetypeList(idx.cards)).toEqual(['Snake-Eye'])
    expect(archetypeCards(idx.cards, 'snake-eye')).toHaveLength(3)
  })
  it('describes a card for the model', () => {
    expect(toAi(CALLED, { [CALLED.id]: 'Target 1 monster in the GY.' })).toEqual({
      name: 'Called by the Grave',
      kind: 'Spell',
      text: 'Target 1 monster in the GY.',
    })
  })
})
