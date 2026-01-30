# Crypto Bubbles Web (Next.js)

Fast web clone of the Crypto Bubbles board. Built for Vercel, using CoinGecko data and optional Vercel Postgres for favorites.

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
3) (Optional) Provision Vercel Postgres. Add env vars Vercel gives you (e.g. `POSTGRES_URL`, `POSTGRES_PRISMA_URL`).  
4) Deploy. The API routes are server-side, so no CORS issues.

If Postgres is not configured, favorites still work via browser `localStorage`; the API falls back to an in-memory map.

## Features
- Bubble board sized by market cap, colored by 24h change (green/red), SVG + d3.pack layout.
- Search filter (client-side), time range tabs (visual).
- Coin modal with price + favorite toggle.
- Shake-to-refresh (DeviceMotion) plus fallback Refresh button and keyboard `R`.
- Pages: Bubbles (`/`), Favorites (`/favorites`), Settings (`/settings`).

## API
- `/api/market` – server fetch of CoinGecko top 100 markets, cached ~60s.
- `/api/favorites` – GET/POST/DELETE. Uses Vercel Postgres when env vars are present; otherwise in-memory fallback.

## Env vars (optional for Postgres)
- `POSTGRES_URL` (or other Vercel Postgres connection vars)
- No env vars are required for CoinGecko.

## Tech
- Next.js (App Router, TypeScript), d3-hierarchy, Zustand, Vercel Postgres.
