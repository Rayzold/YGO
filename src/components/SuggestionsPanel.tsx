import { useDeferredValue, useMemo, useState } from 'react'
import { suggest, type Reason } from '../lib/suggest'
import { useStore } from '../state'
import { CardTile } from './CardTile'

type Tab = 'main' | 'extra' | 'side'

export function SuggestionsPanel() {
  const { deck, index, collection, addCard, t } = useStore()
  const [tab, setTab] = useState<Tab>('main')
  const [ownedOnly, setOwnedOnly] = useState(false)
  const deferredDeck = useDeferredValue(deck)
  const result = useMemo(
    () => suggest(deferredDeck, index.cards, index.byId, { collection, ownedOnly }),
    [deferredDeck, index, collection, ownedOnly],
  )
  const empty = !deck.main.length && !deck.extra.length && !deck.side.length
  const reason = (r: Reason) => {
    const p = { ...r.params }
    if (typeof p.tag === 'string') p.tag = t(`tag.${p.tag}`)
    return t(`reason.${r.code}`, p)
  }
  const list = result[tab]

  return (
    <section className="panel sug-panel" aria-label={t('sug.title')}>
      <h2>{t('sug.title')}</h2>
      <div className="tabs" role="tablist">
        {(['main', 'extra', 'side'] as Tab[]).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} className={tab === x ? 'active' : ''} onClick={() => setTab(x)}>
            {t(`sug.${x}`)} {!empty && <span className="muted">{result[x].length}</span>}
          </button>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} />
        {t('sug.ownedOnly')}
      </label>
      {empty && <p className="muted">{t('sug.empty')}</p>}
      {!empty && !list.length && <p className="muted">{t('sug.none')}</p>}
      {tab === 'side' && !empty && <p className="muted small-note">{t('sug.sideNote')}</p>}
      <ul className="sug-list">
        {list.map((s) => (
          <li key={s.card.id}>
            <CardTile
              card={s.card}
              small
              owned={collection[s.card.id]}
              onClick={() => addCard(s.card, tab === 'side' ? 'side' : undefined)}
              actions={[{ label: '+', title: t('tile.add'), onClick: () => addCard(s.card, tab === 'side' ? 'side' : undefined) }]}
            />
            <div>
              <strong>{s.card.name}</strong>
              <ul className="reasons">
                {s.reasons.map((r, i) => (
                  <li key={i}>{reason(r)}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
