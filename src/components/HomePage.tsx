import { useMemo, type ReactNode } from 'react'
import { validate } from '../lib/rules'
import { useStore } from '../state'
import { BanlistIcon, Calendar, CardFrameIcon, CardsIcon, Megaphone, ScalesIcon, SearchIcon, ShieldIcon, StarIcon, TcgIcon } from './Icons'

export type HomeTarget = 'builder' | 'search' | 'counter' | 'combos'

const TILES: { id: HomeTarget; icon: ReactNode }[] = [
  { id: 'builder', icon: <CardsIcon /> },
  { id: 'counter', icon: <ShieldIcon /> },
  { id: 'combos', icon: <StarIcon /> },
  { id: 'search', icon: <SearchIcon /> },
]

function NewsItem({ icon, title, body, date }: { icon: ReactNode; title: string; body: string; date?: string | null }) {
  return (
    <article className="news-item">
      <span className="news-thumb">{icon}</span>
      <div>
        <b>{title}</b>
        <p>{body}</p>
        {date && (
          <small className="news-date">
            <Calendar /> {date}
          </small>
        )}
      </div>
    </article>
  )
}

/** Landing page: emblem, four big entry points and a news panel built from real data (banlist, card data, current deck). */
export function HomePage({ go }: { go: (p: HomeTarget) => void }) {
  const { t, index, meta, deck, lang } = useStore()
  const counts = useMemo(() => {
    const n = [0, 0, 0]
    for (const c of index.cards) if (c.limit < 3) n[c.limit]++
    return n
  }, [index])
  const legal = useMemo(() => !validate(deck, index.byId).some((i) => i.level === 'error'), [deck, index.byId])
  const size = deck.main.length + deck.extra.length + deck.side.length
  const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-GB') : null)

  return (
    <div className="home">
      <section className="hero">
        <div className="emblem" aria-hidden>
          <span className="ring r1" />
          <span className="ring r2" />
          <span className="ring r3" />
          <span className="emblem-word">
            YGO
            <small>Assistant</small>
          </span>
        </div>
        <h1>{t('home.title')}</h1>
        <p className="hero-sub">{t('home.body')}</p>
        <div className="home-tiles">
          {TILES.map((x) => (
            <button key={x.id} type="button" className="home-tile" onClick={() => go(x.id)}>
              <span className="frame">
                <span className="frame-in">
                  <span className="tile-icon">{x.icon}</span>
                  <b>{t(`nav.${x.id}`)}</b>
                  <small>{t(`home.${x.id}`)}</small>
                  <span className="go" aria-hidden>
                    ›
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
      <aside className="news">
        <div className="frame">
          <div className="frame-in">
            <h2>
              <Megaphone /> {t('home.news')}
            </h2>
            <NewsItem
              icon={<BanlistIcon />}
              title={t('home.banlist', { date: day(meta.banlist) ?? '—' })}
              body={t('home.banlistCounts', {
                f: counts[0],
                l: counts[1],
                s: counts[2],
              })}
              date={day(meta.banlist)}
            />
            <NewsItem
              icon={<CardFrameIcon />}
              title={t('home.db')}
              body={t('home.dbBody', {
                n: meta.count.toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB'),
              })}
              date={day(meta.built)}
            />
            <NewsItem
              icon={<ScalesIcon />}
              title={deck.name}
              body={
                size
                  ? `${t('home.deckBody', { main: deck.main.length, extra: deck.extra.length, side: deck.side.length })} · ${legal ? t('deck.legal') : t('deck.notLegal')}`
                  : t('home.deckEmpty')
              }
              date={day(deck.updatedAt)}
            />
            <NewsItem
              icon={<TcgIcon />}
              title={meta.upcoming ? t('home.next', { date: day(meta.upcoming) ?? '' }) : t('home.format')}
              body={meta.upcoming ? t('home.nextBody') : t('home.formatBody')}
              date={meta.upcoming ? day(meta.upcoming) : null}
            />
          </div>
        </div>
      </aside>
    </div>
  )
}
