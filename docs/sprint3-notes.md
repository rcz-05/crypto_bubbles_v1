# CoinCanvas Sprint 3 Notes

## Team And Sprint Focus
- Team name: CoinCanvas
- Team members: Rayan Castilla, Maya Yuan, Anusha Bhattacharya
- Sprint 3 product focus: guided novice context inside the existing web bubble board
- Sprint 3 engineering focus: `web/` Next.js app only, with Vercel-safe deployment as a hard requirement

## Updated Team Agreement Delta
- The team remains web-first for Sprint 3 so the prototype can stay deployable on Vercel while the React Native branch remains out of scope.
- New feature work must map back to a validated Sprint 2 pain point: workflow fragmentation, missing causality, trust gaps, or novice overload.
- Sprint 3 testing requires raw event export from the app itself, so instrumentation and notebook evidence are part of the product scope rather than a side task.

## How Sprint 2 Feedback Changed The Build
- Sprint 2 narrowed the audience from broad crypto users to novice visual scanners, so the home page now tells a single 24h story instead of pretending to support multiple time windows.
- Trust concerns from Sprint 2 led to a deterministic context layer rather than free-form AI. Verified market data and interpreted guidance are visually separated in the modal.
- Latency concerns from Sprint 2 led to a cache-first `/api/context` route with a fixture-backed default path, so the deployed MVP works without any paid API or new env vars.
- The old favorites backend path relied on optional KV wiring and was a build liability; Sprint 3 simplifies this for deploy safety.

## Product Changes Implemented
- Rebrand the web MVP from a generic Crypto Bubbles clone to CoinCanvas.
- Keep the live bubble board, but replace the old stats-only modal with a guided context surface that includes:
  - a short deterministic explanation
  - evidence cards
  - visible timestamps
  - risk guardrails
  - deeper-reading links
- Add lightweight telemetry for:
  - modal opens
  - context load timing
  - fallback usage
  - source link clicks
  - favorite add/remove actions
- Add a settings export flow that downloads `coincanvas-sprint3-telemetry.json` for notebook analysis.

## Technical Architecture Summary
- Frontend: Next.js App Router in `web/src/app`
- Market data: CoinGecko market snapshot via `/api/market`
- Guided context: `/api/context?symbol=...&id=...`
- Context strategy: curated fixture notes for primary demo coins plus deterministic market-data fallback for the rest of the board
- Favorites: local-first with optional Postgres syncing; no Sprint 3 KV dependency
- Telemetry: browser local storage export for moderated usability sessions

## Data Flow
1. The home page loads the CoinGecko market snapshot and renders the bubble board.
2. The user clicks a bubble, which opens the modal and records `modal_opened`.
3. The modal requests `/api/context` for that asset.
4. The server merges current market data with a curated prototype note or a deterministic fallback explanation.
5. The client records `time_to_context_ms`, fallback usage, and source clicks.
6. Settings exports the raw JSON file for notebook use.

## Updated Value Proposition
- CoinCanvas turns fast crypto movement into beginner-readable context without forcing users to leave the board.
- The differentiated value is not deeper charting; it is faster interpretation with clearer guardrails.
- The prototype is intentionally honest about uncertainty by labeling fallback context and exposing timestamps.

## Feature Analysis Update
| Feature | User role / use case | Value | Feasibility | Novice alignment | Sprint 3 decision |
| --- | --- | --- | --- | --- | --- |
| Guided context modal | Beginner trying to interpret a mover | 5 | 5 | 5 | Core MVP |
| Evidence cards + source links | Beginner validating the explanation | 5 | 4 | 5 | Core MVP |
| Risk guardrails | Beginner avoiding blind FOMO | 4 | 5 | 5 | Core MVP |
| Favorites | Re-checking assets later | 3 | 5 | 3 | Secondary |
| Exportable telemetry | Team collecting raw test data | 4 | 4 | 4 | Core MVP support |
| Push alert radar | Fast reaction workflow | 2 | 1 | 2 | Deferred |

## Sprint 3 Testing Plan
- Primary question: does the guided context modal reduce the need to leave the app when a novice sees a mover?
- Suggested success metrics:
  - task success rate for identifying the likely driver of a move
  - average `time_to_context_ms`
  - source click-through rate
  - modal-open to context-load completion rate
  - comparison of favorite/save behavior before and after explanation review
- Raw data source: exported `coincanvas-sprint3-telemetry.json`

## Notebook Insert Checklist
- Add updated screenshots of the board and modal.
- Add one captured telemetry export file or summarized table.
- Add a storyboard note showing the tap-to-context flow.
- Add a short architecture diagram based on the data flow above.
- Add a Sprint 4 note describing the next prototype question: whether optional live news integration improves trust enough to justify the added complexity.
