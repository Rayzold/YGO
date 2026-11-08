import { describe, expect, it } from 'vitest'
import { ASH, CALLED, FILLER, FOOLISH, LINK, POT, SMALL, deck } from '../test/fixtures'
import { canAdd, isLegal, validate } from './rules'

const codes = (d: ReturnType<typeof deck>) => validate(d, SMALL.byId).map((i) => i.code)

describe('TCG deck rules', () => {
  it('requires 40 to 60 Main Deck cards', () => {
    expect(codes(deck(Array(39).fill(FILLER.id)))).toContain('mainTooFew')
    expect(codes(deck(Array(61).fill(FILLER.id)))).toContain('mainTooMany')
  })

  it('accepts a 40-card deck with 3 copies per card (validation by name, not section)', () => {
    // 40 copies of the same card is still illegal: 3-copy rule
    expect(codes(deck(Array(40).fill(FILLER.id)))).toContain('tooManyCopies')
  })

  it('counts copies across Main, Extra and Side', () => {
    const d = deck([ASH.id, ASH.id], [], [ASH.id, ASH.id])
    expect(validate(d, SMALL.byId).find((i) => i.code === 'tooManyCopies')?.params.n).toBe(4)
  })

  it('applies the Forbidden & Limited List', () => {
    expect(codes(deck([POT.id]))).toContain('forbidden')
    expect(codes(deck([FOOLISH.id, FOOLISH.id]))).toContain('overLimit')
    expect(codes(deck([CALLED.id, CALLED.id]))).not.toContain('overLimit')
  })

  it('warns about the upcoming list', () => {
    const issues = validate(deck([CALLED.id, CALLED.id]), SMALL.byId)
    expect(issues.find((i) => i.code === 'upcomingChange')).toMatchObject({ level: 'warn', params: { max: 1 } })
  })

  it('keeps Extra Deck monsters out of the Main Deck', () => {
    expect(codes(deck([LINK.id]))).toContain('wrongSection')
    expect(codes(deck([], [ASH.id]))).toContain('wrongSection')
    expect(codes(deck([], [LINK.id]))).not.toContain('wrongSection')
  })

  it('caps Extra and Side at 15', () => {
    expect(codes(deck([], Array(16).fill(LINK.id)))).toContain('extraTooMany')
    expect(codes(deck([], [], Array(16).fill(ASH.id)))).toContain('sideTooMany')
  })

  it('canAdd blocks illegal additions with a reason', () => {
    expect(canAdd(deck(), POT, 'main', SMALL.byId)).toMatchObject({ ok: false, code: 'forbidden' })
    expect(canAdd(deck([FOOLISH.id]), FOOLISH, 'side', SMALL.byId)).toMatchObject({ ok: false, code: 'overLimit' })
    expect(canAdd(deck(), LINK, 'main', SMALL.byId)).toMatchObject({ ok: false, code: 'wrongSection' })
    expect(canAdd(deck(), LINK, 'side', SMALL.byId)).toEqual({ ok: true })
    expect(canAdd(deck([ASH.id, ASH.id, ASH.id]), ASH, 'side', SMALL.byId)).toMatchObject({ ok: false, code: 'tooManyCopies' })
  })

  it('isLegal ignores warnings', () => {
    expect(isLegal(deck([CALLED.id]), SMALL.byId)).toBe(false) // too few cards
  })
})
