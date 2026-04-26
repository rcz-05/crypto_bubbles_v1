"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BubbleChart } from "@/components/BubbleChart";
import { BubblePager } from "@/components/BubblePager";
import { CoinModal } from "@/components/CoinModal";
import { useMarketStore } from "@/store/market";
import { useFavoritesStore } from "@/store/favorites";
import { useBubblePagination } from "@/hooks/useBubblePagination";
import { useMeasure } from "@/hooks/useMeasure";
import { Coin, TimeFrame, getChangeForTimeFrame } from "@/lib/coingecko";
import { HeaderTabs } from "@/components/HeaderTabs";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import { PostModalSurvey, type SurveyRequest } from "@/components/PostModalSurvey";
import { trackEvent } from "@/lib/telemetry";
import { useVariant } from "@/lib/variant";

const TIME_FRAME_OPTIONS: { label: string; value: TimeFrame }[] = [
  { label: "1H", value: "1h" },
  { label: "24H", value: "24h" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "Market Cap", value: "market_cap" },
];

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export default function HomePage() {
  const { coins, status, error, fetchCoins, lastUpdated, timeFrame, setTimeFrame } = useMarketStore();
  const { favorites, load, add, remove, isFavorite } = useFavoritesStore();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Coin | null>(null);
  const [modalOpenedAt, setModalOpenedAt] = useState<number | null>(null);
  const [surveyRequest, setSurveyRequest] = useState<SurveyRequest | null>(null);
  const deferredSearch = useDeferredValue(search);
  const variant = useVariant();

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

  const {
    pagedCoins,
    page,
    totalPages,
    isMobile,
    setPage,
  } = useBubblePagination(filtered, timeFrame);

  const [slideDir, setSlideDir] = useState<"left" | "right" | "fade">("right");

  const handlePageChange = useCallback(
    (next: number) => {
      if (next === page) return;
      setSlideDir(next > page ? "right" : "left");
      trackEvent({
        type: "bubble_page_changed",
        recordedAt: new Date().toISOString(),
        payload: { from: page, to: next, timeframe: timeFrame },
      });
      setPage(next);
    },
    [page, setPage, timeFrame],
  );

  const handleSelect = useCallback((coin: Coin) => {
    setSelected(coin);
    setModalOpenedAt(Date.now());
    trackEvent({
      type: "modal_opened",
      recordedAt: new Date().toISOString(),
      payload: { symbol: coin.symbol, coinId: coin.id },
    });
  }, []);

  const handleCloseModal = useCallback(() => {
    if (selected && modalOpenedAt && Date.now() - modalOpenedAt >= 5_000) {
      setSurveyRequest({
        id: `${selected.id}-${Date.now()}`,
        symbol: selected.symbol,
        variant,
      });
    }
    setSelected(null);
    setModalOpenedAt(null);
  }, [modalOpenedAt, selected, variant]);

  const [refreshNonce, setRefreshNonce] = useState(0);

  const handleRefresh = useCallback(() => {
    setSlideDir("fade");
    setRefreshNonce((n) => n + 1);
    void fetchCoins();
  }, [fetchCoins]);

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

    const winners = coins.filter((coin) => getChangeForTimeFrame(coin, timeFrame) >= 0).length;
    const losers = coins.length - winners;
    const topWinner = [...coins].sort(
      (a, b) => getChangeForTimeFrame(b, timeFrame) - getChangeForTimeFrame(a, timeFrame),
    )[0];
    const topLoser = [...coins].sort(
      (a, b) => getChangeForTimeFrame(a, timeFrame) - getChangeForTimeFrame(b, timeFrame),
    )[0];

    return { winners, losers, topWinner, topLoser };
  }, [coins, timeFrame]);

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
            <p className="hero-kicker">Sprint 4 learning prototype</p>
            <h1>Understand a fast mover without leaving the board.</h1>
            <p className="hero-copy">
              CoinCanvas keeps the bubble scan, then adds a beginner-friendly explanation,
              evidence cards, and simple guardrails the moment curiosity hits.
            </p>
            <div className="chip-row">
              <span className="chip active">Multi-timeframe scanning</span>
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
                <span className="metric-label">Up ({timeFrame})</span>
                <strong>{marketMood.winners}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Down ({timeFrame})</span>
                <strong>{marketMood.losers}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Top winner ({timeFrame})</span>
                <strong>{marketMood.topWinner?.symbol.toUpperCase() ?? "—"}</strong>
                <span className="metric-meta">
                  {marketMood.topWinner
                    ? `${getChangeForTimeFrame(marketMood.topWinner, timeFrame).toFixed(1)}%`
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

          <div className="board-controls">
            <HeaderTabs
              options={TIME_FRAME_OPTIONS.map((o) => o.label)}
              active={TIME_FRAME_OPTIONS.find((o) => o.value === timeFrame)?.label ?? "24H"}
              onChange={(label) => {
                const match = TIME_FRAME_OPTIONS.find((o) => o.label === label);
                if (match && match.value !== timeFrame) {
                  trackEvent({
                    type: "timeframe_changed",
                    recordedAt: new Date().toISOString(),
                    payload: { from: timeFrame, to: match.value },
                  });
                  setTimeFrame(match.value);
                }
              }}
            />
            <div className="board-legend">
              <span className="board-sizing-hint">
                Bubble size = {timeFrame === "market_cap" ? "market cap rank" : `${timeFrame} movement rank`}
              </span>
              <span className="board-sizing-hint risk-legend">
                <svg width="42" height="14" viewBox="0 0 42 14" style={{ verticalAlign: "middle", marginRight: 4 }}>
                  <circle cx="7" cy="7" r="5" fill="none" stroke="#ffd700" strokeWidth="2" />
                  <circle cx="21" cy="7" r="5" fill="none" stroke="#e0e0e0" strokeWidth="2" />
                  <circle cx="35" cy="7" r="5" fill="none" stroke="#e8a04e" strokeWidth="2" />
                </svg>
                = top 3 gainers &amp; losers
              </span>
              <span className="board-sizing-hint risk-legend">
                <svg width="14" height="14" viewBox="0 0 14 14" style={{ verticalAlign: "middle", marginRight: 4 }}>
                  <circle cx="7" cy="7" r="5" fill="none" stroke="#ffab40" strokeWidth="2" strokeDasharray="3 2" />
                </svg>
                = volatile (low cap + extreme swing)
              </span>
            </div>
          </div>

          {isMobile ? (
            <BubblePager
              page={page}
              totalPages={totalPages}
              timeFrame={timeFrame}
              onChange={handlePageChange}
            />
          ) : null}

          <div ref={ref} className="board">
          {filtered.length === 0 && status !== "loading" ? (
            <div className="ghost">No coins match that search.</div>
          ) : null}

          <div
            key={`${isMobile ? `${timeFrame}-${page}` : "all"}-${refreshNonce}`}
            className={`board-content slide-from-${slideDir}`}
          >
            <BubbleChart
              data={pagedCoins}
              width={drawWidth}
              height={drawHeight}
              timeFrame={timeFrame}
              onSelect={handleSelect}
            />
          </div>

          {status === "loading" && (
            <div className="board-overlay">
              Updating prices…
            </div>
          )}
        </div>

        <div className="status-bar">
            <span>Bubble sizing: {timeFrame === "market_cap" ? "market cap rank" : `${timeFrame} movement rank`}.</span>
            <span>Context cards load on demand.</span>
            {marketMood.topLoser ? (
              <span>
                Watch {marketMood.topLoser.symbol.toUpperCase()} {getChangeForTimeFrame(marketMood.topLoser, timeFrame).toFixed(1)}%
              </span>
            ) : null}
            {error ? <span className="status-error">{error}</span> : null}
          </div>
        </section>
      </main>

      <CoinModal
        key={selected?.id ?? "empty-modal"}
        coin={selected}
        onClose={handleCloseModal}
        onToggleFavorite={toggleFavorite}
        isFavorite={isFavorite}
      />

      <PostModalSurvey
        request={surveyRequest}
        onDone={() => setSurveyRequest(null)}
      />

      <OnboardingOverlay />
    </div>
  );
}
