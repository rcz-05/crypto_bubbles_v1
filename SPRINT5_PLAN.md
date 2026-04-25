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

- [x] **A1 — ELI5 toggle UI in CoinModal** ✅ shipped to prod 2026-04-25
  - Segmented two-option pill ("Standard" | "Plain English") with sliding indigo thumb (cubic-bezier 280ms)
  - Card shifts to a warm amber tint when ELI5 is on — embodied "softer reading lamp" mode
  - During refetch on toggle, old content stays visible at 55% opacity with a "Re-reading…" pill, no skeleton tear-down
  - Preference persists via `coincanvas-eli5-pref` localStorage key (lazy useState initializer, no hydration mismatch)
  - Component cache key extended with eli5 flag → std + eli5 cache independently per coin
  - Telemetry: new `eli5_toggled` event; `ai_explanation_loaded` payload now includes the eli5 flag for Phase B variant analysis
  - prefers-reduced-motion respected; mobile breakpoint reflows the toggle row
  - Verified on prod: ELI5=true on ETH → "Ethereum's price went down by a small amount today. This is after it had gone up over the last week and month." vs standard analyst framing

- [x] **A2 — Click target cleanup + Favorites dashboard rewrite** ✅ shipped to prod 2026-04-25
  - **A2.1 click guard**: BubbleChart now tracks pointerdown coords on the SVG via `onPointerDownCapture`; `handleBubbleClick` rejects clicks where the pointer moved >6px between down and up — kills drift-induced accidental modal opens that Sankar flagged
  - **A2.3 favorites redesign** (scope expanded from "loose end" to "make the page actually useful per user direction"):
    - Replaced passive memo list with a personal dashboard
    - Header summary strip: count, up/down/flat, average 24h change, biggest mover
    - Sort control: recently added / biggest gainer / biggest loser / alphabetical
    - Card grid with live data joined from `useMarketStore`: coin icon, symbol, name, live price, 24h change pill, edge stripe colored + sized by change magnitude, "Saved Xh ago" meta, hover-revealed remove button (✕) and "See AI take →" CTA
    - Tap a card → opens the SAME `CoinModal` from the bubble board (full AI interpretation, ELI5 toggle, evidence drawer, trust chip)
    - Stale-favorite handling: coins outside top-100 show "stale" badge with disabled tap (Phase A3 custom-coin search will resolve fully)
    - Empty state with clear CTA back to canvas
    - Staggered fade-in, hover lift, prefers-reduced-motion respected, mobile-responsive
  - New telemetry event `favorite_opened` with `source` field (`favorites_page` vs future `bubble_board`)
  - Build + lint + TS clean, prod regression checked on `/api/explanation`

- [~] **A3 — Custom coin search + pin** ⏸ **deferred** 2026-04-25 (decision rationale below)
  - **Rationale for deferral**: A3 only addresses one peer comment (Sankar) and isn't on any TA grade lever. Even the simple version is ~2 hours. That time is better spent on Phase B (TA's biggest critique), Phase C (class-required monetization), Phase D (2nd platform option), or Phase E (PWA, the hard 2nd-platform requirement). If we hit the demo with B–E shipped clean, we can come back and add A3 in 2 hours; if we don't, A3 wouldn't have moved the grade anyway.
  - **If we revisit**: simple version is one backend search route (CoinGecko `/search` proxy), one market-data-by-ids route, a small autocomplete component, and persisting the picked coin to favorites so it joins the bubble board automatically.
  - **The "stale · outside top 100" badge on the favorites page stays as the visible artifact of this deferral** until A3 is done.

### Phase B — real A/B test infrastructure (TA's biggest critique)

**Test hypothesis (single variable)**: *"For novice users, presenting the AI explanation in plain-English language (vs. analyst-style standard language) materially improves comprehension while at least maintaining trust ratings."*

**Why this hypothesis is the right one for Sprint 5**:
- TA: comparisons must be *equivalent* — both variants must have the AI explanation card. Only ONE element differs.
- Krissh / Aditya: isolate the variable; Sprint 4's Variant B bundled too many changes.
- Kevin Lin: novices hit unknown vocabulary — directly testable with this hypothesis.
- We already shipped both prompts (A1 ELI5) so the implementation is ready; the A/B is a routing layer on top.

**Variant design (locked, single isolated variable = language framing)**:

| Element | Variant A — Standard | Variant B — Plain English |
|---|---|---|
| AI explanation card | shown | shown |
| Backend prompt | `eli5: false` (forced) | `eli5: true` (forced) |
| AI-generated badge | shown | shown |
| Trust chip (CoinGecko, high) | shown | shown |
| Tier chip | shown | shown |
| Watch-notes | shown | shown |
| ELI5 toggle | **hidden** (locked into assignment) | **hidden** (locked into assignment) |
| Card warm tint | off | on (existing `.eli5-active` class) |
| Evidence drawer / market data / favorites flow | identical | identical |

The ONLY thing that varies between A and B is the language style of the LLM-generated text + the visual cue (warm tint) that signals which mode is active. Same data, same model, same UI elements, same flow. This is the cleanest single-variable test we can run.

- [x] **B1 — Variant assignment** ✅ shipped 2026-04-25
  - New `web/src/lib/variant.ts` module
  - Deterministic 50/50 hash bucketing from the existing `coincanvas-session-id` (sessionStorage)
  - Module-scope cache so all components see the same variant within a session
  - Variant resolved exactly once per session, persisted to sessionStorage as `coincanvas-variant`
  - Telemetry: fires `variant_assigned` once per session with the chosen variant

- [x] **B2 — Variant override URL flag** ✅ shipped 2026-04-25
  - `?variant=a` / `?variant=b` query param overrides the assignment for the current session
  - Persisted to sessionStorage so the override survives navigation
  - Telemetry: fires `variant_overridden` so analysis can filter overrides out of real test data
  - Used during the teaching-team demo to show both variants back-to-back

- [x] **B3 — Variant-aware CoinModal** ✅ shipped 2026-04-25
  - Read variant via `useVariant()` hook
  - Hide the ELI5 toggle entirely (toggle is now a variant choice, not a user choice)
  - Force the `eli5` flag in the `/api/explanation` POST body to `variant === "b"` (regardless of user's old localStorage pref — which we silently ignore for the duration of the test)
  - Apply `.eli5-active` warm tint when variant === "b"
  - Telemetry: extend `ai_explanation_loaded` payload with `variant: "a" | "b"` field

- [x] **B4 — Post-modal micro-survey** ✅ shipped 2026-04-25
  - New component `web/src/components/PostModalSurvey.tsx`
  - Triggered when the CoinModal closes after >5s of being open
  - Rate-limited: at most one survey per 5-min window per session
  - Two questions:
    1. "How clear was that explanation?" → 😕 Vague (0) / 🙂 OK (1) / 🎯 Clear (2)
    2. "How much do you trust it?" → 1–5 stars
  - Auto-dismisses after 30s of inactivity
  - Skippable via X button or pressing Escape
  - Telemetry events:
    - `comprehension_rated` { variant, symbol, value }
    - `trust_rated` { variant, symbol, value }
    - `survey_shown` { variant, symbol }
    - `survey_dismissed` { variant, symbol, reason: "skip" | "timeout" }
  - Mounts at the page root level (so it's available from both `/` and `/favorites`)

- [x] **B5 — Surface variant in the existing telemetry export** ✅ verified 2026-04-25
  - Settings page already has a "Download telemetry" button
  - Confirm export now includes `variant` field on relevant events so Maya can split A/B in the analysis spreadsheet
  - No new code; just verification

**Implementation order**:
1. B1 + B2 together (lib/variant.ts is a single small module)
2. B3 (CoinModal changes — small diff: hide toggle, force flag, add tint when B)
3. B4 (PostModalSurvey component — biggest UI lift)
4. B5 (verification only)

**Acceptance criteria for Phase B**:
- Hitting `/` returns variant A or B deterministically per session
- `?variant=a` / `?variant=b` correctly forces the variant
- Variant A renders standard-language explanation; Variant B renders plain-English with warm tint; ELI5 toggle is invisible in both
- Closing a modal after >5s shows the survey; ratings record `variant` correctly
- `/settings` telemetry export contains rows tagged with the variant
- TS + ESLint + `npm run build` clean
- Preview deploy verified, fast-forward merge to main, prod alias re-attached, no regressions on existing flows

**Risk register**:
- *Hidden ELI5 toggle confuses returning users*: short test window (~1-2 weeks), then we can decide whether to restore the toggle for production after the test concludes. Notebook will document this clearly.
- *Survey is annoying mid-test*: 5-min rate limit + 30s auto-dismiss + Esc dismissal makes it skippable
- *Variant assignment instability across sessions*: deterministic per session ID, not per user — that's expected and acceptable for a small test cohort
- *Demo overrides leak into production data*: telemetry tags overrides separately so analysis can filter them

### Phase C — monetization implementation (class hard requirement)

- [x] **C1 — Pick + scaffold the gated feature: "Pro insights"** ✅ shipped 2026-04-25
  - Free users see the current AI card
  - Pro users would see a deeper card with: 7d/30d narrative, cross-coin pattern context, suggested follow-up reading
  - For Sprint 5: build the locked-state UI only — the deeper card is Wizard-of-Oz (real implementation deferred post-Sprint 5)
  - Locked-state UI shows a blurred preview + 🔒 "Unlock Pro insights — $2/mo" button

- [x] **C2 — Intent capture flow** ✅ shipped 2026-04-25
  - Clicking the upsell opens a modal: "Pro is in beta — join the waitlist"
  - Optional email field (skippable)
  - Telemetry: `premium_intent_clicked` (variant, coin, source location), `premium_waitlist_submitted` (with email if provided)
  - **Wizard-of-Oz disclosure**: modal explicitly says "Pro features aren't built yet — your interest helps us prioritize"

- [x] **C3 — Premium prompt on Settings page** ✅ shipped 2026-04-25
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
3. Use `?variant=a` and `?variant=b` demo links to show standard vs plain-English language framing side-by-side (Phase B)
4. Tap "🔒 Unlock Pro insights" → waitlist modal, Wizard-of-Oz labeled (Phase C1, C2)
5. Open Favorites dashboard to show the saved-coin path uses the same modal and survey flow (Phase A2 + Phase B4)
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
| 2026-04-25 | Phase A1: ELI5 toggle shipped to prod (segmented pill + warm tint + refresh state, localStorage persistence, telemetry) | ✅ |
| 2026-04-25 | Phase A2: BubbleChart click threshold (6px drag-vs-click guard) + favorites page rewritten as a live, modal-launching dashboard with summary stats, sort, edge-stripe cards, stale handling, telemetry | ✅ |
| 2026-04-25 | A3 deferred — peer-feedback nicety, no grade lever; revisit only if B–E ship clean with time to spare | ⏸ |
| 2026-04-25 | Phase B sub-plan locked: single-variable A/B (standard vs plain-English language), 4 B-items + telemetry verification | ✅ |
| 2026-04-25 | Pre-Phase-B: sharpened both system prompts so the variants are sharply differentiated (Standard now uses pro-trader vocabulary: drawdown / turnover ratio / distribution / capitulation; ELI5 explicitly bans 17+ jargon terms and forces dollar-translation of percentages). Verified on prod with ETH and SOL — A/B contrast is now production-grade. | ✅ |
| 2026-04-25 | Phase B shipped: deterministic session variant assignment, `?variant=a/b` override, CoinModal locked to assigned language style, ELI5 toggle hidden during test, post-close comprehension/trust survey mounted on canvas + favorites, variant included in telemetry export | ✅ |
| 2026-04-25 | Phase C shipped: Pro insights locked preview in CoinModal, reusable beta waitlist modal with Wizard-of-Oz disclosure, Settings Pro card, premium intent + waitlist telemetry | ✅ |
