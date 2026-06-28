# Cadence build — working plan & handoff

Living plan for the multi-stream build. Source of truth for front-end = `cadence-main/`.

## Locked decisions
- **Source of truth:** `cadence-main/` (not root `Cadence.html` or `design-import/`).
- **Website gate:** public coming-soon teaser + per-client **single-use** access codes
  unlock a **$299 one-time** Stripe Checkout. Dynamic logic = **Supabase Edge Functions**.
- **Apps:** cleanup now, wire to FastAPI later. Demo data → **empty first-run by default**
  with a **demo toggle buried deep in Settings** (loads the Hale-family persona).
- **Polish scope (caretaker + clinician):** visual/UX + clinical depth + trust/compliance.
- **Gating depth:** **gate ALL placeholder content** (incl. hardcoded render demos) behind
  the demo toggle, with real empty-states. Default first-run is genuinely clean.
- **Backend↔Supabase:** website uses Supabase now; repoint FastAPI later
  (TimescaleDB hypertables don't run on vanilla Supabase — handle at wire time).
- **Stripe:** account ready (user has it). **Supabase:** user creating project, will paste keys.
- **Product image:** real render at `website/assets/product.jpg` (bands + dock).
- **Waitlist:** Formspree `mzdlgbkr` (already wired in `website/index.html`).

## Demo-toggle convention (apply identically to all 3 apps)
- localStorage flag: `cadence_demo_mode === '1'`.
- Methods on the component: `demoPatch()` (returns persona patch), `isDemo()`,
  `loadDemo()`, `clearDemo()`, `toggleDemo()`.
- On mount: `if (this.isDemo()) { this.setState(this.demoPatch()); ...load demo-only async }`.
- Buried UI: faint footer at the very bottom of Settings — "Cadence v0.9 · preview build"
  + a small underlined "Load demo data" / "Disable demo data" link → `toggleDemo`.
- All hardcoded illustrative render content (timelines, charts, dose-response, freeze
  lists, sample %s) must render only when `isDemo()`; otherwise show an empty-state.

## Status
### ✅ Phase 1 — Website + Stripe code-gate (DONE; needs user to deploy)
- `website/index.html`, `website/config.js` (PUBLIC keys placeholder), `website/assets/product.jpg`
- `supabase/migrations/0001_website_codes_orders.sql` (access_codes + orders, RLS-locked)
- `supabase/functions/{validate-code,create-checkout,stripe-webhook}` + `_shared/cors.ts`
- `supabase/scripts/mint-codes.mjs`
- `website/README-DEPLOY.md` (full setup: Supabase project → schema → functions → secrets
  → Stripe webhook → mint codes → deploy to Cloudflare Pages/Vercel free tier)

### 🟡 Stream 2 — App cleanup + polish (IN PROGRESS)
**Patient app (`Cadence.dc.html`) — most data-gating DONE; home simulation deferred:**
- ✅ Editable persona empties by default (identity, med, doses, caregivers, doctor, insight).
- ✅ Demo toggle added (methods + buried Settings footer); `loadInsight` gated to demo.
- ✅ Name/identity bound to demo-or-onboarding via `patientFullName()/patientFirstName()`
  (greeting, both avatars, account name, doctor-invite payload).
- ✅ Gated render demos behind `isDemo()` + empty-states: `timelineEvents`, `doseList`,
  `freezeList`, history chart (`historyBars`), the 74%/68% time-on stats (`timeOnPct`/
  `timeOnDelta`), quick-add dose subtitle (`quickDoseMed`), `addDose` sub, the "More"
  freeze count. Reusable `emptyCard(key,text)` helper added in renderVals.
- ✅ Brace/paren/bracket balance verified; `medName` scope confirmed before return.
- ⬜ **DEFERRED (delicate, needs Opus + browser):** the home HERO + FORECAST are driven by
  `dayModel()`/`dayCompute()` (hardcoded on/off segments, doses, freezes) and still render
  the simulation in non-demo. Proper fix = empty `dayModel()` when `!isDemo()`, guard
  `dayCompute()` against empty `segs` (avoid `segs[0]` crash, ~L1962), and add a "still
  learning your rhythm" empty-state for the hero/forecast cards.
- ⬜ Assistant chat prompt (~L1661) hardcodes "Robert"/dose context — make demo-or-real.

**Caretaker app (`Caretaker app.dc.html`) — NOT STARTED:**
- Seeded persona in state (~L599): `cgEmail: margaret@family.com`, `cgPhone`,
  `inviteHint: '374905'`, signup default name `'Margaret Hale'`.
- Apply demo-toggle convention; empty defaults; gate sample alerts/status/home content.
- Polish: visual/UX, clinical depth (adherence, off-time, freeze context), trust/compliance
  (consent language, who-can-see-what, no-location rule, disclaimers).

**Clinician app (`Neurologist Desktop app.dc.html`) — NOT STARTED:**
- Mock patient panel (~L929) + seeded state (~L703). Largest clinical-depth + trust pass.
- Apply demo-toggle convention; empty states (no patients / no data selected).

### 🟡 Stream 3 — FastAPI ↔ Supabase (SCOPE CHANGED: wire whole backend now, except ML)
- ✅ Migration `0001_initial.py` made Supabase-safe: detects absence of timescaledb
  (`pg_available_extensions`) and skips hypertable/compression DDL → sensor tables
  become plain Postgres tables. Compiles clean.
- ✅ `.gitignore` added (was missing!); `.env` created with Supabase project host +
  password placeholder; `.env.example` documents the Supabase direct-connection URI.
- ✅ `cadence-backend/SUPABASE-SETUP.md` — connect, `alembic upgrade head`, run, deploy.
- ✅ APPLIED to Supabase: ran `alembic upgrade head` → all 19 tables created, at head
  (`0003_model_registry`), seeded global model row present. Region **us-west-2**, pooler
  host `aws-1-us-west-2.pooler.supabase.com:5432` (session pooler), connection string in
  `cadence-backend/.env`. JWT secret generated + set.
- ✅ APPLIED website schema too: `access_codes` + `orders` created with RLS enabled.
- ⚠️ DB password was shared in chat → USER should rotate it (Supabase → Settings →
  Database → Reset password) and update `CADENCE_DATABASE_URL` in `.env`.
- ⬜ Deploy FastAPI (Dockerfile ready) to Render/Railway/Fly when ready.
- ⛔ ML serving (.keras/.tflite/.onnx + inference/forecast endpoints) intentionally
  deferred — user wires models later. `model_registry` table is created (metadata only).

### ⬜ Stream 4 — Freeze confirmation + personalization bars
- Backend: add `confirmed_real: bool | None` (+ maybe `confirmed_at`) to `FreezeEvent`
  in `cadence-backend/app/db/models.py`; new Alembic migration; schema in
  `app/schemas/freeze.py`; endpoint to set it.
- Patient app: during model **personalization phase**, if a freeze was logged, show a
  screen asking "was that actually a freeze?" (yes/no) → feeds personalization.
- Patient app: add **bars showing the model's personalization levels** (e.g., per-signal
  or overall confidence) — source from ModelRegistry / a personalization-progress value.

## Constraints / notes
- No JS runtime in the build env (`node`/`deno` absent) — can't lint prototypes here.
  Preview `.dc.html` files in a browser (they need `support.js` + `image-slot.js` alongside).
- `.dc.html` runtime = `support.js` (`DCLogic`, `{{ }}` bindings, `<sc-if>`/`<sc-for>`).
  Component logic lives in the trailing `<script type="text/x-dc">` block.
- Product rule: **freeze events never record location.** Keep this everywhere.
