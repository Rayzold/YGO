import { describe, expect, it } from 'vitest'
import { ASH, FOOLISH, LINK, SMALL, deck } from '../test/fixtures'
import { detectDelimiter, exportCollection, importCollection, parseCsv } from './csv'
import { parseYdk, toYdk } from './ydk'

describe('.ydk', () => {
  it('round-trips', () => {
    const d = deck([ASH.id, ASH.id, FOOLISH.id], [LINK.id], [ASH.id])
    expect(parseYdk(toYdk(d))).toEqual({ main: d.main, extra: d.extra, side: d.side })
  })

  it('parses files with BOM, CRLF, comments and blank lines', () => {
    const text = '﻿#created by someone\r\n#main\r\n14558127\r\n\r\n#extra\r\n86066372\r\n!side\r\n81439173\r\n'
    expect(parseYdk(text)).toEqual({ main: [14558127], extra: [86066372], side: [81439173] })
  })
})

describe('CSV', () => {
  it('handles quotes, doubled quotes and delimiters inside fields', () => {
    expect(parseCsv('a^"b^c"^"say ""hi"""\n1^2^3', '^')).toEqual([
      ['a', 'b^c', 'say "hi"'],
      ['1', '2', '3'],
    ])
  })

  it('detects ^ ; tab and comma', () => {
    expect(detectDelimiter('id^name^qty')).toBe('^')
    expect(detectDelimiter('name;qty')).toBe(';')
    expect(detectDelimiter('name\tqty')).toBe('\t')
    expect(detectDelimiter('name,qty')).toBe(',')
  })

  it('imports a headed CSV by name or id, summing duplicates', () => {
    const csv = 'Card Name,Quantity,id\nAsh Blossom & Joyous Spring,2,\n,1,81439173\nash blossom & joyous spring,1,\nNot A Card,3,\n'
    const r = importCollection(csv, SMALL)
    expect(r.items).toEqual({ [ASH.id]: 3, [FOOLISH.id]: 1 })
    expect(r.unknown).toEqual(['Not A Card'])
  })

  it('imports plain "3x Name" lists and names containing commas', () => {
    const r = importCollection('3x Ash Blossom & Joyous Spring\n1 Foolish Burial\nFilller Typo', SMALL)
    expect(r.items).toEqual({ [ASH.id]: 3, [FOOLISH.id]: 1 })
    expect(r.unknown).toEqual(['Filller Typo'])
  })

  it('exports UTF-8 BOM, ^ delimiter, and quotes fields that need it', () => {
    const out = exportCollection({ [ASH.id]: 2, [FOOLISH.id]: 0 }, SMALL)
    expect(out.startsWith('﻿id^name^qty\r\n')).toBe(true)
    expect(out).toContain(`${ASH.id}^Ash Blossom & Joyous Spring^2`)
    expect(out).not.toContain('Foolish')
    const re = importCollection(out, SMALL)
    expect(re.items).toEqual({ [ASH.id]: 2 })
  })
})

describe('CSV edge cases', () => {
  it('glues unquoted commas back into the name column', () => {
    const idx = SMALL
    const r = importCollection('name,qty\nAsh Blossom & Joyous Spring,2\n', idx)
    expect(r.items).toEqual({ [ASH.id]: 2 })
    const withComma = importCollection('qty,name\n2,Foolish, Burial\n', {
      ...idx,
      byName: new Map([...idx.byName, ['foolish, burial', FOOLISH]]),
    })
    expect(withComma.items).toEqual({ [FOOLISH.id]: 2 })
  })
})
