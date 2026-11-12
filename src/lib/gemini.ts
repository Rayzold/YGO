// Gemini with the user's own key (BYOK). The key stays in this browser only and goes straight to Google.
import type { Lang } from './i18n'

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

/** A card as the model sees it: name, a short type line and the card text. */
export interface AiCard {
  name: string
  kind: string
  text: string
}

export interface ComboLine {
  name: string
  starter: string
  steps: string[]
  endBoard: string
  cardsUsed: string[]
}

export interface ComboAdvice {
  combos: ComboLine[]
  extraSuggestions: { name: string; reason: string }[]
}

export interface CounterAdvice {
  threats: { name: string; why: string }[]
  fromCollection: { name: string; how: string }[]
  sideSuggestions: { name: string; why: string }[]
  plan: string
}

/** Newest stable "flash" model the key can use (model names change often). */
export async function pickModel(key: string): Promise<string> {
  const res = await fetch(`${BASE}/models?key=${encodeURIComponent(key)}&pageSize=200`)
  if (!res.ok) throw new Error(res.status === 400 || res.status === 403 ? 'bad-key' : `Gemini ${res.status}`)
  const models: { name: string; supportedGenerationMethods?: string[] }[] = (await res.json()).models ?? []
  const flash = models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace('models/', ''))
    .filter((n) => n.includes('flash') && !/lite|preview|exp|tts|image|live|audio|thinking/.test(n))
    .sort()
  if (!flash.length) throw new Error('no-model')
  return flash[flash.length - 1]
}

async function generate<T>(key: string, model: string, prompt: string): Promise<Partial<T>> {
  const res = await fetch(`${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const text =
    (await res.json()).candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  return JSON.parse(text) as Partial<T>
}

const list = (cs: AiCard[], max = 600) =>
  cs.map((c) => `- ${c.name} [${c.kind}]: ${c.text.replace(/\s+/g, ' ').slice(0, max)}`).join('\n')
const language = (lang: Lang) => (lang === 'el' ? 'Greek' : 'English')

export async function askCombos(key: string, model: string, lang: Lang, owned: AiCard[], extra: AiCard[]): Promise<ComboAdvice> {
  const prompt = `You are a Yu-Gi-Oh! TCG combo expert. Use ONLY the cards listed below (main deck cards the player owns, plus their Extra Deck).
Never use a card that is not in these lists. Respect current TCG rules and each card's text exactly (once-per-turn clauses, costs, summoning conditions).

MAIN DECK CARDS THE PLAYER OWNS:
${list(owned)}

EXTRA DECK:
${list(extra) || '(empty)'}

Return JSON only:
{"combos":[{"name":string,"starter":string,"steps":[string],"endBoard":string,"cardsUsed":[exact card names from the lists]}],
 "extraSuggestions":[{"name":exact real TCG card name,"reason":string}]}
Give up to 5 combos, from the most common 1-card starters to bigger lines. "extraSuggestions": up to 5 Extra Deck monsters NOT already listed that these cards can summon, legal in TCG.
Write the text in ${language(lang)}, keep card names in English.`
  const p = await generate<ComboAdvice>(key, model, prompt)
  return { combos: p.combos ?? [], extraSuggestions: p.extraSuggestions ?? [] }
}

export async function askCounter(
  key: string,
  model: string,
  lang: Lang,
  opponent: string,
  opponentCards: AiCard[],
  mine: AiCard[],
): Promise<CounterAdvice> {
  const prompt = `You are a Yu-Gi-Oh! TCG side-decking expert. The opponent plays the "${opponent}" archetype.

OPPONENT ARCHETYPE CARDS (reference):
${list(opponentCards.slice(0, 40), 400)}

CARDS THE PLAYER HAS (collection and current deck):
${list(mine, 300) || '(none)'}

Return JSON only:
{"threats":[{"name":exact card name of an opponent key card,"why":string}],
 "fromCollection":[{"name":exact name from the player's list,"how":string (when to use it against this deck)}],
 "sideSuggestions":[{"name":exact real TCG card name the player does NOT have,"why":string}],
 "plan":string (2-3 sentences: game plan against this deck)}
Up to 5 threats (the cards to stop, with the chain link / timing to interrupt). "fromCollection": only cards from the player's list that really help, possibly empty.
Up to 6 sideSuggestions, legal in the current TCG banlist (hand traps, floodgates, board breakers that hit this archetype's weak points).
Write the text in ${language(lang)}, keep card names in English.`
  const p = await generate<CounterAdvice>(key, model, prompt)
  return { threats: p.threats ?? [], fromCollection: p.fromCollection ?? [], sideSuggestions: p.sideSuggestions ?? [], plan: p.plan ?? '' }
}
