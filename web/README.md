# CoinCanvas Web

Mobile-first crypto market scanner for Vercel. CoinCanvas combines a bubble board, saved coins, account-backed favorites, and plain-English explanations grounded in CoinGecko market data.

## Quickstart (local)

```bash
cd web
npm install
npm run dev
# visit http://localhost:3000
```

## Deploy to Vercel

1) Push this repo and create a new Vercel project.  
2) In project settings set **Root Directory** to `web`.  
3) Provision Vercel Postgres for production account storage. Add env vars Vercel gives you, such as `POSTGRES_URL` or `POSTGRES_PRISMA_URL`.  
4) Set `AUTH_SECRET` to a random value with at least 32 characters.  
5) Deploy. The API routes are server-side, so no CORS issues.

Local development can run without Postgres or `AUTH_SECRET`; the app uses a process-local fallback. Production account APIs return `503` until persistent account storage and `AUTH_SECRET` are configured.

## Features
- Bubble board with 1h, 24h, 7d, 30d, and market-cap views.
- Plain-English coin modal with verified market data, explanation fallback, evidence links, and favorite toggle.
- Guest favorites stay in local storage; signed-in favorites sync to the account database.
- PWA shell and last market response caching.
- Pages: Canvas (`/`), Favorites (`/favorites`), Settings (`/settings`), Login (`/login`), Register (`/register`).

## API
- `/api/market` – server fetch of CoinGecko top 100 markets, cached ~60s.
- `/api/explanation` – POST plain-English market explanation with deterministic fallback.
- `/api/auth/*` – register, login, logout, and session check.
- `/api/favorites` – GET/POST/DELETE signed-in account favorites.
- `/api/health` – production readiness for auth, database, and telemetry config.

## Env Vars
- `POSTGRES_URL` or other Vercel Postgres connection vars for production accounts.
- `AUTH_SECRET` with at least 32 characters for signed session cookies.
- `GEMINI_API_KEY` for model explanations; deterministic fallback is used when absent.
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` for telemetry forwarding to the ops app.

## Tech
- Next.js (App Router, TypeScript), d3-hierarchy, Zustand, Vercel Postgres.
