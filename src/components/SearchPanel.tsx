import { useDeferredValue, useMemo, useState } from 'react'
import { TAGS } from '../lib/i18n'
import { allArchetypes, EMPTY_QUERY, search, type Query } from '../lib/search'
import { useStore } from '../state'
import { CardTile } from './CardTile'

const PAGE = 60
const ATTRS = ['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND', 'DIVINE']

export function SearchPanel() {
  const { index, texts, collection, addCard, t, shortlist, toggleList } = useStore()
  const [q, setQ] = useState<Query>(EMPTY_QUERY)
  const [shown, setShown] = useState(PAGE)
  const deferred = useDeferredValue(q)
  const archetypes = useMemo(() => allArchetypes(index.cards), [index.cards])
  const results = useMemo(
    () => search(index.cards, deferred, { texts: texts ?? undefined, collection }),
    [index.cards, deferred, texts, collection],
  )
  const set = <K extends keyof Query>(k: K, v: Query[K]) => {
    setQ((cur) => ({ ...cur, [k]: v }))
    setShown(PAGE)
  }

  return (
    <section className="panel search-panel" aria-label="Card search">
      <input
        className="search-input"
        type="search"
        placeholder={t('search.placeholder')}
        value={q.text}
        onChange={(e) => set('text', e.target.value)}
        autoFocus
      />
      <div className="filters">
        <select aria-label={t('search.type')} value={q.type} onChange={(e) => set('type', e.target.value as Query['type'])}>
          <option value="">{t('search.type')}: {t('common.all')}</option>
          {(['Monster', 'Spell', 'Trap'] as const).map((x) => (
            <option key={x} value={x}>
              {t(`type.${x}`)}
            </option>
          ))}
        </select>
        <select aria-label={t('search.frame')} value={q.frame} onChange={(e) => set('frame', e.target.value as Query['frame'])}>
          <option value="">{t('search.frame')}: {t('common.all')}</option>
          <option value="main">{t('search.frame.main')}</option>
          <option value="extra">{t('search.frame.extra')}</option>
        </select>
        <select aria-label={t('search.attr')} value={q.attr} onChange={(e) => set('attr', e.target.value)}>
          <option value="">{t('search.attr')}: {t('common.any')}</option>
          {ATTRS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <select aria-label={t('search.level')} value={q.level} onChange={(e) => set('level', e.target.value)}>
          <option value="">{t('search.level')}: {t('common.any')}</option>
          {Array.from({ length: 13 }, (_, i) => i + 1).map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <input
          aria-label={t('search.archetype')}
          list="archetypes"
          placeholder={t('search.archetype')}
          value={q.archetype}
          onChange={(e) => set('archetype', e.target.value)}
        />
        <datalist id="archetypes">
          {archetypes.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <select aria-label={t('search.tag')} value={q.tag} onChange={(e) => set('tag', e.target.value)}>
          <option value="">{t('search.tag')}: {t('common.any')}</option>
          {TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {t(`tag.${tag}`)}
            </option>
          ))}
        </select>
        <select aria-label={t('search.limit')} value={q.limit} onChange={(e) => set('limit', e.target.value as Query['limit'])}>
          <option value="">{t('search.limit')}: {t('common.all')}</option>
          {[0, 1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {t(`limit.${n}`)}
            </option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={q.inText} onChange={(e) => set('inText', e.target.checked)} disabled={!texts} />
          {t('search.inText')}
        </label>
        <label className="check">
          <input type="checkbox" checked={q.ownedOnly} onChange={(e) => set('ownedOnly', e.target.checked)} />
          {t('search.owned')}
        </label>
        <button type="button" className="link" onClick={() => setQ(EMPTY_QUERY)}>
          {t('search.reset')}
        </button>
      </div>
      <p className="muted">{results.length === 1 ? t('common.result1') : t('common.results', { n: results.length })}</p>
      <div className="grid">
        {results.slice(0, shown).map((c) => (
          <CardTile
            key={c.id}
            card={c}
            owned={collection[c.id]}
            onClick={() => addCard(c)}
            actions={[
              { label: '+', title: t('tile.add'), onClick: () => addCard(c) },
              { label: 'S', title: t('tile.side'), onClick: () => addCard(c, 'side') },
              { label: shortlist.includes(c.id) ? '✓' : 'L', title: t(shortlist.includes(c.id) ? 'list.remove' : 'list.add'), onClick: () => toggleList(c.id) },
            ]}
          />
        ))}
      </div>
      {results.length > shown && (
        <button type="button" className="more" onClick={() => setShown((n) => n + PAGE)}>
          {t('common.showMore', { n: results.length - shown })}
        </button>
      )}
    </section>
  )
}
