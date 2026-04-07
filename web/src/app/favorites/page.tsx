"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useFavoritesStore } from "@/store/favorites";

export default function FavoritesPage() {
  const { favorites, load, remove } = useFavoritesStore();

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          CoinCanvas
        </div>
        <div className="topbar-copy">Saved coins for quick re-checking during testing sessions.</div>
        <div className="controls">
          <Link href="/" className="nav-link">
            Canvas
          </Link>
          <Link href="/favorites" className="nav-link" aria-current="page">
            Favorites
          </Link>
          <Link href="/settings" className="nav-link">
            Settings
          </Link>
        </div>
      </header>

      <main className="page-wrap interior-page">
        <section className="hero-grid compact">
          <div className="hero-panel">
            <p className="hero-kicker">Secondary workflow</p>
            <h1>Keep a shortlist of coins you want to revisit.</h1>
            <p className="hero-copy">
              Favorites stay intentionally lightweight in this sprint. The core hypothesis is
              still the guided context modal inside the live board.
            </p>
          </div>
          <div className="hero-panel emphasis">
            <div className="metric-grid single">
              <div className="metric-card">
                <span className="metric-label">Saved assets</span>
                <strong>{favorites.length}</strong>
              </div>
            </div>
          </div>
        </section>

        {favorites.length === 0 ? (
          <div className="ghost">No favorites yet. Add coins from the bubble board.</div>
        ) : (
          <div className="stack">
            {favorites.map((fav) => (
              <div className="list-card" key={fav.symbol}>
                <div>
                  <div style={{ fontWeight: 700 }}>{fav.symbol.toUpperCase()}</div>
                  <div style={{ color: "var(--muted)" }}>{fav.name}</div>
                  <div className="card-meta">
                    Added {fav.added_at ? new Date(fav.added_at).toLocaleString() : "recently"}
                  </div>
                </div>
                <button className="refresh-btn secondary" onClick={() => remove(fav.symbol)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
