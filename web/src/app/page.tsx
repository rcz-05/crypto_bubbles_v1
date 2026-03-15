"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BubbleChart } from "@/components/BubbleChart";
import { CoinModal } from "@/components/CoinModal";
import { useMarketStore } from "@/store/market";
import { useFavoritesStore } from "@/store/favorites";
import { useMeasure } from "@/hooks/useMeasure";
import { useShakeRefresh, requestMotionPermission } from "@/hooks/useShakeRefresh";
import { Coin } from "@/lib/coingecko";
import { trackEvent } from "@/lib/telemetry";

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export default function HomePage() {
  const { coins, status, error, fetchCoins, lastUpdated } = useMarketStore();
  const { favorites, load, add, remove, isFavorite } = useFavoritesStore();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Coin | null>(null);
  const [motionState, setMotionState] = useState<"idle" | "enabled" | "blocked">("idle");
  const deferredSearch = useDeferredValue(search);

  const { ref, width, height } = useMeasure<HTMLDivElement>();
  const drawWidth = width || 800;
  const drawHeight = height || 600;

  useEffect(() => {
    fetchCoins();
    load();
  }, [fetchCoins, load]);

  const filtered = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return coins;
    return coins.filter(
      (c) => c.name.toLowerCase().includes(term) || c.symbol.toLowerCase().includes(term),
    );
  }, [coins, deferredSearch]);

  const handleRefresh = useCallback(() => {
    void fetchCoins();
  }, [fetchCoins]);

  useShakeRefresh(handleRefresh);

  const handleSelect = useCallback((coin: Coin) => {
    setSelected(coin);
    trackEvent({
      type: "modal_opened",
      recordedAt: new Date().toISOString(),
      payload: { symbol: coin.symbol, coinId: coin.id },
    });
  }, []);

  const handleEnableMotion = useCallback(async () => {
    const granted = await requestMotionPermission();
    setMotionState(granted ? "enabled" : "blocked");
  }, []);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "r") {
        handleRefresh();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [handleRefresh]);

  const toggleFavorite = useCallback(
    (coin: Coin) => {
      if (isFavorite(coin.symbol)) {
        remove(coin.symbol);
      } else {
        add({ symbol: coin.symbol, name: coin.name });
      }
    },
    [add, remove, isFavorite],
  );

  const marketMood = useMemo(() => {
    if (!coins.length) {
      return {
        winners: 0,
        losers: 0,
        topWinner: null as Coin | null,
        topLoser: null as Coin | null,
      };
    }

    const winners = coins.filter((coin) => (coin.price_change_percentage_24h ?? 0) >= 0).length;
    const losers = coins.length - winners;
    const topWinner = [...coins].sort(
      (a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0),
    )[0];
    const topLoser = [...coins].sort(
      (a, b) => (a.price_change_percentage_24h ?? 0) - (b.price_change_percentage_24h ?? 0),
    )[0];

    return { winners, losers, topWinner, topLoser };
  }, [coins]);

  const lastUpdatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="app-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-dot" />
          CoinCanvas
        </Link>

        <div className="controls compact">
          <Link href="/favorites" className="nav-link">
            Favorites ({favorites.length})
          </Link>
          <Link href="/settings" className="nav-link">
            Settings
          </Link>

          <button className="refresh-btn secondary" onClick={handleRefresh}>
            Refresh (R)
          </button>
        </div>
      </header>

      <main className="page-wrap home-page">
        <section className="hero-grid">
          <div className="hero-panel">
            <p className="hero-kicker">Sprint 3 learning prototype</p>
            <h1>Understand a fast mover without leaving the board.</h1>
            <p className="hero-copy">
              CoinCanvas keeps the bubble scan, then adds a beginner-friendly explanation,
              evidence cards, and simple guardrails the moment curiosity hits.
            </p>
            <div className="chip-row">
              <span className="chip active">24h movers</span>
              <span className="chip">Guided context modal</span>
              <span className="chip">No paid APIs required</span>
            </div>
          </div>

          <div className="hero-panel emphasis">
            <div className="search">
              <label className="section-label" htmlFor="coin-search">
                Search the board
              </label>
              <input
                id="coin-search"
                type="text"
                placeholder="BTC, ETH, Solana..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="metric-grid">
              <div className="metric-card">
                <span className="metric-label">Up on the day</span>
                <strong>{marketMood.winners}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Down on the day</span>
                <strong>{marketMood.losers}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Top winner</span>
                <strong>{marketMood.topWinner?.symbol.toUpperCase() ?? "—"}</strong>
                <span className="metric-meta">
                  {marketMood.topWinner
                    ? `${marketMood.topWinner.price_change_percentage_24h.toFixed(1)}%`
                    : "Loading"}
                </span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Tracked market cap</span>
                <strong>{formatCompact(coins.reduce((sum, coin) => sum + coin.market_cap, 0))}</strong>
              </div>
            </div>

            <div className="hero-actions">
              <button className="refresh-btn" onClick={handleRefresh}>
                Refresh prices
              </button>
              <button className="refresh-btn secondary" onClick={handleEnableMotion}>
                {motionState === "enabled"
                  ? "Shake ready"
                  : motionState === "blocked"
                    ? "Motion blocked"
                    : "Enable shake"}
              </button>
            </div>

            <p className="panel-note">
              The explanation layer is deterministic and clearly separated from verified
              market data so beginners can see both the signal and its limits.
            </p>
          </div>
        </section>

        <section className="board-card">
          <div className="board-header">
            <div>
              <p className="section-label">Live board</p>
              <h2>Tap any bubble to open the guided context modal.</h2>
            </div>
            <div className="board-header-meta">
              <div className="status-pill">
                <span className="status-dot" />
                {status === "loading" ? "Updating prices" : "Live market snapshot"}
              </div>
              <span className="board-time">Last refreshed {lastUpdatedLabel}</span>
            </div>
          </div>

          <div ref={ref} className="board">
          {filtered.length === 0 && status !== "loading" ? (
            <div className="ghost">No coins match that search.</div>
          ) : null}

          <BubbleChart
            data={filtered}
            width={drawWidth}
            height={drawHeight}
            onSelect={handleSelect}
          />

          {status === "loading" && (
            <div className="board-overlay">
              Updating prices…
            </div>
          )}
        </div>

        <div className="status-bar">
            <span>Focused on truthful 24h scanning only.</span>
            <span>Context cards load on demand.</span>
            {marketMood.topLoser ? (
              <span>
                Watch {marketMood.topLoser.symbol.toUpperCase()} {marketMood.topLoser.price_change_percentage_24h.toFixed(1)}%
              </span>
            ) : null}
            {error ? <span className="status-error">{error}</span> : null}
          </div>
        </section>
      </main>

      <CoinModal
        key={selected?.id ?? "empty-modal"}
        coin={selected}
        onClose={() => setSelected(null)}
        onToggleFavorite={toggleFavorite}
        isFavorite={isFavorite}
      />
    </div>
  );
}
