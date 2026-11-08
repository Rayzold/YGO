import { useMemo, useState } from 'react'
import { exportCollection, importCollection, type ImportResult } from '../lib/csv'
import { normName } from '../lib/data'
import { download } from '../lib/storage'
import type { Collection } from '../lib/types'
import { parseYdk } from '../lib/ydk'
import { useStore } from '../state'
import { CardTile } from './CardTile'
import { missingCards } from './DeckPanel'

function fromYdk(text: string): Collection {
  const lists = parseYdk(text)
  const items: Collection = {}
  for (const id of [...lists.main, ...lists.extra, ...lists.side]) items[id] = (items[id] ?? 0) + 1
  return items
}

export function CollectionPage() {
  const { index, collection, applyImport, setOwned, t, deck } = useStore()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'add' | 'replace'>('add')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [filter, setFilter] = useState('')
  const [delimiter, setDelimiter] = useState('^')

  const owned = useMemo(
    () =>
      Object.entries(collection)
        .map(([id, qty]) => ({ card: index.byId.get(Number(id)), qty }))
        .filter((x): x is { card: NonNullable<typeof x.card>; qty: number } => !!x.card && x.qty > 0)
        .sort((a, b) => a.card.name.localeCompare(b.card.name)),
    [collection, index.byId],
  )
  const shown = filter ? owned.filter((x) => normName(x.card.name).includes(normName(filter))) : owned
  const total = owned.reduce((a, x) => a + x.qty, 0)
  const missing = useMemo(() => missingCards(deck, index.byId, collection), [deck, index.byId, collection])

  const runImport = (raw: string, isYdk: boolean) => {
    let res: ImportResult
    if (isYdk || /^\s*(#main|#created)/im.test(raw)) {
      const items = fromYdk(raw)
      const known: Collection = {}
      const unknown: string[] = []
      for (const [id, n] of Object.entries(items)) {
        if (index.byId.has(Number(id))) known[Number(id)] = n
        else unknown.push(id)
      }
      res = { items: known, unknown, lines: Object.keys(items).length }
    } else res = importCollection(raw, index)
    if (mode === 'replace' && !confirm(t('coll.replaceConfirm'))) return
    applyImport(res.items, mode)
    setResult(res)
    setText('')
  }

  const onFile = async (f: File | undefined) => {
    if (f) runImport(await f.text(), f.name.toLowerCase().endsWith('.ydk'))
  }

  return (
    <div className="page collection-page">
      <section className="panel">
        <h2>{t('coll.importTitle')}</h2>
        <p className="muted">{t('coll.importHelp')}</p>
        <textarea rows={6} placeholder={t('coll.paste')} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="toolbar">
          <label>
            {t('coll.mode')}:{' '}
            <select value={mode} onChange={(e) => setMode(e.target.value as 'add' | 'replace')}>
              <option value="add">{t('coll.mode.add')}</option>
              <option value="replace">{t('coll.mode.replace')}</option>
            </select>
          </label>
          <button type="button" disabled={!text.trim()} onClick={() => runImport(text, false)}>
            {t('common.import')}
          </button>
          <label className="file-btn">
            {t('coll.file')}
            <input type="file" accept=".csv,.txt,.ydk,.tsv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </div>
        {result && (
          <div className="import-result">
            <p>
              {t('coll.result', {
                cards: Object.values(result.items).reduce((a, b) => a + b, 0),
                unique: Object.keys(result.items).length,
              })}
            </p>
            {result.unknown.length > 0 && (
              <details>
                <summary>{t('coll.unknown', { n: result.unknown.length })}</summary>
                <ul>
                  {result.unknown.slice(0, 200).map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="deck-head">
          <h2>{t('coll.title')}</h2>
          <span className="muted">{t('coll.stats', { unique: owned.length, total })}</span>
        </div>
        <div className="toolbar">
          <input type="search" placeholder={t('coll.filter')} value={filter} onChange={(e) => setFilter(e.target.value)} />
          <label>
            {t('coll.delimiter')}:{' '}
            <select value={delimiter} onChange={(e) => setDelimiter(e.target.value)}>
              <option value="^">^</option>
              <option value=",">,</option>
              <option value=";">;</option>
            </select>
          </label>
          <button
            type="button"
            disabled={!owned.length}
            onClick={() => download('ygo-collection.csv', exportCollection(collection, index, delimiter), 'text/csv;charset=utf-8')}
          >
            {t('common.export')} CSV
          </button>
        </div>
        {!owned.length && <p className="muted">{t('coll.empty')}</p>}
        <table className="coll-table">
          <tbody>
            {shown.slice(0, 500).map(({ card, qty }) => (
              <tr key={card.id}>
                <td className="thumb">
                  <CardTile card={card} small />
                </td>
                <td>{card.name}</td>
                <td className="muted">{card.type === 'Monster' ? card.line : `${card.prop ?? ''} ${card.type}`}</td>
                <td className="qty">
                  <button type="button" aria-label="-1" onClick={() => setOwned(card.id, qty - 1)}>
                    −
                  </button>
                  <strong>{qty}</strong>
                  <button type="button" aria-label="+1" onClick={() => setOwned(card.id, qty + 1)}>
                    +
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {missing.length > 0 && (
        <section className="panel">
          <h2>
            {t('coll.missingTitle')}: <span className="muted">{deck.name}</span>
          </h2>
          <ul className="missing-list">
            {missing.map((m) => (
              <li key={m.card.id}>
                {m.missing}× {m.card.name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
