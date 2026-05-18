"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CoinModal } from "@/components/CoinModal";
import { AccountControl } from "@/components/AccountControl";
import type { Coin } from "@/lib/coingecko";
import { useFavoritesStore } from "@/store/favorites";
import { useMarketStore } from "@/store/market";
import { useAuthStore } from "@/store/auth";
import { trackEvent } from "@/lib/telemetry";

type SortKey = "added" | "gainer" | "loser" | "alpha";

type EnrichedFavorite = {
  symbol: string;
  name: string;
  added_at?: string;
  coin: Coin | null;
};

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 4,
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function relativeTime(iso?: string) {
  if (!iso) return "recently";
  const dt = new Date(iso).getTime();
  if (Number.isNaN(dt)) return "recently";
  const diffMs = Date.now() - dt;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function FavoritesPage() {
  const { favorites, load, remove, add, isFavorite } = useFavoritesStore();
  const favMode = useFavoritesStore((s) => s.mode);
  const authStatus = useAuthStore((s) => s.status);
  const { coins, fetchCoins } = useMarketStore();
  const [sort, setSort] = useState<SortKey>("added");
  const [selected, setSelected] = useState<Coin | null>(null);

  const syncState =
    authStatus === "authenticated" || favMode === "user"
      ? { cls: "account", label: "Synced to your account" }
      : { cls: "", label: "Saved on this device" };

  useEffect(() => {
    load();
    if (coins.length === 0) void fetchCoins();
  }, [load, fetchCoins, coins.length]);

  const enriched: EnrichedFavorite[] = useMemo(() => {
    const bySymbol = new Map<string, Coin>();
    for (const c of coins) bySymbol.set(c.symbol.toLowerCase(), c);
    return favorites.map((fav) => ({
      symbol: fav.symbol,
      name: fav.name,
      added_at: fav.added_at,
      coin: bySymbol.get(fav.symbol.toLowerCase()) ?? null,
    }));
  }, [favorites, coins]);

  const sorted = useMemo(() => {
    const items = [...enriched];
    items.sort((a, b) => {
      const aChange = a.coin?.price_change_percentage_24h ?? null;
      const bChange = b.coin?.price_change_percentage_24h ?? null;
      switch (sort) {
        case "gainer":
          return (bChange ?? -Infinity) - (aChange ?? -Infinity);
        case "loser":
          return (aChange ?? Infinity) - (bChange ?? Infinity);
        case "alpha":
          return a.symbol.localeCompare(b.symbol);
        case "added":
        default: {
          const aTime = a.added_at ? new Date(a.added_at).getTime() : 0;
          const bTime = b.added_at ? new Date(b.added_at).getTime() : 0;
          return bTime - aTime;
        }
      }
    });
    return items;
  }, [enriched, sort]);

  const summary = useMemo(() => {
    const live = enriched.filter((f) => f.coin);
    const upCount = live.filter(
      (f) => (f.coin?.price_change_percentage_24h ?? 0) > 0,
    ).length;
    const downCount = live.filter(
      (f) => (f.coin?.price_change_percentage_24h ?? 0) < 0,
    ).length;
    const flatCount = live.length - upCount - downCount;
    let topMover: EnrichedFavorite | null = null;
    let topAbs = -Infinity;
    for (const f of live) {
      const c = Math.abs(f.coin?.price_change_percentage_24h ?? 0);
      if (c > topAbs) {
        topAbs = c;
        topMover = f;
      }
    }
    const avgChange =
      live.length > 0
        ? live.reduce(
            (acc, f) => acc + (f.coin?.price_change_percentage_24h ?? 0),
            0,
          ) / live.length
        : null;
    return { upCount, downCount, flatCount, topMover, avgChange };
  }, [enriched]);

  const handleOpen = useCallback((item: EnrichedFavorite) => {
    if (!item.coin) return;
    setSelected(item.coin);
    trackEvent({
      type: "favorite_opened",
      recordedAt: new Date().toISOString(),
      payload: { symbol: item.symbol, source: "favorites_page" },
    });
  }, []);

  const handleCloseModal = () => {
    setSelected(null);
  };

  const handleRemove = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    void remove(symbol);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          CoinCanvas
        </div>
        <div className="topbar-copy">
          Your saved coins, with live data and the same AI interpretation a tap away.
        </div>
        <div className="controls">
          <AccountControl />
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
        <section className="favorites-summary">
          <div className="favorites-summary-headline">
            <p className="favorites-kicker">Your shortlist</p>
            <h1>
              {favorites.length === 0
                ? "Nothing saved yet."
                : favorites.length === 1
                  ? "1 coin you're tracking."
                  : `${favorites.length} coins you're tracking.`}
            </h1>
            <span className={`sync-state ${syncState.cls}`}>
              <span className="sync-dot" />
              {syncState.label}
            </span>
          </div>

          {favorites.length > 0 ? (
            <div className="favorites-stats">
              <div className="favorites-stat up">
                <span className="favorites-stat-label">Up 24h</span>
                <strong>{summary.upCount}</strong>
              </div>
              <div className="favorites-stat down">
                <span className="favorites-stat-label">Down 24h</span>
                <strong>{summary.downCount}</strong>
              </div>
              {summary.flatCount > 0 ? (
                <div className="favorites-stat neutral">
                  <span className="favorites-stat-label">Flat</span>
                  <strong>{summary.flatCount}</strong>
                </div>
              ) : null}
              <div className="favorites-stat avg">
                <span className="favorites-stat-label">Avg change</span>
                <strong>{formatPercent(summary.avgChange)}</strong>
              </div>
              {summary.topMover && summary.topMover.coin ? (
                <div className="favorites-stat top-mover">
                  <span className="favorites-stat-label">Biggest mover</span>
                  <strong>
                    {summary.topMover.symbol.toUpperCase()}{" "}
                    {formatPercent(
                      summary.topMover.coin.price_change_percentage_24h,
                    )}
                  </strong>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {favorites.length === 0 ? (
          <div className="favorites-empty">
            <h2>Save coins as you scan the board.</h2>
            <p>
              Tap any coin on the canvas, then hit <em>Save to favorites</em>. They land here with
              live prices and the same AI take you saw in the modal.
            </p>
            <Link href="/" className="favorites-empty-cta">
              Open the canvas →
            </Link>
          </div>
        ) : (
          <>
            <div className="favorites-toolbar">
              <label className="favorites-sort">
                <span>Sort by</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                >
                  <option value="added">Recently added</option>
                  <option value="gainer">Biggest gainer</option>
                  <option value="loser">Biggest loser</option>
                  <option value="alpha">Alphabetical</option>
                </select>
              </label>
              <p className="favorites-toolbar-hint">
                {coins.length === 0
                  ? "Loading live data…"
                  : "Live prices, refreshed each visit."}
              </p>
            </div>

            <ul className="favorites-grid" style={{ listStyle: "none" }}>
              {sorted.map((item, idx) => {
                const change = item.coin?.price_change_percentage_24h ?? null;
                const tone =
                  change == null
                    ? "stale"
                    : change >= 0.05
                      ? "up"
                      : change <= -0.05
                        ? "down"
                        : "flat";
                const stripeWidth =
                  change == null
                    ? 3
                    : Math.min(8, 3 + Math.abs(change) * 0.25);

                return (
                  <li
                    key={item.symbol}
                    className={`favorite-card tone-${tone}`}
                    style={{
                      // staggered fade-in
                      animationDelay: `${Math.min(idx, 12) * 35}ms`,
                      // dynamic stripe thickness via custom prop
                      ["--stripe-width" as string]: `${stripeWidth}px`,
                    }}
                  >
                    <button
                      className="favorite-card-body"
                      type="button"
                      onClick={() => handleOpen(item)}
                      disabled={!item.coin}
                      aria-label={`Open ${item.name} details`}
                    >
                      <span className="favorite-stripe" aria-hidden />

                      <span className="favorite-identity">
                        {item.coin?.image ? (
                          <Image
                            src={item.coin.image}
                            alt=""
                            width={36}
                            height={36}
                            className="favorite-icon"
                          />
                        ) : (
                          <span className="favorite-icon-placeholder">
                            {item.symbol.slice(0, 3).toUpperCase()}
                          </span>
                        )}
                        <span className="favorite-names">
                          <span className="favorite-symbol">
                            {item.symbol.toUpperCase()}
                          </span>
                          <span className="favorite-name">{item.name}</span>
                        </span>
                      </span>

                      <span className="favorite-numbers">
                        <span className="favorite-price">
                          {item.coin
                            ? formatCurrency(item.coin.current_price)
                            : "Live data unavailable"}
                        </span>
                        <span className={`favorite-change ${tone}`}>
                          {item.coin
                            ? `${change != null && change >= 0 ? "▲" : "▼"} ${formatPercent(change)}`
                            : "outside top 100"}
                        </span>
                      </span>

                      <span className="favorite-meta">
                        Saved {relativeTime(item.added_at)}
                        {item.coin
                          ? null
                          : (
                            <span
                              className="favorite-stale-badge"
                              title="This coin isn't in the current top-100 market snapshot. Live data will reappear if it returns to that range."
                            >
                              stale
                            </span>
                          )}
                      </span>

                      <span className="favorite-cta" aria-hidden>
                        See AI take →
                      </span>
                    </button>

                    <button
                      className="favorite-remove"
                      type="button"
                      onClick={(e) => handleRemove(e, item.symbol)}
                      aria-label={`Remove ${item.name} from favorites`}
                      title="Remove from favorites"
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>

      <CoinModal
        coin={selected}
        onClose={handleCloseModal}
        onToggleFavorite={(coin) => {
          if (isFavorite(coin.symbol)) {
            void remove(coin.symbol);
          } else {
            void add({ symbol: coin.symbol, name: coin.name });
          }
        }}
        isFavorite={isFavorite}
      />
    </div>
  );
}
