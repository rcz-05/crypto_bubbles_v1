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
  // const [motionReady, setMotionReady] = useState(false); // Unused for now


  // Default dimensions
  const { ref, width, height } = useMeasure<HTMLDivElement>();
  // Use slightly smaller default to avoid scrollbars before measure
  const drawWidth = width || 800;
  const drawHeight = height || 600;

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
          <div className="search">
            <input
              type="text"
              placeholder="Search coin..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Link href="/favorites" className="nav-link">
            Favorites ({favorites.length})
          </Link>
          <Link href="/settings" className="nav-link">
            Settings
          </Link>

          <button className="refresh-btn secondary" onClick={handleRefresh}>
            Refresh (R)
          </button>

          {/* Mobile Shake Hint (Hidden for now or just text) */}
          <div className="shake-hint" style={{ display: "none" }}>Shake to refresh</div>
        </div>
      </header>

      <main className="page-wrap">
        <div
          ref={ref}
          className="board"
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
                background: "rgba(0,0,0,0.4)",
                color: "var(--text)",
                zIndex: 10,
                backdropFilter: "blur(2px)"
              }}
            >
              Updating prices…
            </div>
          )}
        </div>

        <div className="status-bar">
          <span className="status-dot" />
          <span>{status === "loading" ? "Updating..." : "Live"}</span>
          <span style={{ opacity: 0.5 }}>|</span>
          <span>{lastUpdatedLabel}</span>
          {error && <span style={{ color: "var(--danger)" }}>• {error}</span>}
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
