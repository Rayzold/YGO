import { useEffect, useState } from 'react'
import { CombosPage, CounterPage, ShortlistPanel } from './components/AiTools'
import { AuthModal } from './components/AuthModal'
import { CardDetail } from './components/CardDetail'
import { CollectionPage } from './components/CollectionPage'
import { DeckPanel } from './components/DeckPanel'
import { DecksPage } from './components/DecksPage'
import { SearchPanel } from './components/SearchPanel'
import { SuggestionsPanel } from './components/SuggestionsPanel'
import { loadCards, loadTexts } from './lib/data'
import { translate } from './lib/i18n'
import { supabase } from './lib/sync'
import type { CardIndex, CardMeta } from './lib/types'
import { StoreProvider, useStore } from './state'

type Page = 'builder' | 'collection' | 'decks' | 'counter' | 'combos'

function Shell() {
  const { t, lang, setLang, meta, session, signOut, sync, toast, deck, shortlist } = useStore()
  const [page, setPage] = useState<Page>('builder')
  const [authOpen, setAuthOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<'search' | 'deck' | 'sug'>('search')
  const syncLabel =
    sync === 'syncing' ? t('auth.syncing') : sync === 'synced' ? t('auth.synced') : typeof sync === 'object' ? t('auth.syncError', { error: sync.error }) : ''

  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="logo">YGO</span>
          <span>{t('app.title')}</span>
          <span className="pill">{t('app.format')}</span>
          {meta.banlist && <span className="pill subtle">{t('app.banlist', { date: meta.banlist })}</span>}
          {meta.upcoming && <span className="pill warn">{t('app.upcoming', { date: meta.upcoming })}</span>}
        </div>
        <nav>
          {(['builder', 'collection', 'decks', 'counter', 'combos'] as Page[]).map((p) => (
            <button key={p} type="button" className={page === p ? 'active' : ''} onClick={() => setPage(p)}>
              {t(`nav.${p}`)}
              {p === 'builder' && shortlist.length > 0 && <span className="pill nav-badge">{shortlist.length}</span>}
            </button>
          ))}
        </nav>
        <div className="account">
          <button type="button" className="lang" onClick={() => setLang(lang === 'en' ? 'el' : 'en')} aria-label="Language">
            {lang === 'en' ? 'ΕΛ' : 'EN'}
          </button>
          {!supabase ? (
            <span className="pill subtle" title={t('auth.localModeHint')}>
              {t('auth.localMode')}
            </span>
          ) : session ? (
            <>
              <span className="muted small-note" title={syncLabel}>
                {session.user.email} {syncLabel && `· ${syncLabel}`}
              </span>
              <button type="button" onClick={signOut}>
                {t('auth.signOut')}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setAuthOpen(true)}>
              {t('auth.signIn')}
            </button>
          )}
        </div>
      </header>

      <main>
        {page === 'builder' && (
          <>
          <ShortlistPanel />
          <div className="mobile-tabs">
            {(['search', 'deck', 'sug'] as const).map((m) => (
              <button key={m} type="button" className={mobileTab === m ? 'active' : ''} onClick={() => setMobileTab(m)}>
                {m === 'search' ? t('search.title') : m === 'deck' ? t('deck.title', { n: deck.main.length + deck.extra.length + deck.side.length }) : t('sug.title')}
              </button>
            ))}
          </div>
          <div className={`builder m-${mobileTab}`}>
            <SearchPanel />
            <DeckPanel />
            <SuggestionsPanel />
          </div>
          </>
        )}
        {page === 'collection' && <CollectionPage />}
        {page === 'decks' && <DecksPage onOpen={() => setPage('builder')} />}
        {page === 'counter' && <CounterPage />}
        {page === 'combos' && <CombosPage />}
      </main>

      <footer>
        <p>{t('footer.legal')}</p>
        <p>{t('footer.data')}</p>
      </footer>

      <CardDetail />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  )
}

export default function App() {
  const [data, setData] = useState<{ meta: CardMeta; index: CardIndex } | null>(null)
  const [texts, setTexts] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lang = navigator.language?.toLowerCase().startsWith('el') ? 'el' : 'en'

  useEffect(() => {
    loadCards()
      .then((d) => {
        setData(d)
        return loadTexts().then(setTexts)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  if (error) return <div className="splash err-text">{translate(lang, 'app.loadError', { error })}</div>
  if (!data) return <div className="splash">{translate(lang, 'app.loading')}</div>
  return (
    <StoreProvider index={data.index} meta={data.meta} texts={texts}>
      <Shell />
    </StoreProvider>
  )
}
