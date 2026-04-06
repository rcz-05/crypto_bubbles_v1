"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { CoinContext } from "@/lib/coin-context";
import type { Coin } from "@/lib/coingecko";
import type { ExplanationResponse } from "@/lib/explanation";
import type { CoinNews } from "@/lib/news";
import { trackEvent } from "@/lib/telemetry";

type Props = {
  coin: Coin | null;
  onClose: () => void;
  onToggleFavorite: (coin: Coin) => void;
  isFavorite: (symbol: string) => boolean;
};

const contextCache = new Map<string, CoinContext>();
const newsCache = new Map<string, CoinNews>();
const explanationCache = new Map<string, ExplanationResponse>();

type EvidenceItem = {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
};

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "n/a";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatCompactCurrency(value: number | null | undefined) {
  if (value == null) return "n/a";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatRelativeDate(value: string) {
  const dt = new Date(value);
  return dt.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CoinModal({ coin, onClose, onToggleFavorite, isFavorite }: Props) {
  const cacheKey = coin ? `${coin.id}:${coin.symbol}` : null;
  const initialContext = cacheKey ? contextCache.get(cacheKey) ?? null : null;
  const initialNews = cacheKey ? newsCache.get(cacheKey) ?? null : null;
  const [context, setContext] = useState<CoinContext | null>(initialContext);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    coin ? (initialContext ? "ready" : "loading") : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [news, setNews] = useState<CoinNews | null>(initialNews);
  const [newsStatus, setNewsStatus] = useState<"idle" | "loading" | "ready" | "error">(
    coin ? (initialNews ? "ready" : "loading") : "idle",
  );
  const explanationCacheKey = useMemo(() => {
    if (!coin) return null;

    return JSON.stringify({
      id: coin.id,
      symbol: coin.symbol,
      trend: {
        price_change_percentage_24h: coin.price_change_percentage_24h ?? null,
        market_cap_rank: coin.market_cap_rank ?? null,
        total_volume: coin.total_volume ?? null,
        market_cap: coin.market_cap ?? null,
        high_24h: coin.high_24h ?? null,
        low_24h: coin.low_24h ?? null,
      },
      news: (news?.articles ?? []).map((article) => ({
        title: article.title,
        source: article.source,
        publishedAt: article.publishedAt,
        description: article.description,
        url: article.url,
      })),
      newsFetchedAt: news?.fetchedAt ?? null,
    });
  }, [coin, news]);
  const initialExplanation = explanationCacheKey
    ? explanationCache.get(explanationCacheKey) ?? null
    : null;
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(initialExplanation);
  const [explanationStatus, setExplanationStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >(coin ? (initialExplanation ? "ready" : "idle") : "idle");

  useEffect(() => {
    if (!coin || !cacheKey) return;

    const cached = contextCache.get(cacheKey);
    const startedAt = performance.now();

    if (cached) {
      trackEvent({
        type: "context_loaded",
        recordedAt: new Date().toISOString(),
        payload: {
          symbol: coin.symbol,
          time_to_context_ms: Math.round(performance.now() - startedAt),
          context_fallback_used: cached.isFallback,
          headline_count: cached.headlines.length,
        },
      });
      return;
    }

    const controller = new AbortController();

    void fetch(
      `/api/context?symbol=${encodeURIComponent(coin.symbol)}&id=${encodeURIComponent(coin.id)}`,
      {
        signal: controller.signal,
        cache: "no-store",
      },
    )
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Context API failed with ${res.status}`);
        }
        return (await res.json()) as CoinContext;
      })
      .then((payload) => {
        contextCache.set(cacheKey, payload);
        setContext(payload);
        setStatus("ready");
        trackEvent({
          type: "context_loaded",
          recordedAt: new Date().toISOString(),
          payload: {
            symbol: coin.symbol,
            time_to_context_ms: Math.round(performance.now() - startedAt),
            context_fallback_used: payload.isFallback,
            headline_count: payload.headlines.length,
          },
        });
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          fetchError instanceof Error ? fetchError.message : "Unable to load context";
        setStatus("error");
        setError(message);
        trackEvent({
          type: "context_failed",
          recordedAt: new Date().toISOString(),
          payload: { symbol: coin.symbol, reason: message },
        });
      });

    return () => controller.abort();
  }, [cacheKey, coin]);

  useEffect(() => {
    if (!coin || !cacheKey) return;

    const cached = newsCache.get(cacheKey);
    if (cached) {
      setNews(cached);
      setNewsStatus("ready");
      return;
    }

    setNews(null);
    setNewsStatus("loading");

    const controller = new AbortController();

    void fetch(
      `/api/news?symbol=${encodeURIComponent(coin.symbol)}&id=${encodeURIComponent(coin.id)}`,
      {
        signal: controller.signal,
        cache: "no-store",
      },
    )
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`News API failed with ${res.status}`);
        }
        return (await res.json()) as CoinNews;
      })
      .then((payload) => {
        newsCache.set(cacheKey, payload);
        setNews(payload);
        setNewsStatus("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setNewsStatus("error");
      });

    return () => controller.abort();
  }, [cacheKey, coin]);

  useEffect(() => {
    if (!coin || !explanationCacheKey) return;

    const cached = explanationCache.get(explanationCacheKey);
    if (cached) {
      setExplanation(cached);
      setExplanationStatus("ready");
      return;
    }

    if (newsStatus === "loading") {
      return;
    }

    setExplanation(null);
    setExplanationStatus("loading");

    const controller = new AbortController();
    const requestBody = {
      coin: {
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
      },
      trend: {
        price_change_percentage_24h: coin.price_change_percentage_24h,
        market_cap_rank: coin.market_cap_rank,
        total_volume: coin.total_volume,
        market_cap: coin.market_cap,
        high_24h: coin.high_24h,
        low_24h: coin.low_24h,
      },
      news:
        news?.articles.map((article) => ({
          title: article.title,
          source: article.source,
          publishedAt: article.publishedAt,
          summary: article.description,
          url: article.url,
        })) ?? [],
    };

    void fetch("/api/explanation", {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Explanation API failed with ${res.status}`);
        }
        return (await res.json()) as ExplanationResponse;
      })
      .then((payload) => {
        explanationCache.set(explanationCacheKey, payload);
        setExplanation(payload);
        setExplanationStatus("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setExplanationStatus("error");
      });

    return () => controller.abort();
  }, [coin, explanationCacheKey, news, newsStatus]);

  const intradayRange = useMemo(() => {
    if (!coin?.high_24h || !coin.low_24h || coin.low_24h <= 0) {
      return null;
    }
    return ((coin.high_24h - coin.low_24h) / coin.low_24h) * 100;
  }, [coin]);

  const evidenceItems = useMemo<EvidenceItem[]>(() => {
    if (news?.articles.length) {
      return news.articles.map((article) => ({
        title: article.title,
        source: article.source,
        publishedAt: article.publishedAt,
        url: article.url,
      }));
    }

    return context?.headlines ?? [];
  }, [context, news]);

  if (!coin) return null;
  const positive = (coin.price_change_percentage_24h ?? 0) >= 0;
  const fav = isFavorite(coin.symbol);
  const guidedSummary =
    explanation?.explanation ??
    context?.summary ??
    "A generated explanation is not available yet. Use the verified market data and evidence below.";
  const evidenceStatus =
    newsStatus === "ready" && news?.articles.length
      ? `Live news • ${news.provider}`
      : context
        ? "Prototype context"
        : "Loading evidence";

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div
        className="modal-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="modal-identity">
            {coin.image ? (
              <Image
                src={coin.image}
                alt={coin.symbol}
                width={56}
                height={56}
                className="coin-avatar"
              />
            ) : null}
            <div>
              <div className="modal-title">{coin.name}</div>
              <div className="modal-subtitle">{coin.symbol.toUpperCase()}</div>
              <div className="modal-meta">
                <span className={`pill ${positive ? "green" : "red"}`}>
                  {positive ? "▲" : "▼"}{" "}
                  {Math.abs(coin.price_change_percentage_24h ?? 0).toFixed(2)}%
                </span>
                <span>
                  Last updated {context ? formatRelativeDate(context.lastUpdated) : "loading..."}
                </span>
              </div>
            </div>
          </div>

          <div className="modal-header-actions">
            <button
              className={`refresh-btn ${fav ? "secondary" : ""}`}
              onClick={() => onToggleFavorite(coin)}
              type="button"
            >
              {fav ? "Saved" : "Save to favorites"}
            </button>
            <button className="refresh-btn secondary" onClick={onClose} type="button">
              Close
            </button>
          </div>
        </div>

        <div className="context-grid">
          <section className="context-card accent">
            <div className="context-section-header">
              <div>
                <p className="section-label">Why is it moving?</p>
                <h3>Guided interpretation</h3>
              </div>
              <span className="context-status">
                {explanationStatus === "loading"
                  ? "Generating explanation"
                  : explanationStatus === "ready"
                    ? "Live explanation"
                    : status === "loading"
                      ? "Loading context"
                      : context?.isFallback
                        ? "Market-data fallback"
                        : "Curated note"}
              </span>
            </div>

            {status === "loading" ? (
              <div className="context-loading">
                <div className="loading-bar short" />
                <div className="loading-bar" />
                <div className="loading-bar medium" />
              </div>
            ) : status === "error" ? (
              <p className="context-copy muted">
                {error ?? "Context failed to load."} You can still use the verified price and
                volume data below.
              </p>
            ) : (
              <p className="context-copy">{guidedSummary}</p>
            )}

            <div className="risk-row">
              {(context?.riskBadges ?? []).map((badge) => (
                <div key={badge.label} className={`risk-chip ${badge.tone}`}>
                  <strong>{badge.label}</strong>
                  <span>{badge.detail}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="context-card">
            <div className="context-section-header">
              <div>
                <p className="section-label">Verified market data</p>
                <h3>What is confirmed right now</h3>
              </div>
            </div>

            <div className="stat-grid">
              <div className="stat-cell">
                <span>Price</span>
                <strong>{formatCurrency(coin.current_price)}</strong>
              </div>
              <div className="stat-cell">
                <span>Market cap</span>
                <strong>{formatCompactCurrency(coin.market_cap)}</strong>
              </div>
              <div className="stat-cell">
                <span>24h volume</span>
                <strong>{formatCompactCurrency(coin.total_volume)}</strong>
              </div>
              <div className="stat-cell">
                <span>24h range</span>
                <strong>
                  {coin.low_24h && coin.high_24h
                    ? `${formatCurrency(coin.low_24h)} - ${formatCurrency(coin.high_24h)}`
                    : "n/a"}
                </strong>
              </div>
              <div className="stat-cell">
                <span>Range width</span>
                <strong>{intradayRange != null ? `${intradayRange.toFixed(1)}%` : "n/a"}</strong>
              </div>
              <div className="stat-cell">
                <span>Rank</span>
                <strong>{coin.market_cap_rank ? `#${coin.market_cap_rank}` : "n/a"}</strong>
              </div>
            </div>
          </section>
        </div>

        <section className="context-card">
          <div className="context-section-header">
            <div>
              <p className="section-label">Evidence in this prototype</p>
              <h3>Signals to review before acting</h3>
            </div>
            <span className="context-status">{evidenceStatus}</span>
          </div>

          <div className="evidence-list">
            {evidenceItems.length > 0 ? (
              evidenceItems.map((headline) => (
                <a
                  key={`${headline.source}-${headline.title}`}
                  className="evidence-item"
                  href={headline.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    trackEvent({
                      type: "source_opened",
                      recordedAt: new Date().toISOString(),
                      payload: {
                        symbol: coin.symbol,
                        url: headline.url,
                        label: headline.title,
                      },
                    })
                  }
                >
                  <span className="evidence-source">
                    {headline.source} • {formatRelativeDate(headline.publishedAt)}
                  </span>
                  <strong>{headline.title}</strong>
                </a>
              ))
            ) : (
              <p className="context-copy muted">
                {newsStatus === "loading"
                  ? "Loading evidence..."
                  : "No evidence is available right now."}
              </p>
            )}
          </div>
        </section>

        <section className="context-card">
          <div className="context-section-header">
            <div>
              <p className="section-label">Next step</p>
              <h3>Open a deeper source if the move still looks actionable</h3>
            </div>
          </div>

          <div className="source-link-row">
            {(context?.sourceLinks ?? []).map((link) => (
              <a
                key={link.url}
                className="source-link"
                href={link.url}
                target="_blank"
                rel="noreferrer"
                onClick={() =>
                  trackEvent({
                    type: "source_opened",
                    recordedAt: new Date().toISOString(),
                    payload: {
                      symbol: coin.symbol,
                      url: link.url,
                      label: link.label,
                    },
                  })
                }
              >
                <span>{link.label}</span>
                <small>{link.kind}</small>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
