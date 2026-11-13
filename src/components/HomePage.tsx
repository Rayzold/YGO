import { useMemo } from 'react'
import { useStore } from '../state'

export type HomeTarget = 'builder' | 'search' | 'counter' | 'combos'

/** Landing page: three big entry points and a small news panel (banlist, card data, current deck). */
export function HomePage({ go }: { go: (p: HomeTarget) => void }) {
  const { t, index, meta, deck } = useStore()
  const counts = useMemo(() => {
    const n = [0, 0, 0]
    for (const c of index.cards) if (c.limit < 3) n[c.limit]++
    return n
  }, [index])
  const size = deck.main.length + deck.extra.length + deck.side.length
  const tiles: { id: HomeTarget; icon: string }[] = [
    { id: 'builder', icon: '🂠' },
    { id: 'counter', icon: '⛨' },
    { id: 'combos', icon: '✧' },
    { id: 'search', icon: '⌕' },
  ]

  return (
    <div className="home">
      <section className="hero">
        <div className="sigil" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <h1>{t('home.title')}</h1>
        <p className="muted">{t('home.body')}</p>
        <div className="home-tiles">
          {tiles.map((x) => (
            <button key={x.id} type="button" className="home-tile" onClick={() => go(x.id)}>
              <span className="icon" aria-hidden>
                {x.icon}
              </span>
              <b>{t(`nav.${x.id}`)}</b>
              <small>{t(`home.${x.id}`)}</small>
              <span className="go" aria-hidden>
                ›
              </span>
            </button>
          ))}
        </div>
      </section>
      <aside className="news">
        <h2>{t('home.news')}</h2>
        <article>
          <span className="tag t-ban">BANLIST</span>
          <div>
            <b>{t('home.banlist', { date: meta.banlist ?? '—' })}</b>
            <p>{t('home.banlistCounts', { f: counts[0], l: counts[1], s: counts[2] })}</p>
            {meta.upcoming && <p>{t('app.upcoming', { date: meta.upcoming })}</p>}
          </div>
        </article>
        <article>
          <span className="tag t-db">DB</span>
          <div>
            <b>{t('home.db')}</b>
            <p>{t('home.dbBody', { n: meta.count.toLocaleString(), date: meta.built.slice(0, 10) })}</p>
          </div>
        </article>
        <article>
          <span className="tag t-deck">DECK</span>
          <div>
            <b>{deck.name}</b>
            <p>{size ? t('home.deckBody', { main: deck.main.length, extra: deck.extra.length, side: deck.side.length }) : t('home.deckEmpty')}</p>
          </div>
        </article>
      </aside>
    </div>
  )
}
