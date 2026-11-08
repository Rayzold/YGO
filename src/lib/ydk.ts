import type { Deck } from './types'

export interface YdkLists {
  main: number[]
  extra: number[]
  side: number[]
}

/**
 * Parse the .ydk format used by EDOPro, YGOPRODeck, Dueling Book exports etc.:
 *   #main / #extra headers, "!side" header, one card password per line.
 */
export function parseYdk(text: string): YdkLists {
  const out: YdkLists = { main: [], extra: [], side: [] }
  let cur: keyof YdkLists | null = 'main'
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const lower = line.toLowerCase()
    if (lower === '#main') cur = 'main'
    else if (lower === '#extra') cur = 'extra'
    else if (lower === '!side') cur = 'side'
    else if (line.startsWith('#') || line.startsWith('!')) continue
    else if (cur && /^\d+$/.test(line)) out[cur].push(Number(line))
  }
  return out
}

export function toYdk(deck: Pick<Deck, 'main' | 'extra' | 'side'>, createdBy = 'YGO Deck Builder'): string {
  return [
    `#created by ${createdBy}`,
    '#main',
    ...deck.main.map(String),
    '#extra',
    ...deck.extra.map(String),
    '!side',
    ...deck.side.map(String),
    '',
  ].join('\n')
}
