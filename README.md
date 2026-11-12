# YGO Deck Builder

A Yu-Gi-Oh! **TCG** deck builder that knows the current Forbidden & Limited List, tracks the cards you own, and suggests cards that work with your deck — and explains why.

- **Deck editor** with the official TCG rules: 40–60 Main, up to 15 Extra and 15 Side, max 3 copies, Forbidden / Limited / Semi-Limited — plus a warning when an announced list will change a card you play.
- **Card search** by name, text, type, attribute, level, archetype, banlist status and *mechanic* (e.g. "sends from Deck to GY", "effect when sent to GY", "hand trap").
- **Suggestions** for Main, Extra and Side Deck, each with its reasons (archetype, mechanic synergy, Extra Deck monsters your Levels/Tuners can make). Can be limited to cards you own.
- **Collection**: import CSV (comma, semicolon, tab or `^`), `.ydk`, or plain "3 Card Name" lists; export CSV (UTF-8 with BOM); see what you are missing for a deck.
- `.ydk` import/export (EDOPro, YGOPRODeck, etc.).
- English and Greek UI.
- Works without an account (saved in the browser); with Supabase configured, email sign-in syncs decks and collection across devices.

## How it works

```
nightly GitHub Action
  ├─ pipeline/build_data.py   YAML Yugi cards + TCG/OCG banlists (Konami) ─► tagger
  │     ├─ public/data/{cards,texts}.json   TCG cards for the static app
  │     └─ `data` branch                    complete OCG+TCG database (cards, prints, meta)
  └─ npm test / npm run build ─► GitHub Pages (static React app)

Supabase project "YGO" (Frankfurt)
  ├─ public.cards, card_prints, card_data_meta   loaded from the `data` branch by refresh_card_data() (pg_cron, hourly check)
  ├─ Storage bucket card-images                  filled by the sync-card-images Edge Function (pg_cron, every 2 min while images are missing)
  └─ auth (magic link), decks, collection, profiles (Row Level Security)

browser
  ├─ search, rules, suggestions: all client-side on the static JSON
  └─ Supabase: card images, sign-in, deck/collection sync
```

## Card database

Every Yu-Gi-Oh! OCG/TCG card is in Supabase (about 14,400 cards, 86,000 TCG/OCG prints) and in the repo's
[`data` branch](https://github.com/Rayzold/YGO/tree/data) as JSON. Both refresh automatically.

| Table | What |
|---|---|
| `cards` | One row per card. `id` = password (what `.ydk` uses; brand-new cards without one get `-konami_id`). Names in 11 languages (`names`), English text, stats, `series` (archetypes), mechanic `tags`, `tcg`/`ocg` flags, `tcg_limit`/`ocg_limit` (0 Forbidden … 3 Unlimited) and `*_next_limit` for announced lists. Full-text (`fts`) and fuzzy name (trigram) indexes. |
| `card_prints` | English (TCG) and Japanese (OCG) prints: set number, set name, rarity. |
| `card_images` | Image sync status. Image URL: `https://zbzvfkgutcqbyznswvqs.supabase.co/storage/v1/object/public/card-images/<id>.jpg` |
| `card_data_meta` | Build time, banlist dates, counts. |

All four are readable with the publishable key and not writable through the API.

```ts
// all TCG hand traps that are not Forbidden
const { data } = await supabase.from('cards')
  .select('id,name,tcg_limit').eq('tcg', true).contains('tags', ['hand_trap']).gt('tcg_limit', 0)
```
```sql
-- fuzzy name search / text search
select name from cards order by similarity(name, 'ash blosom') desc limit 5;
select name from cards where fts @@ websearch_to_tsquery('english', 'send graveyard draw');
-- force a reload (SQL editor)
select refresh_card_data(true);
```

- **Mechanic tags** (`pipeline/tagger.py`) are regex rules over the official English card text. They mark what a card *does* (`search`, `mill`, `ss_from_gy`, `negate`…) and *when* it acts (`trig_sent_to_gy`, `gy_effect`, `trig_summoned`…). The suggestion engine (`src/lib/suggest.ts`) pairs providers with hooks, e.g. a deck full of "if sent to the GY" cards gets mill cards suggested.
- **Banlist** comes from Konami's European site via [YAML Yugi Limit Regulations](https://github.com/DawnbrandBots/yaml-yugi-limit-regulation), so dates match the EU list. Announced lists are picked up as soon as they appear upstream.

## Development

```bash
npm install
python3 pipeline/build_data.py   # downloads ~100 MB of source data, writes public/data/
npm run dev                      # http://localhost:5173
npm test                         # Vitest (uses public/data when present)
python3 -m pytest pipeline/tests # pipeline tests (set YGO_CARDS=/path/to/cards.json for the full gold set)
```

Copy `.env.example` to `.env.local` to point the dev server at Supabase.

## Going live

Already done: Supabase project **YGO** (`zbzvfkgutcqbyznswvqs`, Frankfurt) with all migrations in `supabase/migrations/`
applied, the card database loaded, the `sync-card-images` Edge Function deployed and both cron jobs running. The app's
Supabase URL and publishable key are in `src/lib/config.ts` (public by design; RLS protects the data).

Still to do (dashboard only):

1. **Supabase** → *Authentication* → *URL Configuration*: Site URL `https://rayzold.github.io/YGO/`, and add it to Redirect URLs (needed for the sign-in email link).
2. **GitHub** → repo *Settings* → *Pages*: Source = **GitHub Actions**.
3. **GitHub** → *Settings* → *Secrets and variables* → *Actions* → *Variables*: `DEPLOY_PAGES=true`, then run *Build & deploy*.

No secrets are needed in GitHub: the database pulls the card data, and the Edge Function uses the project's own keys.

## Data, images and legal

- Card text and images are © KONAMI / 4K Media Inc. This project is not affiliated with or endorsed by Konami. A disclaimer is shown in the app footer.
- Card data: [YAML Yugi](https://github.com/DawnbrandBots/yaml-yugi). Only the published data files are downloaded; none of its (AGPL) code is used.
- Card images: [YGOPRODeck](https://ygoprodeck.com/api-guide/), downloaded once (about 2–3 per second) and re-hosted in Supabase Storage as their API guide asks (no hotlinking).
- Community sources such as Reddit are **not** used: their API terms require a separate agreement for commercial use.

## Roadmap

- Usage statistics from opted-in user decks (`decks.share_for_stats`) to rank Side Deck and staple suggestions
- Premium features (`profiles.plan`): price of missing cards (Cardmarket), AI combo explanations, opening-hand probabilities
- Stripe billing via a Supabase Edge Function
