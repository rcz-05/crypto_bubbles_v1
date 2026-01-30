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
          FAVORITES
        </div>
        <div style={{ color: "var(--muted)" }}>Saved coins across devices (public demo)</div>
        <div className="controls">
          <Link href="/" className="nav-link">
            Bubbles
          </Link>
          <Link href="/favorites" className="nav-link" aria-current="page">
            Favorites
          </Link>
          <Link href="/settings" className="nav-link">
            Settings
          </Link>
        </div>
      </header>

      <main className="page-wrap">
        {favorites.length === 0 ? (
          <div className="ghost">No favorites yet. Add coins from the bubble board.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {favorites.map((fav) => (
              <div className="list-card" key={fav.symbol}>
                <div>
                  <div style={{ fontWeight: 700 }}>{fav.symbol.toUpperCase()}</div>
                  <div style={{ color: "var(--muted)" }}>{fav.name}</div>
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
