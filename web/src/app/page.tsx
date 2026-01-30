"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HeaderTabs } from "@/components/HeaderTabs";
import { BubbleChart } from "@/components/BubbleChart";
import { CoinModal } from "@/components/CoinModal";
import { useMarketStore } from "@/store/market";
import { useFavoritesStore } from "@/store/favorites";
import { useMeasure } from "@/hooks/useMeasure";
import { useShakeRefresh, requestMotionPermission } from "@/hooks/useShakeRefresh";
import { Coin } from "@/lib/coingecko";

const TIME_OPTIONS = ["Hour", "Day", "Week", "Month", "Year", "Market Cap & Day"];

export default function HomePage() {
  const { coins, status, error, fetchCoins, lastUpdated } = useMarketStore();
  const { favorites, load, add, remove, isFavorite } = useFavoritesStore();
  const [activeTab, setActiveTab] = useState("Day");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Coin | null>(null);
  const [motionReady, setMotionReady] = useState(false);

  const { ref, width, height } = useMeasure<HTMLDivElement>();
  const drawWidth = width || 1200;
  const drawHeight = height || 720;

  useEffect(() => {
    fetchCoins();
    load();
  }, [fetchCoins, load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return coins;
    return coins.filter(
      (c) => c.name.toLowerCase().includes(term) || c.symbol.toLowerCase().includes(term),
    );
  }, [coins, search]);

  const handleRefresh = useCallback(() => {
    fetchCoins();
  }, [fetchCoins]);

  useShakeRefresh(handleRefresh);

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

  const lastUpdatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          CRYPTO BUBBLES
        </div>
        <HeaderTabs options={TIME_OPTIONS} active={activeTab} onChange={setActiveTab} />
        <div className="controls">
          <Link href="/" className="nav-link">
            Bubbles
          </Link>
          <Link href="/favorites" className="nav-link">
            Favorites
          </Link>
          <Link href="/settings" className="nav-link">
            Settings
          </Link>
          <div className="search">
            <input
              type="text"
              placeholder="Search cryptocurrency"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="refresh-btn secondary" onClick={handleRefresh}>
            Refresh (R)
          </button>
          <button
            className="refresh-btn secondary"
            onClick={async () => setMotionReady(await requestMotionPermission())}
            style={{ opacity: motionReady ? 0.7 : 1 }}
          >
            {motionReady ? "Shake enabled" : "Enable shake"}
          </button>
        </div>
      </header>

      <main className="page-wrap">
        <div className="status-bar">
          <span className="status-dot" />
          <span>{status === "loading" ? "Loading market data..." : "Live market data"}</span>
          <span>• Last updated: {lastUpdatedLabel}</span>
          <span>• Favorites: {favorites.length}</span>
          {error && <span style={{ color: "#ff6b6b" }}>• {error}</span>}
        </div>

        <div
          ref={ref}
          className="board"
          style={{ minHeight: "70vh", border: "1px solid var(--border)" }}
        >
          {filtered.length === 0 && status !== "loading" ? (
            <div className="ghost">No coins match that search.</div>
          ) : null}
          <BubbleChart
            data={filtered}
            width={drawWidth}
            height={drawHeight}
            onSelect={setSelected}
          />
          {status === "loading" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.2)",
                color: "var(--muted)",
              }}
            >
              Fetching latest prices…
            </div>
          )}
        </div>
      </main>

      <CoinModal
        coin={selected}
        onClose={() => setSelected(null)}
        onToggleFavorite={toggleFavorite}
        isFavorite={isFavorite}
      />
    </div>
  );
}
