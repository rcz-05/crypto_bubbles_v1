# CoinCanvas Mobile UX Hardening Plan

## Purpose

Move CoinCanvas from a functioning crypto PWA into a more polished, mobile-first market app. The live app at `https://coincanvas-app.vercel.app/` is working, but the experience still reads partly like a light desktop prototype around the bubble board. The next implementation pass should create a cohesive dark, Vercel-inspired product surface, improve the mobile navigation feel, smooth route transitions, and keep login/account flows obvious without changing the core bubble behavior.

This plan is written for a coding agent to implement directly.

## Current Inspection Notes

- Live production domain responds successfully:
  - `GET https://coincanvas-app.vercel.app/api/health` returns `ok: true` with production auth and KV ready.
  - `GET https://coincanvas-app.vercel.app/api/market` returns current market data.
- Production HTML shows the current app shell, manifest, PWA metadata, bottom navigation, login/register routes, and service worker path are active.
- The board itself is already dark, but the surrounding app shell, hero panels, favorites, settings, auth screens, topbar, and bottom nav are still light cream.
- `web/src/components/BubbleChart.tsx` contains the organic bubble physics, colors, medals, volatile outline, and click behavior. Do not redesign the bubble look unless a later task explicitly asks for it.
- `web/src/components/BottomNav.tsx` already provides mobile tabs: Canvas, Saved, Settings, Sign in/Account.
- `web/src/components/PageTransition.tsx` already applies route-entry slide classes, but it only knows `/`, `/favorites`, and `/settings`. Login/register routes fade instead of participating in the app flow.
- `web/src/app/globals.css` contains most of the product styling in one large file. A theme pass should be careful and token-driven so the dark mode does not become a brittle pile of per-selector overrides.
- `web/public/sw.js` honestly caches the shell and `/api/market` only. Keep auth, favorites, telemetry, context, and explanation requests uncached.

## Research Anchors

- Vercel Geist positions itself as a system for consistent web experiences and includes high-contrast colors, grid, typography, materials, tabs, buttons, pills, status dots, modals, sheets, and related product primitives: https://vercel.com/geist/introduction
- Next.js 16 has an experimental `viewTransition` config, but the docs warn it is not recommended for production yet. Use custom CSS/progressive enhancement instead of turning on the experimental flag for the deployed app: https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition
- Apple's Liquid Glass direction is based on translucent materials, dynamic controls, and navigation elements that transform to keep focus on content. Adapt the feel, not the exact proprietary style: translucent bottom chrome, a moving active tab material, press physics, and readable contrast: https://www.macrumors.com/2025/06/11/apple-updates-design-resources-ios-26/

## Product Direction

Build a dark market-console aesthetic with restrained glass materials:

- Base: near-black page background, subtle grid/noise, high contrast text, restrained green/red market accents.
- Surfaces: dark graphite panels with 1px borders, blurred/translucent top and bottom chrome, small specular highlights.
- Motion: smooth, directional, short duration, and never blocking interaction.
- Bubbles: keep the existing green/red organic bubble look and physics exactly as the visual centerpiece.
- Copy: reduce marketing-like hero language on mobile; prioritize the board and account state.

## Non-Negotiables

- Do not break Vercel production at `https://coincanvas-app.vercel.app/`.
- Do not cache auth, favorites, telemetry, explanation POSTs, or per-coin context in the service worker.
- Do not change the explanation API contract unless separately requested.
- Preserve signed-in favorites sync and guest local favorites behavior.
- Preserve `prefers-reduced-motion` support for all new motion.
- Preserve mobile safe-area handling for iOS PWA install mode.
- Preserve accessibility: visible focus, 44px minimum touch targets, legible contrast, semantic nav labels, useful form labels.

## Phase 1 - Dark Design Tokens

### Files

- `web/src/app/globals.css`
- `web/src/app/layout.tsx`
- `web/src/app/manifest.ts`
- `web/public/sw.js`

### Tasks

1. Replace the current cream root palette with dark product tokens:
   - `--bg: #050505`
   - `--bg-deep: #000000`
   - `--surface: rgba(16, 16, 18, 0.78)`
   - `--surface-strong: #101012`
   - `--surface-soft: rgba(255, 255, 255, 0.045)`
   - `--border: rgba(255, 255, 255, 0.10)`
   - `--border-strong: rgba(255, 255, 255, 0.18)`
   - `--text: #f5f5f5`
   - `--text-secondary: #a1a1aa`
   - `--muted: #71717a`
   - `--accent: #00dc82` or a similarly Vercel-like green that still fits crypto market affordances.
   - Keep `--danger` in a readable red/coral family.
2. Add reusable tokens for glass navigation:
   - `--glass-bg`
   - `--glass-border`
   - `--glass-shadow`
   - `--press-scale`
   - `--ease-ios`
3. Change `html`, `body`, `.app-shell`, `.topbar`, `.hero-panel`, `.list-card`, `.context-card`, `.metric-card`, `.auth-card`, favorites cards, settings cards, modal cards, install prompt, and inputs to the dark token system.
4. Preserve the board card and bubble SVG appearance, but integrate the board into the dark shell by reducing nested dark-on-dark contrast and avoiding a separate heavy rounded island on mobile.
5. Update `viewport.themeColor` in `web/src/app/layout.tsx` and `theme_color` / `background_color` in `web/src/app/manifest.ts` to dark values.
6. Bump service worker cache names in `web/public/sw.js` after major shell CSS/theme changes so installed PWAs pick up the dark shell reliably.

### Acceptance Criteria

- There is no cream/white app background on `/`, `/favorites`, `/settings`, `/login`, or `/register`.
- Inputs, cards, and modals remain readable in dark mode.
- The existing bubble colors and organic motion still look unchanged.
- Installed PWA status bar/theme color matches the dark app surface.

## Phase 2 - Mobile-First Canvas Layout

### Files

- `web/src/app/page.tsx`
- `web/src/app/globals.css`
- `web/src/components/BubblePager.tsx`
- `web/src/hooks/useBubblePagination.ts`

### Tasks

1. On mobile, make the board the first meaningful screen content after the topbar. The current hero grid can remain on desktop, but mobile should not make users scroll past large explanatory content before seeing bubbles.
2. Convert mobile hero content into a compact market summary strip:
   - Search input.
   - Timeframe tabs.
   - Up/down counts.
   - Last refreshed status.
3. Keep desktop layout richer if desired, but make it visually consistent with the dark theme.
4. Ensure the first paint loading state is not confusing:
   - Replace "No coins match that search" on initial empty SSR/client loading with a skeleton/loading state when `status === "loading"` or coins have not loaded yet.
   - Only show "No coins match" when coins exist and the active search filters all of them out.
5. Keep mobile board height stable:
   - Use `height: min(...)` / `calc(100dvh - chrome)` so the board fills the remaining viewport without being hidden by the bottom nav.
   - Avoid layout jumps when the market response arrives.

### Acceptance Criteria

- At 390px and 430px widths, the bubbles appear in the first viewport without needing a long scroll.
- Loading state is visually intentional and does not imply a failed search.
- Bubble pager remains reachable and does not collide with the bottom nav.

## Phase 3 - Liquid Glass Bottom Navigation

### Files

- `web/src/components/BottomNav.tsx`
- `web/src/app/globals.css`

### Tasks

1. Redesign the bottom nav as a glass dock:
   - Translucent black material.
   - Strong blur with fallback solid background.
   - Hairline border and inner highlight.
   - Rounded pill/dock shape that respects safe area.
2. Add a moving active indicator under/behind the active item:
   - Use CSS variables or a measured indicator similar to `HeaderTabs`.
   - Indicator should glide between tabs instead of each tab simply changing background.
   - The active material should feel like a soft glass capsule.
3. Add touch feedback:
   - Press scale around `0.96`.
   - Icon/text slight lift or tint.
   - Transition duration around `180ms-260ms` with a spring-like cubic-bezier.
4. Improve route semantics:
   - Keep `aria-current="page"` on active tab.
   - Keep labels visible; do not make icons-only nav unless a later design pass adds tooltips/labels elsewhere.
5. Include login/register in active account matching, and make account state clear:
   - Guest: label `Sign in`.
   - Authenticated: label `Account`.
   - Unknown/loading: avoid a flicker that makes the fourth tab disappear.

### Acceptance Criteria

- Tapping tabs feels smoother and visually connected.
- Active tab movement is animated.
- Bottom nav stays readable above the PWA home indicator and does not block primary actions.
- Reduced-motion users get instant state changes without sliding/glass animation.

## Phase 4 - Directional Route Transitions

### Files

- `web/src/components/PageTransition.tsx`
- `web/src/app/globals.css`
- Optionally add `web/src/components/AppLink.tsx` if route direction needs to be controlled by link clicks.

### Tasks

1. Expand route order to cover all primary mobile routes:
   - `/` = 0
   - `/favorites` = 1
   - `/settings` = 2
   - `/login` = 3
   - `/register` = 4
2. Make transitions match user expectation:
   - Moving from Canvas to Favorites/Settings/Login should slide in from the right.
   - Moving back toward Canvas should slide in from the left.
   - Login <-> Register can use a short lateral slide or fade-scale, but should not feel like a full app reset.
3. Current implementation only animates the incoming page. Keep it if it stays stable, but improve perceived continuity with:
   - Slight opacity fade.
   - `transform: translate3d(...)`.
   - `will-change` scoped to animation only.
4. Do not enable Next's experimental `viewTransition` production flag yet. If native View Transitions are used, make it a progressive client-side enhancement guarded by feature detection.
5. Add reduced-motion overrides for all route animation classes.

### Acceptance Criteria

- Navigating between bottom tabs clearly indicates direction.
- Login and register no longer feel detached from the route transition system.
- No hydration warnings or layout jumps are introduced.

## Phase 5 - Auth And Account UX Polish

### Files

- `web/src/components/AuthScreen.tsx`
- `web/src/components/AccountControl.tsx`
- `web/src/app/settings/page.tsx`
- `web/src/store/auth.ts`
- `web/src/store/favorites.ts`
- `web/src/app/globals.css`

### Tasks

1. Make account state visible but not noisy:
   - Topbar should show a stable account chip/skeleton instead of disappearing during auth bootstrap.
   - Settings should clearly show "Signed in" vs "Guest mode".
2. Add mobile-friendly auth refinements:
   - Password visibility toggle.
   - Clear inline error text.
   - Disable submit while pending.
   - Preserve email input after failed submit.
   - Keep `autocomplete` and `inputMode` attributes.
3. Registration should explain guest favorites migration in one short line, not a large marketing panel.
4. Favorites should communicate sync state:
   - Guest: "Saved on this device".
   - Signed in: "Synced to your account".
   - API unavailable: show a small non-blocking warning and keep local fallback behavior only where intentional.
5. If auth endpoints fail due config or network, surface a clear user-facing message instead of generic failure.

### Acceptance Criteria

- Login/register can be completed comfortably at 390px width.
- The user always understands whether favorites are local or account-synced.
- Auth loading does not cause nav or header layout flicker.

## Phase 6 - Favorites And Settings Product Cleanup

### Files

- `web/src/app/favorites/page.tsx`
- `web/src/app/settings/page.tsx`
- `web/src/app/globals.css`

### Tasks

1. Convert favorites into a compact watchlist:
   - Dense but readable cards.
   - Price, 24h change, saved time, and one-tap modal open.
   - Empty state should be concise and route back to Canvas.
2. Reduce settings from a dashboard-like page into app preferences/account diagnostics:
   - Account section first.
   - Data/source section.
   - PWA/install section if needed.
   - Diagnostics/export/clear telemetry tucked lower, not presented as primary user value.
3. Remove remaining class/prototype language if any appears in user-facing copy.
4. Keep admin operational UI separate; do not expose admin/debug framing in the consumer app.

### Acceptance Criteria

- Favorites and Settings share the same dark visual language as Canvas.
- Settings feels like a mobile app settings page, not a telemetry dashboard.
- Empty states are useful without being verbose.

## Phase 7 - Performance, PWA, And Runtime Hardening

### Files

- `web/public/sw.js`
- `web/src/components/ServiceWorkerProvider.tsx`
- `web/src/store/market.ts`
- `web/src/app/api/market/route.ts`
- `web/src/app/api/health/route.ts`

### Tasks

1. Keep the service worker cache policy honest:
   - Cache shell and market GET only.
   - Do not cache auth, favorites, telemetry, context, or explanation POSTs.
2. Consider showing "cached market snapshot" if `/api/market` comes from service worker fallback and includes `x-coincanvas-cached-at`.
3. Keep `/api/health` no-store and production-ready.
4. Avoid hydration surprises from SSR empty market data:
   - Add explicit market loading skeletons.
   - Do not render the "no results" message until market fetch resolves.
5. Check bundle size after UI additions. Do not add large animation libraries unless the custom CSS approach is insufficient.

### Acceptance Criteria

- Offline app shell still opens.
- Offline market fallback is clear if stale.
- Auth and favorites never appear to work from stale cached API responses.

## Phase 8 - Visual QA And Test Plan

### Commands

Run from the repository root:

```bash
npm run lint
npm run build
npm run check
```

Run app-specific checks if debugging:

```bash
npm --prefix web run lint
npm --prefix web run build
npm --prefix admin run lint
npm --prefix admin run build
```

### API Smoke Tests

- `GET /api/health`
- `GET /api/market`
- `POST /api/explanation`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `POST /api/auth/login`
- `GET /api/auth/me`
- Signed-in `GET /api/favorites`
- Signed-in `POST /api/favorites`
- Signed-in `DELETE /api/favorites?symbol=...`
- Guest `GET /api/favorites` should return `401`.

### UI Smoke Tests

Desktop:

- `/`
- `/favorites`
- `/settings`
- `/login`
- `/register`
- `/manifest.webmanifest`

Mobile widths:

- 390px wide.
- 430px wide.
- iPhone safe-area simulation if available.

Mobile flows:

- Open Canvas and see bubbles in first viewport.
- Change timeframe.
- Page bubbles with `BubblePager`.
- Tap a bubble and close modal.
- Favorite a coin as guest.
- Register and verify guest favorites merge into account.
- Log out and verify guest/local state is understandable.
- Log in again and verify account favorites return.
- Navigate Canvas -> Favorites -> Settings -> Login/Register and verify slide direction.
- Tap bottom nav repeatedly and verify active indicator does not desync.
- Enable reduced motion and verify no distracting route/nav animation remains.

### Deployment Verification

After implementation and push:

- Confirm Vercel production deployment is for `web/` and aliases to `https://coincanvas-app.vercel.app/`.
- Confirm `https://coincanvas-app.vercel.app/api/health` returns `ok: true`.
- Confirm `https://coincanvas-app.vercel.app/api/market` returns data.
- Confirm live HTML/theme no longer exposes the old cream first paint.
- Confirm no A/B, variant, class, sprint, or prototype UI copy is visible.

## Suggested Implementation Order

1. Tokenize and darken the visual system.
2. Rework mobile Canvas layout and loading states.
3. Upgrade bottom nav glass interaction.
4. Extend and polish route transitions.
5. Polish auth/account and sync-state copy.
6. Clean Favorites and Settings into mobile app screens.
7. Verify PWA/service worker cache behavior.
8. Run checks and mobile QA.

## Definition Of Done

- The app feels like a single dark mobile product, not a light dashboard around a dark board.
- Bubbles keep their current identity and behavior.
- Navigation feels tactile and smooth, with a clear active state.
- Route changes communicate direction.
- Login/register/account state are obvious enough for casual users.
- Favorites sync is understandable and reliable.
- Vercel production health and market APIs remain green.
- `npm run check` passes from the repo root.
