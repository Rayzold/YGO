import { useMemo, useRef } from 'react'
import { validate } from '../lib/rules'
import { download } from '../lib/storage'
import type { Card, Collection, Deck, Section } from '../lib/types'
import { toYdk } from '../lib/ydk'
import { useStore } from '../state'
import { CardTile } from './CardTile'

const TYPE_ORDER = { Monster: 0, Spell: 1, Trap: 2 }

export function groupSection(ids: number[], byId: Map<number, Card>) {
  const counts = new Map<number, number>()
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts.entries()]
    .map(([id, n]) => ({ card: byId.get(id), n }))
    .filter((x): x is { card: Card; n: number } => !!x.card)
    .sort((a, b) => TYPE_ORDER[a.card.type] - TYPE_ORDER[b.card.type] || a.card.name.localeCompare(b.card.name))
}

/** Copies needed per card name beyond what the collection has. */
export function missingCards(deck: Deck, byId: Map<number, Card>, collection: Collection) {
  const need = new Map<string, { card: Card; n: number }>()
  for (const id of [...deck.main, ...deck.extra, ...deck.side]) {
    const c = byId.get(id)
    if (!c) continue
    const e = need.get(c.name) ?? { card: c, n: 0 }
    e.n++
    need.set(c.name, e)
  }
  const ownedByName = new Map<string, number>()
  for (const [id, qty] of Object.entries(collection)) {
    const c = byId.get(Number(id))
    if (c) ownedByName.set(c.name, (ownedByName.get(c.name) ?? 0) + qty)
  }
  return [...need.values()]
    .map(({ card, n }) => ({ card, missing: n - (ownedByName.get(card.name) ?? 0) }))
    .filter((x) => x.missing > 0)
}

export function DeckPanel() {
  const store = useStore()
  const { deck, index, t, collection } = store
  const fileRef = useRef<HTMLInputElement>(null)
  const issues = useMemo(() => validate(deck, index.byId), [deck, index.byId])
  const errors = issues.filter((i) => i.level === 'error')
  const warns = issues.filter((i) => i.level === 'warn')
  const missing = useMemo(() => missingCards(deck, index.byId, collection), [deck, index.byId, collection])
  const missingTotal = missing.reduce((a, m) => a + m.missing, 0)
  const total = deck.main.length + deck.extra.length + deck.side.length

  const section = (s: Section, title: string, max: string) => {
    const groups = groupSection(deck[s], index.byId)
    return (
      <div className={`deck-section ${s}`}>
        <h3>
          {title} <span className="muted">{deck[s].length}{max}</span>
        </h3>
        <div className="grid small">
          {groups.map(({ card, n }) => (
            <CardTile
              key={card.id}
              card={card}
              small
              count={n}
              onClick={() => store.removeCard(s, card.id)}
              actions={[
                { label: '−', title: t('tile.remove'), onClick: () => store.removeCard(s, card.id) },
                s === 'side'
                  ? { label: '↑', title: t('tile.fromSide'), onClick: () => store.moveCard(card.id, 'side', card.extra ? 'extra' : 'main') }
                  : { label: '↓', title: t('tile.toSide'), onClick: () => store.moveCard(card.id, s, 'side') },
              ]}
            />
          ))}
        </div>
      </div>
    )
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    store.importYdk(await f.text(), f.name.replace(/\.ydk$/i, ''))
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <section className="panel deck-panel" aria-label="Deck">
      <div className="deck-head">
        <input
          className="deck-name"
          aria-label={t('deck.name')}
          value={deck.name}
          onChange={(e) => store.renameDeck(e.target.value)}
        />
        <span className={`legal ${errors.length ? 'bad' : 'ok'}`}>{errors.length ? t('deck.notLegal') : t('deck.legal')}</span>
      </div>
      <div className="toolbar">
        <button type="button" onClick={store.newDeck}>
          {t('deck.new')}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}>
          {t('deck.importYdk')}
        </button>
        <input ref={fileRef} type="file" accept=".ydk,text/plain" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <button
          type="button"
          disabled={!total}
          onClick={() => download(`${deck.name.replace(/[^\w\- ]+/g, '').trim() || 'deck'}.ydk`, toYdk(deck))}
        >
          {t('deck.exportYdk')}
        </button>
        <button type="button" disabled={!total} onClick={() => confirm(t('deck.clearConfirm')) && store.clearDeck()}>
          {t('deck.clear')}
        </button>
      </div>
      {total > 0 && (
        <p className={`missing ${missingTotal ? '' : 'ok'}`}>
          {missingTotal ? t('deck.missing', { n: missingTotal }) : t('deck.complete')}
        </p>
      )}
      {(errors.length > 0 || warns.length > 0) && total > 0 && (
        <ul className="issues">
          {[...errors, ...warns].map((i, k) => (
            <li key={k} className={i.level}>
              {t(`issue.${i.code}`, i.params)}
            </li>
          ))}
        </ul>
      )}
      {!total && <p className="muted">{t('deck.empty')}</p>}
      {section('main', t('deck.main'), ' / 40–60')}
      {section('extra', t('deck.extra'), ' / 15')}
      {section('side', t('deck.side'), ' / 15')}
    </section>
  )
}
