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
  ├─ pipeline/build_data.py   YAML Yugi cards + TCG banlist (Konami EU) ─► tagger ─► public/data/{cards,texts}.json
  ├─ npm test / npm run build ─► GitHub Pages (static React app)
  └─ pipeline/sync_images.py  missing card images ─► Supabase Storage (public bucket)

browser
  ├─ search, rules, suggestions: all client-side on the static JSON
  └─ Supabase: auth (magic link), decks, collection (Row Level Security)
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

## Going live (one-time setup)

1. **Supabase**: create a project. In *SQL Editor* run `supabase/migrations/20261108000000_init.sql` (tables, Row Level Security, the `card-images` bucket).
2. **Supabase Auth** → *URL Configuration*: set Site URL to `https://rayzold.github.io/YGO/` and add it to Redirect URLs.
3. **GitHub** → repo *Settings* → *Pages*: Source = **GitHub Actions**.
4. **GitHub** → *Settings* → *Secrets and variables* → *Actions*:
   - Variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (both public), `DEPLOY_PAGES=true`, `SYNC_IMAGES=true`
   - Secret: `SUPABASE_SERVICE_ROLE_KEY` (only used by the image job — never put it in the app)
5. Run the *Build & deploy* workflow (Actions tab → Run workflow). Images are fetched gently (4/s, 1,500 per run), so the full set fills in over the first nights.

## Data, images and legal

- Card text and images are © KONAMI / 4K Media Inc. This project is not affiliated with or endorsed by Konami. A disclaimer is shown in the app footer.
- Card data: [YAML Yugi](https://github.com/DawnbrandBots/yaml-yugi). Only the published data files are downloaded; none of its (AGPL) code is used.
- Card images: [YGOPRODeck](https://ygoprodeck.com/api-guide/), downloaded once and re-hosted as their API guide asks (no hotlinking).
- Community sources such as Reddit are **not** used: their API terms require a separate agreement for commercial use.

## Roadmap

- Usage statistics from opted-in user decks (`decks.share_for_stats`) to rank Side Deck and staple suggestions
- Premium features (`profiles.plan`): price of missing cards (Cardmarket), AI combo explanations, opening-hand probabilities
- Stripe billing via a Supabase Edge Function
