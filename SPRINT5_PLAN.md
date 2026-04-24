# Sprint 5 Plan — CoinCanvas

Living document. Update checkboxes as items ship. Keep in sync with the notebook submission.

## Context snapshot

- **MVP**: `coincanvas-app.vercel.app` (healthy; GT network DNS-sinkholes it — demo on phone hotspot, dev on `localhost`).
- **2nd-platform approach**: **PWA installed to home screen** (professor-approved alternative to React Native).
- **Deadline**: Sprint 5 demo slot scheduled with teaching team during end-of-semester / final-exam window. Submission allowed up to 48h before demo slot.
- **Team**: Rayan (implementation), Maya (testing/interviews), Anusha (BMC/design/docs).

## What we're responding to

### TA feedback on Sprint 4 (graded — highest priority)
1. A/B methodology was flawed — "nothing vs something" comparisons aren't equivalent. Need isolated-variable testing.
2. Participant count too low (N=4) — scale up.
3. BMC was not color-coded (requirement; we lost points).
4. Video narrative was weak + too many zoom transitions.
5. No explicit user-flow diagram — screenshots alone weren't enough.

### Peer feedback worth keeping
- **Elias**: continue exposing reasoning/"why"; source links are trust anchors.
- **Jacob Rainbow**: monetization lacks user-demand evidence; tighten "novice" user definition.
- **Kevin Lin**: trust rating didn't move; novices hit unfamiliar vocabulary; want per-source trust ratings and explicit "AI-generated" labels.
- **Sankar**: clickbox accidentally toggles favorites; users want to add custom coins beyond top 100.
- **Krissh / Aditya**: isolate which sub-feature drove the Sprint 4 gain; scale N.

## Scope, tiered

### P0 — grade-critical, must ship

- [ ] **P0.1 PWA polish (our 2nd platform)**
  - Complete `manifest.ts` — icons (192/512), theme/background color, display `standalone`, start_url, scope
  - Service worker — offline app shell + cache last-good `/api/market` snapshot so cold launch works without network
  - iOS `apple-touch-icon` + `apple-mobile-web-app-*` meta tags
  - Verify: installs cleanly on iOS Safari and Android Chrome, launches as standalone, works offline after first load
- [ ] **P0.2 Redo A/B test with equivalent variants**
  - **Variant A**: current LLM summary baseline
  - **Variant B**: LLM summary **+ per-source trust tags + "AI-generated" badge + ELI5 language toggle**
  - Isolates *framing quality*, not feature presence/absence. Addresses TA methodology critique + Krissh's "isolate the variable" note.
- [ ] **P0.3 Scale user testing**
  - Target N = 10–12 participants, balanced across novice / intermediate
  - Keep the 0–2 comprehension rubric and 1–5 trust scale from Sprint 4 so we can compare longitudinally
- [ ] **P0.4 Notebook fixes**
  - Color-coded BMC (users vs customers differentiated)
  - Explicit user-flow diagram (Figma or draw.io → PNG)
  - Feature analysis table (ranked, with ranking methodology explained)
  - 3-min product video, narrative framing ("Maya is a novice…" style arc), minimal zoom
  - Updated team agreement if processes changed this sprint

### P1 — high-leverage implementation (also becomes Variant B of the A/B test)

- [x] **P1.0 LLM explanation engine** ✅ shipped to prod 2026-04-24 — per-coin AI-generated summary using CoinGecko data only. Foundation for P1.1–P1.3. See sub-plan below.
- [ ] **P1.1 Per-source trust tags** — heuristic tier (high / medium / low) based on source domain; visible chip on each citation in the evidence drawer
- [ ] **P1.2 "AI-generated" badge** — explicit label on the summary block so users know what's LLM output vs. verified data
- [ ] **P1.3 ELI5 / novice language toggle** — second system prompt that forces plain wording and avoids jargon; user-flippable switch
- [ ] **P1.4 Add custom coin** — search + pin for coins beyond top 100
- [ ] **P1.5 Click target cleanup** — verify favorite toggle doesn't misfire on drag/drift (Sankar's complaint)

#### Sub-plan: P1.0 LLM explanation engine

**Goal**: per-coin LLM-generated summary + movement tier + watch-notes, using only CoinGecko trend data (no external news APIs). Rendered in CoinModal with an "AI-generated" badge and trust-tagged source chips pointing to CoinGecko fields.

**Why not merge Maya's `testing` branch**: 31 commits behind main, CoinModal heavily diverged, uses `@openrouter/sdk` (likely broken on Next 16), tests written against Sprint 3 code would mostly fail. Selective graft via fresh branch is safer.

**Provider**: Google **Gemini 2.5 Flash** via direct REST fetch (no SDK). Free tier confirmed working on our project. Fallback chain in code: `gemini-2.5-flash` → `gemini-flash-latest` → `gemini-2.5-flash-lite`. Key obtained from [aistudio.google.com](https://aistudio.google.com).

> **Note**: We originally planned `gemini-2.0-flash`, but Google set the free-tier quota to `limit: 0` for 2.0 Flash on projects created after the 2.5 release. 2.5 Flash is the current generation and works cleanly on our key.

**Safety principles**:
1. All work on `feat/llm-integration` branch — `main` never touched until preview deploy is verified.
2. Feature is additive. If LLM fails/times out/rate-limits, route returns `200` with deterministic fallback — UI never breaks.
3. Env-var gated. Missing `GEMINI_API_KEY` → route short-circuits to fallback. Safe to merge before secret is set.
4. In-memory cache keyed by `(coin_id, trend_bucket)`, 10-min TTL. Same pattern Maya used.
5. Preview deploy → phone-hotspot QA → only then merge to main. Vercel `rollback` available as instant revert.

**Phases**:

- [x] **P1.0-Phase 0 — Provision Gemini API key** ✅ done 2026-04-24
  - Key obtained from Google AI Studio (Gemini API project `793804761691`)
  - Added to Vercel `coincanvas-app` project for Production, Preview, Development (encrypted)
  - Pulled to `web/.env.local` (gitignored — confirmed)
  - Round-trip tested: `gemini-2.5-flash` returns clean responses
- [x] **P1.0-Phase 1 — Backend route** ✅ done 2026-04-24
  - Branch `feat/llm-integration` created off `main`, 2 commits ahead
  - `web/src/lib/explanation.ts` (230+ lines): Gemini REST call, model fallback chain (`gemini-2.5-flash` → `gemini-flash-latest` → `gemini-2.5-flash-lite`), structured JSON output via `responseSchema`, thinking disabled (`thinkingBudget: 0`), 12s timeout per model, deterministic numeric fallback returning same shape
  - `web/src/app/api/explanation/route.ts`: POST endpoint, 10-min cache keyed by `(coin_id, bucketed trend, eli5 flag)`, 256-entry cap, always returns 200 with either LLM or fallback
  - Smoke tests passed: BTC (-3.2%) → Active mover, SOL (+4.8%) → Mild move, USDT (+0.05%) → Stable, DOGE (+18.4%) → High volatility + ELI5, PEPE (+42.1%) → High volatility. Primary model ~1.6s, cache hit 6ms.
  - Validation: invalid JSON → 400, missing fields → 400 with specific field name
  - **No existing files touched — zero risk to main site**
- [x] **P1.0-Phase 2 — CoinModal UI integration** ✅ done 2026-04-24
  - New full-width "AI interpretation" card above the existing grid, not replacing anything
  - Renders LLM summary + tier chip (Stable/Mild/Active/High volatility) + watch-notes list + 🪄 AI-generated badge + ⚙️ Numeric fallback badge variant + trust-tagged CoinGecko source chip + external-open link
  - Two new telemetry events: `ai_explanation_loaded` (model, tier, is_fallback, time_ms) and `ai_explanation_failed`
  - Per-coin in-memory cache in component (bucketed 24h change) for instant re-open
  - Full graceful fallback path when `isFallback: true` or fetch errors
  - BubbleChart, HeaderTabs, OnboardingOverlay, deterministic /api/context all untouched
  - TypeScript + ESLint + `npm run build` all clean
- [x] **P1.0-Phase 3 — Vercel preview deploy QA** ✅ done 2026-04-24
  - Preview URL `coincanvas-app-git-feat-llm-integration-rcz-05s-projects.vercel.app` built in 27s
  - Smoke tests: BTC (Mild move, 1.8s), USDT (Stable, 1.9s), PEPE (High volatility, 1.5s), cache hit 95ms — all on primary `gemini-2.5-flash`
  - Homepage returns 200, existing scan flow unaffected
- [x] **P1.0-Phase 4 — Merge to main + prod smoke test** ✅ done 2026-04-24
  - Fast-forward merge (clean linear history, 4 commits: docs + engine + UI + plan update)
  - Vercel prod deploy `coincanvas-eggy738zs` built in 23s, Ready
  - Had to manually re-attach the `coincanvas-app.vercel.app` alias (Vercel doesn't auto-promote the custom subdomain alias — known quirk from our earlier rename)
  - Prod API smoke test: ETH (Stable, -1.8%), SOL (Mild move, +4.8%) — `gemini-2.5-flash` primary, ~1.8s latency, `source=llm` in response headers
  - Homepage HTTP 200 on direct deploy URL + via primary domain (on unfiltered networks)
- [x] **P1.0-Phase 5 — Cleanup** ✅ done 2026-04-24
  - Local branch `feat/llm-integration` deleted post-merge; remote kept for audit trail
  - Maya's `testing` branch to be credited in Sprint 5 notebook Code Review section: "LLM scaffolding prototype from Maya's testing branch informed the final design — we grafted the concept (CoinGecko-driven per-coin AI summary) and redesigned the implementation for Next.js 16 + Gemini 2.5 Flash, dropping external news providers and the OpenRouter SDK to reduce failure modes."

**Scope decisions locked**:
- Pure CoinGecko data only, no external news APIs (simpler, zero extra keys, no provider failures mid-demo)
- Direct `fetch` to Gemini REST, no npm SDK (zero dep-tree risk)
- Not porting Maya's `Tests/` directory in this phase (Sprint-3-era, mostly broken against Sprint 4 components). Revisit post-demo.

### P2 — strengthen monetization + ops story

- [ ] **P2.1 Freemium wall + intent capture** — gate one premium feature behind "$2/mo" button that logs the *click*; no Stripe needed. Click-through = proxy for willingness-to-pay data. Addresses Jacob's critique.
- [ ] **P2.2 Operations dashboard (`/admin`)** — live A/B variant assignments, comprehension scores, fallback rate per coin, session counts. Bonus 2nd-platform option if graders push back on PWA.

## Explicitly out of scope

- React Native rebuild (professor-approved swap)
- Buying a new custom domain (NRD-sinkholed through the demo window — phone hotspot is the demo plan)
- Rewriting A/B backend — still routed through existing `main` vs `llm` branches; Variant B is just richer UI on the LLM branch

## Demo storyline (rehearsed end-to-end flow)

1. Open `coincanvas-app.vercel.app` on phone (hotspot active)
2. Tap "Add to Home Screen" → installed PWA icon
3. Launch standalone, browse bubbles, tap a mover
4. Show layered explanation: trust-tagged sources, AI-generated badge, ELI5 toggle
5. Pin a coin beyond top 100 via custom add
6. Switch to laptop → open `/admin` dashboard → show live Sprint 5 cohort data
7. Wrap: end-to-end real services, no emulators/localhost, meets every Sprint 5 rubric line

## Sprint 5 notebook checklist (per class requirements)

- [ ] Team name + members
- [ ] Updated team agreement
- [ ] References to Sprint 3 feedback usage + cohort discussions
- [ ] Updated problem-space understanding
- [ ] Product name (still CoinCanvas unless we pivot)
- [ ] 3-min product video link
- [ ] Code review / repo link with structure walk-through
- [ ] Prototype screenshots
- [ ] What was built + testing methodology + data + A/B results
- [ ] Learnings from user testing, research, interviews
- [ ] Technical discussion + architecture diagram
- [ ] Value proposition + **color-coded** BMC
- [ ] Feature analysis table (ranked, with methodology)
- [ ] Future direction if continuing to MVP

## Status log

| Date | Item | Status |
|------|------|--------|
| 2026-04-24 | Sprint 5 plan drafted | ✅ |
| 2026-04-24 | P1.0 LLM engine sub-plan locked (Gemini 2.5 Flash, selective graft from Maya's branch) | ✅ |
| 2026-04-24 | P1.0-Phase 0: Gemini key provisioned in Vercel (Prod/Preview/Dev) + pulled to .env.local + round-trip verified | ✅ |
| 2026-04-24 | P1.0-Phase 1: LLM explanation engine + API route committed to feat/llm-integration (2 commits, 5 coin types smoke-tested, ~1.6s primary latency) | ✅ |
| 2026-04-24 | P1.0-Phase 2: CoinModal AI interpretation card + telemetry events + CSS — build/lint clean | ✅ |
| 2026-04-24 | P1.0-Phase 3: preview deploy verified (BTC/USDT/PEPE all classified correctly on primary model) | ✅ |
| 2026-04-24 | P1.0-Phase 4: fast-forward merge to main, prod deploy live, coincanvas-app.vercel.app alias re-attached, smoke-tested | ✅ |
| 2026-04-24 | P1.0-Phase 5: local branch cleaned up, Maya credit note drafted for notebook | ✅ |
