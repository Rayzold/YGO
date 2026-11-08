import { normName } from './data'
import type { Card, Collection, Limit } from './types'

export interface Query {
  text: string
  type: '' | 'Monster' | 'Spell' | 'Trap'
  frame: '' | 'main' | 'extra'
  attr: string
  level: string
  archetype: string
  tag: string
  limit: '' | `${Limit}`
  ownedOnly: boolean
  inText: boolean
}

export const EMPTY_QUERY: Query = {
  text: '',
  type: '',
  frame: '',
  attr: '',
  level: '',
  archetype: '',
  tag: '',
  limit: '',
  ownedOnly: false,
  inText: false,
}

export function search(
  cards: Card[],
  q: Query,
  opts: { texts?: Record<string, string>; collection?: Collection } = {},
): Card[] {
  const needle = normName(q.text)
  const arch = normName(q.archetype)
  const scored: { c: Card; s: number }[] = []
  for (const c of cards) {
    if (q.type && c.type !== q.type) continue
    if (q.frame === 'extra' && !c.extra) continue
    if (q.frame === 'main' && c.extra) continue
    if (q.attr && c.attr !== q.attr) continue
    if (q.level && String(c.lvl ?? c.link ?? '') !== q.level) continue
    if (q.tag && !c.tags.includes(q.tag)) continue
    if (q.limit && String(c.limit) !== q.limit) continue
    if (q.ownedOnly && !(opts.collection?.[c.id] ?? 0)) continue
    if (arch && !c.series.some((s) => normName(s).includes(arch)) && !c.mentions.some((m) => normName(m).includes(arch))) continue
    let s = 0
    if (needle) {
      const name = normName(c.name)
      if (name === needle) s = 4
      else if (name.startsWith(needle)) s = 3
      else if (name.includes(needle)) s = 2
      else if (q.inText && opts.texts && normName(opts.texts[c.id] ?? '').includes(needle)) s = 1
      else continue
    }
    scored.push({ c, s })
  }
  scored.sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name))
  return scored.map((x) => x.c)
}

export function allArchetypes(cards: Card[]): string[] {
  const set = new Set<string>()
  for (const c of cards) for (const s of c.series) set.add(s)
  return [...set].sort((a, b) => a.localeCompare(b))
}
