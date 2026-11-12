import { useMemo, useState } from 'react'
import { archetypeCards, archetypeList, playerCards, resolveNames, toAi, validateCombos } from '../lib/ai'
import { normName } from '../lib/data'
import { askCombos, askCounter, pickModel, type ComboAdvice, type CounterAdvice } from '../lib/gemini'
import type { Card } from '../lib/types'
import { useStore } from '../state'
import { CardTile } from './CardTile'

/** Runs a Gemini call with progress text and translated errors. */
function useGemini() {
  const { geminiKey, t } = useStore()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  async function run<T>(fn: (model: string, step: (s: string) => void) => Promise<T>): Promise<T | undefined> {
    setError('')
    if (!geminiKey) {
      setError(t('ai.keyMissing'))
      return
    }
    try {
      setBusy(t('ai.picking'))
      const model = await pickModel(geminiKey)
      setBusy(t('ai.thinking', { model }))
      return await fn(model, setBusy)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg === 'bad-key' ? t('ai.badKey') : msg === 'no-model' ? t('ai.noModel') : msg)
    } finally {
      setBusy('')
    }
  }
  return { busy, error, setError, run }
}

export function GeminiKey() {
  const { geminiKey, setGeminiKey, t } = useStore()
  return (
    <label className="ai-key">
      <span>{t('ai.key')}</span>
      <input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value.trim())} placeholder="AIza…" autoComplete="off" />
      <small className="muted">{t('ai.keyHint')}</small>
    </label>
  )
}

export function ListButton({ card }: { card: Card }) {
  const { shortlist, toggleList, t } = useStore()
  const on = shortlist.includes(card.id)
  return (
    <button type="button" className={on ? 'listed' : ''} onClick={() => toggleList(card.id)}>
      {on ? `✓ ${t('list.remove')}` : `+ ${t('list.add')}`}
    </button>
  )
}

/** A named card from the model, with its tile when it exists and a short explanation. */
function Row({ card, name, note }: { card?: Card; name: string; note: string }) {
  const { collection } = useStore()
  return (
    <li className="ai-row">
      {card ? <CardTile card={card} small owned={collection[card.id]} /> : <span className="ai-noimg" />}
      <div>
        <strong>{card?.name ?? name}</strong>
        <p className="muted small-note">{note}</p>
        {card && <ListButton card={card} />}
      </div>
    </li>
  )
}

export function CounterPage() {
  const { index, texts, collection, deck, lang, t, geminiKey } = useStore()
  const { busy, error, setError, run } = useGemini()
  const [opponent, setOpponent] = useState('')
  const [result, setResult] = useState<(CounterAdvice & { byName: Map<string, Card>; side: Card[] }) | null>(null)
  const archetypes = useMemo(() => archetypeList(index.cards), [index])

  async function go() {
    setResult(null)
    const name = opponent.trim()
    const theirs = archetypeCards(index.cards, name)
    if (!theirs.length) return setError(t('counter.unknown', { name }))
    const mine = playerCards(collection, deck, index)
    await run(async (model, step) => {
      const r = await askCounter(geminiKey, model, lang, name, theirs.map((c) => toAi(c, texts)), mine.map((c) => toAi(c, texts)))
      step(t('ai.checking'))
      const owned = new Set(mine.map((c) => c.id))
      const byName = new Map<string, Card>()
      for (const c of resolveNames([...r.threats.map((x) => x.name), ...r.fromCollection.map((x) => x.name)], index, true))
        byName.set(normName(c.name), c)
      const side = resolveNames(r.sideSuggestions.map((s) => s.name), index).filter((c) => !owned.has(c.id))
      setResult({
        ...r,
        // only real cards: invented names are dropped, not shown
        threats: r.threats.filter((x) => byName.has(normName(x.name))),
        fromCollection: r.fromCollection.filter((f) => owned.has(byName.get(normName(f.name))?.id ?? -1)),
        byName,
        side,
      })
    })
  }

  return (
    <section className="panel ai-page">
      <h2>{t('counter.title')}</h2>
      <p className="muted">{t('counter.body')}</p>
      <GeminiKey />
      <div className="ai-go">
        <input list="ygo-archetypes" value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder={t('counter.placeholder')} />
        <datalist id="ygo-archetypes">
          {archetypes.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <button type="button" className="primary" onClick={go} disabled={!!busy || !opponent.trim()}>
          {busy || t('counter.go')}
        </button>
      </div>
      {error && <p className="err-text">{error}</p>}
      <p className="muted small-note">{t('ai.disclaimer')}</p>
      {result && (
        <>
          {result.plan && (
            <>
              <h3>{t('counter.plan')}</h3>
              <p className="ai-plan">{result.plan}</p>
            </>
          )}
          <h3>{t('counter.threats')}</h3>
          <ul className="ai-list">
            {result.threats.map((x) => (
              <Row key={x.name} name={x.name} card={result.byName.get(normName(x.name))} note={x.why} />
            ))}
          </ul>
          <h3>{t('counter.mine')}</h3>
          {result.fromCollection.length ? (
            <ul className="ai-list">
              {result.fromCollection.map((x) => (
                <Row key={x.name} name={x.name} card={result.byName.get(normName(x.name))} note={x.how} />
              ))}
            </ul>
          ) : (
            <p className="muted">{t('counter.mineNone')}</p>
          )}
          <h3>{t('counter.side')}</h3>
          <ul className="ai-list">
            {result.side.map((c) => (
              <Row
                key={c.id}
                name={c.name}
                card={c}
                note={result.sideSuggestions.find((s) => normName(s.name) === normName(c.name))?.why ?? ''}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export function CombosPage() {
  const { index, texts, collection, deck, lang, t, geminiKey } = useStore()
  const { busy, error, setError, run } = useGemini()
  const [result, setResult] = useState<(ComboAdvice & { rejected: number; extra: Card[] }) | null>(null)

  async function go() {
    setResult(null)
    const cards = (ids: number[]) => [...new Set(ids)].map((id) => index.byId.get(id)).filter((c): c is Card => !!c)
    const owned = cards(deck.main).filter((c) => (collection[c.id] ?? 0) > 0)
    const extra = cards(deck.extra)
    if (!owned.length) return setError(t('combos.noneOwned'))
    await run(async (model, step) => {
      const r = await askCombos(geminiKey, model, lang, owned.map((c) => toAi(c, texts)), extra.map((c) => toAi(c, texts)))
      step(t('ai.checking'))
      const { valid, rejected } = validateCombos(r.combos, [...owned, ...extra].map((c) => c.name))
      const inDeck = new Set(deck.extra)
      const ideas = resolveNames(r.extraSuggestions.map((s) => s.name), index).filter((c) => c.extra && !inDeck.has(c.id))
      setResult({ ...r, combos: valid, rejected, extra: ideas })
    })
  }

  return (
    <section className="panel ai-page">
      <h2>{t('combos.title')}</h2>
      <p className="muted">{t('combos.body', { deck: deck.name })}</p>
      <GeminiKey />
      <div className="ai-go">
        <button type="button" className="primary" onClick={go} disabled={!!busy}>
          {busy || t('combos.go')}
        </button>
      </div>
      {error && <p className="err-text">{error}</p>}
      <p className="muted small-note">{t('ai.disclaimer')}</p>
      {result && (
        <>
          {!result.combos.length && <p className="muted">{t('combos.none')}</p>}
          {result.combos.map((c, i) => (
            <article key={i} className="ai-combo">
              <h3>{c.name}</h3>
              <p>
                <strong>{t('combos.starter')}:</strong> {c.starter}
              </p>
              <ol>
                {c.steps.map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ol>
              <p>
                <strong>{t('combos.end')}:</strong> {c.endBoard}
              </p>
            </article>
          ))}
          {result.rejected > 0 && <p className="muted">{t('combos.rejected', { n: result.rejected })}</p>}
          {result.extra.length > 0 && (
            <>
              <h3>{t('combos.extra')}</h3>
              <ul className="ai-list">
                {result.extra.map((c) => (
                  <Row
                    key={c.id}
                    name={c.name}
                    card={c}
                    note={result.extraSuggestions.find((s) => normName(s.name) === normName(c.name))?.reason ?? ''}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  )
}

/** The List, shown above the builder while it has cards. */
export function ShortlistPanel() {
  const { shortlist, toggleList, clearList, index, addCard, collection, t } = useStore()
  const cards = shortlist.map((id) => index.byId.get(id)).filter((c): c is Card => !!c)
  if (!cards.length) return null
  const send = (c: Card, section?: 'side') => {
    if (addCard(c, section)) toggleList(c.id)
  }
  return (
    <section className="panel shortlist">
      <div className="shortlist-head">
        <h2>{t('list.title', { n: cards.length })}</h2>
        <button type="button" className="link" onClick={clearList}>
          {t('list.clear')}
        </button>
      </div>
      <p className="muted small-note">{t('list.body')}</p>
      <ul className="shortlist-items">
        {cards.map((c) => (
          <li key={c.id}>
            <CardTile card={c} small owned={collection[c.id]} />
            <div>
              <strong>{c.name}</strong>
              <span className="shortlist-actions">
                <button type="button" onClick={() => send(c)}>
                  {c.extra ? t('list.toExtra') : t('list.toMain')}
                </button>
                {!c.extra && (
                  <button type="button" onClick={() => send(c, 'side')}>
                    {t('list.toSide')}
                  </button>
                )}
                <button type="button" aria-label={t('list.remove')} title={t('list.remove')} onClick={() => toggleList(c.id)}>
                  ×
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
