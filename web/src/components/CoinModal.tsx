"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CoinContext } from "@/lib/coin-context";
import { Coin } from "@/lib/coingecko";
import type { CoinExplanation, ExplanationTier } from "@/lib/explanation";
import { trackEvent } from "@/lib/telemetry";
import { useVariant } from "@/lib/variant";

type Props = {
  coin: Coin | null;
  onClose: () => void;
  onToggleFavorite: (coin: Coin) => void;
  isFavorite: (symbol: string) => boolean;
};

const contextCache = new Map<string, CoinContext>();
const explanationCache = new Map<string, CoinExplanation>();

const TIER_TONE: Record<ExplanationTier, "calm" | "watch" | "alert"> = {
  Stable: "calm",
  "Mild move": "watch",
  "Active mover": "watch",
  "High volatility": "alert",
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
  const variant = useVariant();
  const eli5 = variant === "b";

  const cacheKey = coin ? `${coin.id}:${coin.symbol}` : null;
  const explanationKey = coin
    ? `${coin.id}:${coin.symbol}:${Math.round((coin.price_change_percentage_24h ?? 0) * 2) / 2}:${eli5 ? "eli5" : "std"}`
    : null;
  const initialContext = cacheKey ? contextCache.get(cacheKey) ?? null : null;
  const initialExplanation = explanationKey
    ? explanationCache.get(explanationKey) ?? null
    : null;
  const [context, setContext] = useState<CoinContext | null>(initialContext);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    coin ? (initialContext ? "ready" : "loading") : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<CoinExplanation | null>(
    initialExplanation,
  );
  const [explanationStatus, setExplanationStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >(coin ? (initialExplanation ? "ready" : "loading") : "idle");

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
    if (!coin || !explanationKey) return;

    const cached = explanationCache.get(explanationKey);
    if (cached) {
      // Sync external cache into component state on coin change.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExplanation(cached);
      setExplanationStatus("ready");
      return;
    }

    const controller = new AbortController();
    const startedAt = performance.now();
    setExplanationStatus("loading");

    void fetch("/api/explanation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      cache: "no-store",
      body: JSON.stringify({
        coin: {
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          current_price: coin.current_price,
          price_change_percentage_24h: coin.price_change_percentage_24h ?? 0,
          price_change_percentage_1h_in_currency:
            coin.price_change_percentage_1h_in_currency ?? null,
          price_change_percentage_7d_in_currency:
            coin.price_change_percentage_7d_in_currency ?? null,
          price_change_percentage_30d_in_currency:
            coin.price_change_percentage_30d_in_currency ?? null,
          market_cap: coin.market_cap,
          market_cap_rank: coin.market_cap_rank,
          total_volume: coin.total_volume,
          high_24h: coin.high_24h,
          low_24h: coin.low_24h,
        },
        eli5,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Explanation API failed with ${res.status}`);
        return (await res.json()) as CoinExplanation;
      })
      .then((payload) => {
        explanationCache.set(explanationKey, payload);
        setExplanation(payload);
        setExplanationStatus("ready");
        trackEvent({
          type: "ai_explanation_loaded",
          recordedAt: new Date().toISOString(),
          payload: {
            symbol: coin.symbol,
            model: payload.model,
            is_fallback: payload.isFallback,
            tier: payload.tier,
            time_ms: Math.round(performance.now() - startedAt),
            eli5,
            variant,
          },
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Explanation failed";
        setExplanationStatus("error");
        trackEvent({
          type: "ai_explanation_failed",
          recordedAt: new Date().toISOString(),
          payload: { symbol: coin.symbol, reason: message },
        });
      });

    return () => controller.abort();
  }, [coin, explanationKey, eli5, variant]);

  const stableClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!coin) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") stableClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [coin, stableClose]);

  const intradayRange = useMemo(() => {
    if (!coin?.high_24h || !coin.low_24h || coin.low_24h <= 0) {
      return null;
    }
    return ((coin.high_24h - coin.low_24h) / coin.low_24h) * 100;
  }, [coin]);

  if (!coin) return null;
  const positive = (coin.price_change_percentage_24h ?? 0) >= 0;
  const fav = isFavorite(coin.symbol);

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      {/* Click outside to close */}
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
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
              <div className="modal-subtitle">
                {coin.symbol.toUpperCase()}
              </div>
              <div className="modal-meta">
                <span className={`pill ${positive ? "green" : "red"}`}>
                  {positive ? "▲" : "▼"} {Math.abs(coin.price_change_percentage_24h ?? 0).toFixed(2)}%
                </span>
                <span>Last updated {context ? formatRelativeDate(context.lastUpdated) : "loading..."}</span>
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

        <section
          className={`context-card ai-interp-card${eli5 ? " eli5-active" : ""}`}
        >
          <div className="context-section-header">
            <div>
              <p className="section-label">AI interpretation</p>
              <h3>
                Plain-English read on the move
                {explanation && !explanation.isFallback ? (
                  <span
                    className="ai-badge"
                    title={`Generated by ${explanation.model}. The content is AI-produced from the numeric data shown below.`}
                  >
                    🪄 AI-generated
                  </span>
                ) : explanation && explanation.isFallback ? (
                  <span
                    className="ai-badge fallback"
                    title="AI model was unreachable. Showing a deterministic read computed directly from the numbers."
                  >
                    ⚙️ Numeric fallback
                  </span>
                ) : null}
              </h3>
            </div>
            {explanation ? (
              <span className={`tier-chip ${TIER_TONE[explanation.tier]}`}>
                {explanation.tier}
              </span>
            ) : null}
          </div>

          {explanationStatus === "loading" && !explanation ? (
            <div className="context-loading">
              <div className="loading-bar short" />
              <div className="loading-bar" />
              <div className="loading-bar medium" />
            </div>
          ) : explanationStatus === "error" && !explanation ? (
            <p className="context-copy muted">
              AI interpretation unavailable right now. The verified market data
              below is still usable.
            </p>
          ) : explanation ? (
            <div
              className={`ai-interp-body${
                explanationStatus === "loading" ? " is-refreshing" : ""
              }`}
              aria-busy={explanationStatus === "loading"}
            >
              <p className="context-copy">{explanation.summary}</p>

              {explanation.watchNotes.length > 0 ? (
                <ul className="watch-note-list">
                  {explanation.watchNotes.map((note) => (
                    <li key={note.label} className="watch-note">
                      <strong>{note.label}</strong>
                      <span>{note.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="trust-source-row">
                <span className="trust-chip high">
                  <span className="trust-dot" aria-hidden />
                  CoinGecko market data
                  <small>trust · high</small>
                </span>
                <a
                  className="trust-source-link"
                  href={`https://www.coingecko.com/en/coins/${coin.id}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    trackEvent({
                      type: "source_opened",
                      recordedAt: new Date().toISOString(),
                      payload: {
                        symbol: coin.symbol,
                        url: `https://www.coingecko.com/en/coins/${coin.id}`,
                        label: "CoinGecko (AI source)",
                      },
                    })
                  }
                >
                  Open source →
                </a>
              </div>
            </div>
          ) : null}
        </section>

        <div className="context-grid">
          <section className="context-card accent">
            <div className="context-section-header">
              <div>
                <p className="section-label">Why is it moving?</p>
                <h3>Guided interpretation</h3>
              </div>
              <div className="context-header-badges">
                {context?.confidence && status === "ready" ? (
                  <span className={`confidence-badge ${context.confidence}`}>
                    {context.confidence === "high" ? "High" : context.confidence === "medium" ? "Medium" : "Low"} confidence
                  </span>
                ) : null}
                <span className="context-status">
                  {status === "loading"
                    ? "Loading context"
                    : context?.isFallback
                      ? "Market-data fallback"
                      : "Curated note"}
                </span>
              </div>
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
              <p className="context-copy">{context?.summary}</p>
            )}

            <div className="risk-row">
              {(context?.riskBadges ?? []).map((badge) => (
                <div key={badge.label} className={`risk-chip ${badge.tone}`}>
                  <strong>{badge.label}</strong>
                  <span>{badge.detail}</span>
                </div>
              ))}
            </div>

            {context?.reasoning && context.reasoning.length > 0 && status === "ready" ? (
              <details className="reasoning-trace">
                <summary>How this interpretation was built</summary>
                <div className="reasoning-steps">
                  {context.reasoning.map((step) => (
                    <div key={step.signal} className="reasoning-step">
                      <div className="reasoning-signal">
                        <strong>{step.signal}</strong>
                        <span className="reasoning-value">{step.value}</span>
                      </div>
                      <p className="reasoning-interp">{step.interpretation}</p>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
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
          </div>

          <div className="evidence-list">
            {(context?.headlines ?? []).map((headline) => (
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
            ))}
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
