import { normName } from './data'
import type { Card, CardIndex, Collection } from './types'

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += ch
    } else if (ch === '"' && field === '') inQuotes = true
    else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''))
}

/** Pick the delimiter that splits the first line into the most columns. */
export function detectDelimiter(text: string): string {
  const first = text.replace(/^﻿/, '').split(/\r?\n/)[0] ?? ''
  const candidates = ['^', ';', '\t', ',']
  let best = ','
  let bestCount = 0
  for (const d of candidates) {
    const n = first.split(d).length - 1
    if (n > bestCount) {
      best = d
      bestCount = n
    }
  }
  return best
}

const NAME_COLS = ['name', 'card name', 'cardname', 'card']
const QTY_COLS = ['qty', 'quantity', 'count', 'amount', 'copies', 'owned']
const ID_COLS = ['id', 'password', 'passcode', 'card id', 'konami id', 'cardid']

export interface ImportResult {
  items: Collection
  unknown: string[]
  lines: number
}

function add(items: Collection, card: Card, qty: number) {
  items[card.id] = (items[card.id] ?? 0) + qty
}

/**
 * Import a collection from:
 *  - CSV/TSV with a header (name and/or id column, optional qty column), any of , ; ^ tab
 *  - plain lines like "3 Ash Blossom & Joyous Spring" or "3x Ash Blossom"
 *  - a bare list of names or passwords (1 copy each)
 */
export function importCollection(text: string, index: CardIndex): ImportResult {
  const items: Collection = {}
  const unknown: string[] = []
  const delim = detectDelimiter(text)
  const rows = parseCsv(text, delim)
  if (!rows.length) return { items, unknown, lines: 0 }

  const header = rows[0].map((h) => normName(h))
  const nameCol = header.findIndex((h) => NAME_COLS.includes(h))
  const idCol = header.findIndex((h) => ID_COLS.includes(h))
  const qtyCol = header.findIndex((h) => QTY_COLS.includes(h))
  const hasHeader = nameCol >= 0 || idCol >= 0

  const resolve = (name?: string, id?: string): Card | undefined => {
    if (id && /^\d+$/.test(id.trim())) {
      const c = index.byId.get(Number(id.trim()))
      if (c) return c
    }
    if (name) return index.byName.get(normName(name))
    return undefined
  }

  const body = hasHeader ? rows.slice(1) : rows
  for (let r of body) {
    let card: Card | undefined
    let qty = 1
    let label = r.join(delim)
    // Without a header, first try the whole line: names can contain the delimiter
    // ("Lumina, Lightsworn Summoner").
    const whole = r.join(delim).trim()
    const wm = whole.match(/^(\d+)\s*x?\s+(.+)$/i)
    const wholeCard = hasHeader ? undefined : wm ? resolve(wm[2]) : resolve(whole, whole)
    if (hasHeader) {
      if (nameCol >= 0 && r.length > header.length) {
        // unquoted delimiter inside the name ("Lumina, Lightsworn Summoner"): glue it back
        const extra = r.length - header.length
        r = [...r.slice(0, nameCol), r.slice(nameCol, nameCol + extra + 1).join(delim), ...r.slice(nameCol + extra + 1)]
      }
      card = resolve(nameCol >= 0 ? r[nameCol] : undefined, idCol >= 0 ? r[idCol] : undefined)
      if (qtyCol >= 0) qty = parseInt(r[qtyCol] ?? '1', 10)
      label = (nameCol >= 0 ? r[nameCol] : r[idCol]) ?? label
    } else if (wholeCard) {
      card = wholeCard
      qty = wm ? Number(wm[1]) : 1
    } else if (r.length >= 2) {
      // "3,Name" or "Name,3"
      const [a, b] = r
      if (/^\d+$/.test(a.trim()) && !index.byId.has(Number(a.trim()))) {
        qty = Number(a)
        card = resolve(b, b)
        label = b
      } else {
        card = resolve(a, a)
        qty = /^\d+$/.test(b.trim()) ? Number(b) : 1
        label = a
      }
    } else {
      const line = r[0].trim()
      const m = line.match(/^(\d+)\s*x?\s+(.+)$/i)
      if (m && !index.byId.has(Number(line))) {
        qty = Number(m[1])
        card = resolve(m[2])
        label = m[2]
      } else {
        card = resolve(line, line)
        label = line
      }
    }
    if (!Number.isFinite(qty) || qty <= 0) continue
    if (card) add(items, card, qty)
    else unknown.push(label.trim())
  }
  return { items, unknown, lines: body.length }
}

function quote(field: string, delimiter: string): string {
  return /["\r\n]/.test(field) || field.includes(delimiter) ? `"${field.replace(/"/g, '""')}"` : field
}

/** UTF-8 BOM so Excel opens Greek/accents correctly. */
export function exportCollection(items: Collection, index: CardIndex, delimiter = '^'): string {
  const lines = [['id', 'name', 'qty'].join(delimiter)]
  const rows = Object.entries(items)
    .map(([id, qty]) => ({ card: index.byId.get(Number(id)), id: Number(id), qty }))
    .filter((r) => r.qty > 0)
    .sort((a, b) => (a.card?.name ?? '').localeCompare(b.card?.name ?? ''))
  for (const r of rows) {
    lines.push([String(r.id), r.card?.name ?? '', String(r.qty)].map((f) => quote(f, delimiter)).join(delimiter))
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}
