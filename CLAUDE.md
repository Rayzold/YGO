# YGO Deck Builder — notes for Claude

- TCG only for now. Owner talks Greek; UI strings live in `src/lib/i18n.ts` (EN + EL, keep both in sync).
- Stack: Vite + React 19 + TypeScript, Supabase (auth, Postgres with RLS, Storage), GitHub Pages. No UI library.
- Supabase project: YGO, ref `zbzvfkgutcqbyznswvqs` (eu-central-1). Public URL + publishable key live in `src/lib/config.ts`.
- Card database: `public.cards` / `card_prints` / `card_data_meta`, loaded by `refresh_card_data()` from the `data` branch (pg_cron hourly). Images: Edge Function `supabase/functions/sync-card-images` + pg_cron, job-token auth (no shared secret).
- Card data is generated, not committed: `python3 pipeline/build_data.py` → `public/data/` (add `--full DIR` for the complete OCG+TCG database).
- Checks before calling work done: `npx tsc -b`, `npm test`, `python3 -m pytest pipeline/tests`, `npm run build`.
- Tagger changes: add a case to `pipeline/tests/test_tagger.py` for every rule change (both expected and not-expected tags).
- DB changes go in a new file under `supabase/migrations/` AND must be applied to the project (Supabase MCP/CLI); never weaken RLS. Users must not be able to change `profiles.plan`. Run security advisors after DDL.
- Card images: only from the Supabase bucket (re-hosted). Never hotlink YGOPRODeck.
- CSV export defaults: UTF-8 with BOM, `^` delimiter, quote fields containing the delimiter, quotes or newlines.
- Do not use Reddit or forum content as a data source without a commercial agreement.
