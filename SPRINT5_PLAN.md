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

## Development sequence (locked 2026-04-25)

> **Ordering rule**: app development first (Phases A → D), then PWA polish (Phase E), then non-code deliverables (notebook + video). Earlier P0/P1/P2 priority list has been superseded by this phase plan; original tier descriptions are preserved further down for reference.

### Why this order

1. **A before B** — Variant B of the A/B test physically requires the ELI5 toggle. Building B without A leaves it incomplete.
2. **B before C** — monetization upsell becomes its own dependent variable; we want it deployed AFTER variant routing exists so click data is automatically split A/B.
3. **C is P0, not P2** — class hard-requires monetization in code when BMC depends on it: *"Any projects who's viability depends on advertising, paid features, or in-app purchases needs to include these into the design and implementation in this Sprint."*
4. **D before E** — ops dashboard is one of the four officially-listed 2nd-platform options and provides demo-time live data. Building it before PWA gives us two viable 2nd-platform stories.
5. **E last** — PWA is polish on a complete app. Easier to install-test the finished product than re-validate PWA behavior on top of moving features.

### Phase A — quick peer-feedback wins (foundation for richer A/B test)

- [ ] **A1 — ELI5 toggle UI in CoinModal** *(addresses Kevin Lin: novices hit unknown vocabulary)*
  - Backend `/api/explanation` already accepts `eli5: boolean`; just needs UI
  - Add a toggle switch in the AI interpretation card, persist preference to localStorage
  - When toggled, refetch explanation with new prompt
  - Expand cache key to include `eli5` flag (already designed in `buildExplanationCacheKey`)
  - Telemetry: extend `ai_explanation_loaded` event to log the eli5 flag
  - Acceptance: flipping the toggle on a coin produces visibly simpler language within 2s

- [ ] **A2 — Click target cleanup** *(addresses Sankar: clickbox misfires on favorites)*
  - Audit `BubbleChart.tsx` favorite toggle: ensure click is rejected if pointer moved >threshold between mousedown and mouseup
  - Tighten hit area or add a small explicit favorite button if needed
  - Acceptance: dragging across a bubble during physics drift never adds it to favorites

- [ ] **A3 — Custom coin search + pin** *(addresses Sankar: users want coins beyond top 100)*
  - Use CoinGecko `/api/v3/coins/list` (cached server-side) for autocomplete
  - On select, fetch single-coin market data via `/api/v3/coins/{id}/market_chart` or single-coin endpoint
  - Pinned coins persist in localStorage, render in the bubble chart alongside the top 100
  - New backend route `/api/coin-search?q=…` to proxy CoinGecko search (avoids CORS + throttling)
  - Acceptance: search "matic" → find Polygon → pin → it appears in the bubble view as a legitimate bubble

### Phase B — real A/B test infrastructure (TA's biggest critique)

- [ ] **B1 — Variant assignment**
  - New `lib/variant.ts` module: deterministic A/B split from session ID (already in localStorage as `coincanvas-session-id`)
  - 50/50 hash bucketing
  - Read once at app boot, cache in module-scope; pass to all components needing it
  - Telemetry event `variant_assigned` once per session

- [ ] **B2 — Variant A treatment (control)**
  - Bare LLM summary in the AI interpretation card: hide the AI-generated badge, hide the trust chip, hide the ELI5 toggle
  - Keep watch-notes (otherwise treatments diverge in content depth, not framing)
  - Same backend, same model, same data — only the framing UI is different

- [ ] **B3 — Variant B treatment (treatment)**
  - Full rich AI card: LLM summary + AI-generated badge + trust chip + ELI5 toggle + watch-notes
  - This is the current production state plus the A1 toggle

- [ ] **B4 — In-app micro-survey on coin close**
  - When the modal closes after >5s of viewing, show a small, dismissible 2-question prompt:
    1. "How clear was this explanation?" (😕 / 🙂 / 🎯 → 0/1/2)
    2. "How much did you trust it?" (1–5 stars)
  - Skippable, non-blocking
  - Telemetry: `comprehension_rated` and `trust_rated` events with variant + symbol + value

- [ ] **B5 — Variant override URL flag**
  - `?variant=a` / `?variant=b` query param overrides the assignment for the session
  - Lets us demo both variants live during the teaching-team meeting

### Phase C — monetization implementation (class hard requirement)

- [ ] **C1 — Pick + scaffold the gated feature: "Pro insights"**
  - Free users see the current AI card
  - Pro users would see a deeper card with: 7d/30d narrative, cross-coin pattern context, suggested follow-up reading
  - For Sprint 5: build the locked-state UI only — the deeper card is Wizard-of-Oz (real implementation deferred post-Sprint 5)
  - Locked-state UI shows a blurred preview + 🔒 "Unlock Pro insights — $2/mo" button

- [ ] **C2 — Intent capture flow**
  - Clicking the upsell opens a modal: "Pro is in beta — join the waitlist"
  - Optional email field (skippable)
  - Telemetry: `premium_intent_clicked` (variant, coin, source location), `premium_waitlist_submitted` (with email if provided)
  - **Wizard-of-Oz disclosure**: modal explicitly says "Pro features aren't built yet — your interest helps us prioritize"

- [ ] **C3 — Premium prompt on Settings page**
  - One discoverable card on `/settings` describing the planned Pro tier
  - Same waitlist CTA

### Phase D — operations dashboard (2nd-platform candidate + insurance)

- [ ] **D1 — `/admin` route with shared-secret gate**
  - Query-param gate: `/admin?key=<value>` matched against `ADMIN_KEY` env var on Vercel
  - 401 page on missing/bad key
  - Not real auth — adequate for class demo; clearly labeled as such

- [ ] **D2 — Live A/B distribution panel**
  - Reads telemetry exports from Vercel KV (`KV_REST_API_*` already configured) or aggregates from a new `/api/telemetry-export` route
  - Shows: variant A count, variant B count, comprehension averages per variant, trust averages per variant

- [ ] **D3 — Fallback rate per coin**
  - Aggregates `ai_explanation_loaded` events: % `is_fallback: true` per coin
  - Sorted descending so we can see which coins lean on deterministic fallback

- [ ] **D4 — Premium intent funnel**
  - Counts: card-views → upsell-clicks → waitlist-submits
  - Per-variant breakdown so we know if Variant B drives more conversion

- [ ] **D5 — Recent telemetry stream**
  - Last 50 events, expandable JSON
  - Demo: shows live backend operation in real time

### Phase E — PWA polish (LAST — runs after Phases A–D land)

- [ ] **E1 — Complete `manifest.ts`**
  - Icons (192px, 512px) — generated from existing favicon
  - Theme + background color matched to app's dark charcoal
  - `display: "standalone"`, `start_url: "/"`, `scope: "/"`
  - Categories, description, name + short_name

- [ ] **E2 — Service worker for offline shell**
  - Cache the app shell (HTML, CSS, JS) on first visit
  - Cache last-good `/api/market` response with 24h max-age fallback
  - Cache `/api/explanation` responses keyed by their existing cache key
  - Cold launch on phone with no network: app shell loads, last-known bubble layout renders, AI card shows cached explanation if present, otherwise graceful "offline" state

- [ ] **E3 — iOS install meta tags**
  - `apple-touch-icon` + `apple-mobile-web-app-capable` + `apple-mobile-web-app-status-bar-style`
  - Custom splash screens for iPhone sizes

- [ ] **E4 — Phone hotspot install verification**
  - iOS Safari "Add to Home Screen" → launches as standalone
  - Android Chrome "Install app" → launches as standalone
  - Confirm offline cold-launch behavior on real device

### After Phase E — non-code deliverables (notebook + video)

Tracked in the **Sprint 5 notebook checklist** section below. Not started until Phase E ships.

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

### Historical reference: original P0/P1/P2 priority list (superseded 2026-04-25)

The earlier tier list has been folded into Phases A–E:
- P0.1 PWA polish → **Phase E**
- P0.2 A/B test redesign → **Phase B**
- P0.3 Scale user testing → **post-dev** (Maya/team task, not in code phase)
- P0.4 Notebook fixes → **post-dev** (notebook checklist below)
- P1.0 LLM engine → ✅ already shipped (sub-plan kept below as historical record)
- P1.1 Per-source trust tags → initial done in P1.0; expansion deferred (Phase A doesn't need it)
- P1.2 AI-generated badge → ✅ shipped in P1.0
- P1.3 ELI5 toggle → **Phase A1**
- P1.4 Custom coin → **Phase A3**
- P1.5 Click target cleanup → **Phase A2**
- P2.1 Freemium wall → **Phase C** (promoted to P0 by class requirement)
- P2.2 Ops dashboard → **Phase D** (promoted to first-class deliverable)

## Explicitly out of scope

- React Native rebuild (professor-approved swap)
- Buying a new custom domain (NRD-sinkholed through the demo window — phone hotspot is the demo plan)
- Rewriting A/B backend — still routed through existing `main` vs `llm` branches; Variant B is just richer UI on the LLM branch

## Demo storyline (rehearsed end-to-end flow, after all phases land)

1. Open `coincanvas-app.vercel.app` on phone (hotspot active) — or launch installed PWA from home screen (Phase E)
2. Browse bubbles, tap a mover → see Variant B's rich AI card (Phase A1 + Phase B3)
3. Toggle ELI5 → language simplifies (Phase A1)
4. Tap "🔒 Unlock Pro insights" → waitlist modal, Wizard-of-Oz labeled (Phase C1, C2)
5. Search and pin a small-cap coin not in top 100 (Phase A3)
6. Close modal → 2-question micro-survey appears, capture comprehension + trust (Phase B4)
7. Switch to laptop → open `/admin?key=…` → live data: A/B distribution, comprehension scores, premium intent funnel, fallback rates per coin (Phase D)
8. Hand the demo team a `?variant=a` link to show the control treatment side-by-side (Phase B5)

Hits every Sprint 5 rubric line: end-to-end, real services, real data, A/B test infrastructure, monetization in code, two front-end platforms (PWA + ops dashboard).

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
| 2026-04-25 | Plan re-sequenced: Phase A → E (UX wins → A/B infra → monetization → ops dashboard → PWA), notebook + video deferred to post-dev | ✅ |
