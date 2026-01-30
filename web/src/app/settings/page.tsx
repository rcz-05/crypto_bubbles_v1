"use client";

import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          SETTINGS
        </div>
        <div style={{ color: "var(--muted)" }}>Lightweight config for this demo</div>
        <div className="controls">
          <Link href="/" className="nav-link">
            Bubbles
          </Link>
          <Link href="/favorites" className="nav-link">
            Favorites
          </Link>
          <Link href="/settings" className="nav-link" aria-current="page">
            Settings
          </Link>
        </div>
      </header>

      <main className="page-wrap" style={{ gap: 16 }}>
        <div className="list-card">
          <div>
            <div style={{ fontWeight: 700 }}>Data Source</div>
            <div style={{ color: "var(--muted)" }}>CoinGecko markets API (top 100 by market cap)</div>
          </div>
          <Link href="https://www.coingecko.com" className="refresh-btn secondary">
            Visit
          </Link>
        </div>
        <div className="list-card">
          <div>
            <div style={{ fontWeight: 700 }}>Backend</div>
            <div style={{ color: "var(--muted)" }}>
              Favorites stored via Vercel Postgres when configured, otherwise browser localStorage.
            </div>
          </div>
        </div>
        <div className="list-card">
          <div>
            <div style={{ fontWeight: 700 }}>Shake to Refresh</div>
            <div style={{ color: "var(--muted)" }}>
              Mobile browsers with motion permission. Desktop fallback: click Refresh or press R.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
