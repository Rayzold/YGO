import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { translate, type Lang } from './lib/i18n'
import { canAdd, homeSection } from './lib/rules'
import { KEYS, newId, readJson, writeJson } from './lib/storage'
import { fetchRemote, mergeCollections, mergeDecks, pushCollection, pushDecks, removeDecks, supabase } from './lib/sync'
import type { Card, CardIndex, CardMeta, Collection, Deck, Section } from './lib/types'
import { parseYdk } from './lib/ydk'

export type SyncState = 'local' | 'idle' | 'syncing' | 'synced' | { error: string }

export interface Store {
  index: CardIndex
  meta: CardMeta
  texts: Record<string, string> | null
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, params?: Record<string, string | number>) => string
  decks: Deck[]
  deck: Deck
  selectDeck: (id: string) => void
  newDeck: () => void
  renameDeck: (name: string) => void
  deleteDeck: (id: string) => void
  duplicateDeck: (id: string) => void
  addCard: (card: Card, section?: Section) => boolean
  removeCard: (section: Section, id: number) => void
  moveCard: (id: number, from: Section, to: Section) => void
  importYdk: (text: string, name?: string) => void
  clearDeck: () => void
  collection: Collection
  setOwned: (id: number, qty: number) => void
  applyImport: (items: Collection, mode: 'add' | 'replace') => void
  session: Session | null
  signOut: () => void
  sync: SyncState
  toast: string | null
  notify: (msg: string) => void
  detail: Card | null
  showDetail: (c: Card | null) => void
  /** cards collected from search, Counter Deck and combos, to add to a deck later (this browser only) */
  shortlist: number[]
  toggleList: (id: number) => void
  clearList: () => void
  geminiKey: string
  setGeminiKey: (k: string) => void
}

const Ctx = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}

const now = () => new Date().toISOString()
const blankDeck = (name = 'Untitled deck'): Deck => ({ id: newId(), name, main: [], extra: [], side: [], updatedAt: now() })

function initialLang(): Lang {
  const saved = readJson<Lang | null>(KEYS.lang, null)
  if (saved === 'en' || saved === 'el') return saved
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('el') ? 'el' : 'en'
}

export function StoreProvider(props: {
  index: CardIndex
  meta: CardMeta
  texts: Record<string, string> | null
  children: ReactNode
}) {
  const { index, meta, texts } = props
  const [lang, setLangState] = useState<Lang>(initialLang)
  const [decks, setDecks] = useState<Deck[]>(() => {
    const d = readJson<Deck[]>(KEYS.decks, [])
    return d.length ? d : [blankDeck()]
  })
  const [currentId, setCurrentId] = useState<string>(() => readJson<string>(KEYS.current, ''))
  const [collection, setCollection] = useState<Collection>(() => readJson<Collection>(KEYS.collection, {}))
  const [session, setSession] = useState<Session | null>(null)
  const [sync, setSync] = useState<SyncState>(supabase ? 'idle' : 'local')
  const [toast, setToast] = useState<string | null>(null)
  const [detail, showDetail] = useState<Card | null>(null)
  const [shortlist, setShortlist] = useState<number[]>(() => readJson<number[]>(KEYS.shortlist, []))
  const [geminiKey, setGeminiKeyState] = useState<string>(() => readJson<string>(KEYS.geminiKey, ''))

  const dirtyDecks = useRef(new Set<string>())
  const deletedDecks = useRef(new Set<string>())
  const dirtyCards = useRef(new Set<number>())
  const decksRef = useRef(decks)
  const collRef = useRef(collection)
  decksRef.current = decks
  collRef.current = collection

  const t = useCallback((key: string, params?: Record<string, string | number>) => translate(lang, key, params), [lang])
  const deck = decks.find((d) => d.id === currentId) ?? decks[0]

  const notify = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3500)
  }, [])

  // ---- persistence -------------------------------------------------------
  useEffect(() => writeJson(KEYS.decks, decks), [decks])
  useEffect(() => writeJson(KEYS.collection, collection), [collection])
  useEffect(() => writeJson(KEYS.current, deck.id), [deck.id])
  useEffect(() => writeJson(KEYS.shortlist, shortlist), [shortlist])

  const toggleList = (id: number) => setShortlist((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))
  const clearList = () => setShortlist([])
  const setGeminiKey = (k: string) => {
    setGeminiKeyState(k)
    writeJson(KEYS.geminiKey, k)
  }

  const setLang = (l: Lang) => {
    setLangState(l)
    writeJson(KEYS.lang, l)
    document.documentElement.lang = l
  }

  // ---- deck actions ------------------------------------------------------
  const updateDeck = useCallback((id: string, fn: (d: Deck) => Deck) => {
    dirtyDecks.current.add(id)
    setDecks((ds) => ds.map((d) => (d.id === id ? { ...fn(d), updatedAt: now() } : d)))
  }, [])

  const addCard = (card: Card, section?: Section): boolean => {
    const target = section ?? homeSection(card)
    const res = canAdd(deck, card, target, index.byId)
    if (!res.ok) {
      notify(t(`issue.${res.code}`, res.params))
      return false
    }
    updateDeck(deck.id, (d) => ({ ...d, [target]: [...d[target], card.id] }))
    return true
  }

  const removeCard = (section: Section, id: number) =>
    updateDeck(deck.id, (d) => {
      const list = [...d[section]]
      const i = list.lastIndexOf(id)
      if (i >= 0) list.splice(i, 1)
      return { ...d, [section]: list }
    })

  const moveCard = (id: number, from: Section, to: Section) => {
    const card = index.byId.get(id)
    if (!card) return
    const list = [...deck[from]]
    const i = list.lastIndexOf(id)
    if (i < 0) return
    list.splice(i, 1)
    const without = { ...deck, [from]: list }
    const res = canAdd(without, card, to, index.byId)
    if (!res.ok) {
      notify(t(`issue.${res.code}`, res.params))
      return
    }
    updateDeck(deck.id, () => ({ ...without, [to]: [...without[to], id] }))
  }

  const importYdk = (text: string, name?: string) => {
    const lists = parseYdk(text)
    const known = (ids: number[]) => ids.filter((id) => index.byId.has(id))
    const all = lists.main.length + lists.extra.length + lists.side.length
    const main = known(lists.main)
    const extra = known(lists.extra)
    const side = known(lists.side)
    const kept = main.length + extra.length + side.length
    // some exporters mix sections: put every card where it belongs
    const isExtra = (id: number) => index.byId.get(id)!.extra
    const fixedMain = [...main, ...extra].filter((id) => !isExtra(id))
    const fixedExtra = [...extra, ...main].filter(isExtra)
    const d = { ...blankDeck(name?.trim() || t('deck.untitled')), main: fixedMain, extra: fixedExtra, side }
    dirtyDecks.current.add(d.id)
    setDecks((ds) => [d, ...ds])
    setCurrentId(d.id)
    notify(t('deck.imported', { n: kept }) + (all > kept ? ' ' + t('deck.importUnknown', { n: all - kept }) : ''))
  }

  const clearDeck = () => updateDeck(deck.id, (d) => ({ ...d, main: [], extra: [], side: [] }))
  const renameDeck = (name: string) => updateDeck(deck.id, (d) => ({ ...d, name }))

  const newDeck = () => {
    const d = blankDeck(t('deck.untitled'))
    dirtyDecks.current.add(d.id)
    setDecks((ds) => [d, ...ds])
    setCurrentId(d.id)
  }

  const duplicateDeck = (id: string) => {
    const src = decks.find((d) => d.id === id)
    if (!src) return
    const d = { ...src, id: newId(), name: `${src.name} (2)`, updatedAt: now() }
    dirtyDecks.current.add(d.id)
    setDecks((ds) => [d, ...ds])
  }

  const deleteDeck = (id: string) => {
    deletedDecks.current.add(id)
    dirtyDecks.current.delete(id)
    setDecks((ds) => {
      const rest = ds.filter((d) => d.id !== id)
      if (rest.length) return rest
      const d = blankDeck(t('deck.untitled'))
      dirtyDecks.current.add(d.id)
      return [d]
    })
  }

  // ---- collection actions --------------------------------------------------
  const setOwned = (id: number, qty: number) => {
    dirtyCards.current.add(id)
    setCollection((c) => {
      const next = { ...c }
      if (qty > 0) next[id] = qty
      else delete next[id]
      return next
    })
  }

  const applyImport = (items: Collection, mode: 'add' | 'replace') => {
    setCollection((c) => {
      const next: Collection = mode === 'replace' ? {} : { ...c }
      if (mode === 'replace') for (const id of Object.keys(c)) dirtyCards.current.add(Number(id))
      for (const [id, qty] of Object.entries(items)) {
        const k = Number(id)
        next[k] = (next[k] ?? 0) + qty
        dirtyCards.current.add(k)
      }
      return next
    })
  }

  // ---- auth + sync -------------------------------------------------------------
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setSync('syncing')
    ;(async () => {
      const remote = await fetchRemote()
      let nextDecks: Deck[]
      let nextColl: Collection
      if (readJson(KEYS.syncedUser, '') !== userId) {
        // first sign-in on this device: keep everything from both sides
        const md = mergeDecks(decksRef.current, remote.decks)
        const mc = mergeCollections(collRef.current, remote.collection)
        await pushDecks(md.toPush, userId)
        await pushCollection(mc.toPush, userId)
        writeJson(KEYS.syncedUser, userId)
        nextDecks = md.merged
        nextColl = mc.merged
      } else {
        nextDecks = remote.decks
        nextColl = remote.collection
      }
      if (cancelled) return
      if (!nextDecks.length) {
        const d = blankDeck()
        dirtyDecks.current.add(d.id)
        nextDecks = [d]
      }
      setDecks(nextDecks)
      setCollection(nextColl)
      setSync('synced')
    })().catch((e: unknown) => !cancelled && setSync({ error: e instanceof Error ? e.message : String(e) }))
    return () => {
      cancelled = true
    }
  }, [userId])

  // push local changes (debounced) while signed in
  useEffect(() => {
    if (!userId || sync === 'syncing' || sync === 'local' || sync === 'idle') return
    if (!dirtyDecks.current.size && !deletedDecks.current.size && !dirtyCards.current.size) return
    const timer = window.setTimeout(async () => {
      const ids = [...dirtyDecks.current]
      const dels = [...deletedDecks.current]
      const cards = [...dirtyCards.current]
      dirtyDecks.current.clear()
      deletedDecks.current.clear()
      dirtyCards.current.clear()
      try {
        await pushDecks(decksRef.current.filter((d) => ids.includes(d.id)), userId)
        await removeDecks(dels)
        await pushCollection(Object.fromEntries(cards.map((id) => [id, collRef.current[id] ?? 0])), userId)
        setSync('synced')
      } catch (e) {
        ids.forEach((id) => dirtyDecks.current.add(id))
        dels.forEach((id) => deletedDecks.current.add(id))
        cards.forEach((id) => dirtyCards.current.add(id))
        setSync({ error: e instanceof Error ? e.message : String(e) })
      }
    }, 800)
    return () => window.clearTimeout(timer)
  }, [decks, collection, userId, sync])

  const signOut = () => {
    supabase?.auth.signOut()
    setSession(null)
    setSync(supabase ? 'idle' : 'local')
  }

  const store: Store = {
    index,
    meta,
    texts,
    lang,
    setLang,
    t,
    decks,
    deck,
    selectDeck: setCurrentId,
    newDeck,
    renameDeck,
    deleteDeck,
    duplicateDeck,
    addCard,
    removeCard,
    moveCard,
    importYdk,
    clearDeck,
    collection,
    setOwned,
    applyImport,
    session,
    signOut,
    sync,
    toast,
    notify,
    detail,
    showDetail,
    shortlist,
    toggleList,
    clearList,
    geminiKey,
    setGeminiKey,
  }
  return <Ctx.Provider value={store}>{props.children}</Ctx.Provider>
}
