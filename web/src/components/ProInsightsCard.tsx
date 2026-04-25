"use client";

import { useEffect, useState } from "react";
import type { CoinDetailPayload } from "@/app/api/coin-detail/route";
import type { Coin } from "@/lib/coingecko";
import type { PeerBenchmark, VolatilityProfile } from "@/lib/peer-benchmark";
import type { ProNarrative } from "@/lib/pro-explanation";
import { trackEvent } from "@/lib/telemetry";

type Props = {
  coin: Coin;
};

type ProPayload = {
  narrative: ProNarrative;
  benchmark: PeerBenchmark;
  volatility: VolatilityProfile;
};

const proCache = new Map<string, ProPayload>();
const detailCache = new Map<string, CoinDetailPayload>();

function fmtCompactNumber(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function fmtPct(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function fmtPts(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0) return "flat";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)} pts`;
}

export function ProInsightsCard({ coin }: Props) {
  const cacheKey = `${coin.id}:${Math.round((coin.price_change_percentage_24h ?? 0) * 2) / 2}`;
  const cached = proCache.get(cacheKey) ?? null;
  const [payload, setPayload] = useState<ProPayload | null>(cached);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    cached ? "ready" : "loading",
  );
  const detailCached = detailCache.get(coin.id) ?? null;
  const [detail, setDetail] = useState<CoinDetailPayload | null>(detailCached);

  useEffect(() => {
    if (detailCached) {
      // Sync external cache into component state when coin changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetail(detailCached);
      return;
    }
    const controller = new AbortController();
    void fetch(`/api/coin-detail?id=${encodeURIComponent(coin.id)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((res) => (res.ok ? (res.json() as Promise<CoinDetailPayload>) : null))
      .then((next) => {
        if (!next) return;
        detailCache.set(coin.id, next);
        setDetail(next);
      })
      .catch(() => {
        // silent — section 4 just won't render
      });
    return () => controller.abort();
  }, [coin.id, detailCached]);

  useEffect(() => {
    if (cached) {
      // Sync external cache into component state when coin changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPayload(cached);
      setStatus("ready");
      return;
    }

    const controller = new AbortController();
    const startedAt = performance.now();
    setStatus("loading");

    void fetch("/api/pro-explanation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({ coinId: coin.id, symbol: coin.symbol }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Pro API failed with ${res.status}`);
        return (await res.json()) as ProPayload;
      })
      .then((next) => {
        proCache.set(cacheKey, next);
        setPayload(next);
        setStatus("ready");
        trackEvent({
          type: "pro_explanation_loaded",
          recordedAt: new Date().toISOString(),
          payload: {
            symbol: coin.symbol,
            model: next.narrative.model,
            is_fallback: next.narrative.isFallback,
            time_ms: Math.round(performance.now() - startedAt),
          },
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const reason = err instanceof Error ? err.message : "Pro fetch failed";
        setStatus("error");
        trackEvent({
          type: "pro_explanation_failed",
          recordedAt: new Date().toISOString(),
          payload: { symbol: coin.symbol, reason },
        });
      });

    return () => controller.abort();
  }, [cacheKey, cached, coin.id, coin.symbol]);

  return (
    <section
      className="context-card pro-active-card"
      aria-labelledby="pro-active-title"
    >
      <div className="context-section-header">
        <div>
          <p className="section-label">Pro insights · unlocked</p>
          <h3 id="pro-active-title">
            Multi-horizon read + peer benchmark
            <span className="ai-badge pro" title="Analyst-style Pro tier read">
              ★ Pro
            </span>
            {payload?.narrative.isFallback ? (
              <span
                className="ai-badge fallback"
                title="LLM unavailable — deterministic synthesis from numbers."
              >
                ⚙️ Numeric fallback
              </span>
            ) : null}
          </h3>
        </div>
      </div>

      {status === "loading" && !payload ? (
        <div className="context-loading">
          <div className="loading-bar short" />
          <div className="loading-bar" />
          <div className="loading-bar medium" />
        </div>
      ) : status === "error" && !payload ? (
        <p className="context-copy muted">
          Pro analytics unavailable right now — retrying in a moment.
        </p>
      ) : payload ? (
        <div className="pro-active-body">
          <div className="pro-narrative">
            <p className="pro-narrative-headline">{payload.narrative.headline}</p>
            <p className="context-copy">{payload.narrative.multiHorizon}</p>
            <p className="context-copy">{payload.narrative.positioning}</p>
          </div>

          <div className="pro-section-divider" />

          <div className="pro-section">
            <p className="section-label">Peer benchmark · {payload.benchmark.cohortLabel}</p>
            <div className="pro-peer-grid">
              <div className="pro-peer-row pro-peer-self">
                <span>{coin.symbol.toUpperCase()}</span>
                <strong>{fmtPct(coin.price_change_percentage_24h)} 24h</strong>
                <small>{fmtPct(coin.price_change_percentage_7d_in_currency)} 7d</small>
              </div>
              {payload.benchmark.peers.map((p) => (
                <div key={p.symbol} className="pro-peer-row">
                  <span>{p.symbol}</span>
                  <strong>{fmtPct(p.change24h)} 24h</strong>
                  <small>{fmtPct(p.change7d)} 7d</small>
                </div>
              ))}
            </div>
            <div className="pro-peer-summary">
              <div>
                <span>Cohort avg 24h</span>
                <strong>{fmtPct(payload.benchmark.peerAvg24h)}</strong>
              </div>
              <div>
                <span>Gap vs cohort (24h)</span>
                <strong
                  className={
                    payload.benchmark.selfAvgGap24h != null &&
                    payload.benchmark.selfAvgGap24h >= 0
                      ? "tone-positive"
                      : "tone-negative"
                  }
                >
                  {fmtPts(payload.benchmark.selfAvgGap24h)}
                </strong>
              </div>
              <div>
                <span>Gap vs cohort (7d)</span>
                <strong
                  className={
                    payload.benchmark.selfAvgGap7d != null &&
                    payload.benchmark.selfAvgGap7d >= 0
                      ? "tone-positive"
                      : "tone-negative"
                  }
                >
                  {fmtPts(payload.benchmark.selfAvgGap7d)}
                </strong>
              </div>
            </div>
          </div>

          <div className="pro-section-divider" />

          <div className="pro-section">
            <p className="section-label">Volatility profile</p>
            <div className="pro-vol-grid">
              <div>
                <span>Intraday range</span>
                <strong>
                  {payload.volatility.intradayRangePct != null
                    ? `${payload.volatility.intradayRangePct.toFixed(2)}%`
                    : "n/a"}
                </strong>
              </div>
              <div>
                <span>Cohort avg range</span>
                <strong>
                  {payload.volatility.peerAvgRangePct != null
                    ? `${payload.volatility.peerAvgRangePct.toFixed(2)}%`
                    : "n/a"}
                </strong>
              </div>
              <div>
                <span>Classification</span>
                <strong className={`pro-vol-label tone-${payload.volatility.label.toLowerCase().replace(" ", "-")}`}>
                  {payload.volatility.label}
                </strong>
              </div>
            </div>
          </div>

          {detail ? (
            <>
              <div className="pro-section-divider" />
              <div className="pro-section">
                <p className="section-label">
                  Curated reading · trust-tagged sources
                </p>

                {detail.community.sentimentUpPct != null ||
                detail.community.redditSubscribers != null ||
                detail.developer.stars != null ? (
                  <div className="pro-signal-grid">
                    {detail.community.sentimentUpPct != null ? (
                      <div>
                        <span>Sentiment up-vote</span>
                        <strong>
                          {detail.community.sentimentUpPct.toFixed(0)}%
                        </strong>
                      </div>
                    ) : null}
                    {detail.community.redditSubscribers != null ? (
                      <div>
                        <span>Reddit subs</span>
                        <strong>
                          {fmtCompactNumber(detail.community.redditSubscribers)}
                        </strong>
                      </div>
                    ) : null}
                    {detail.community.twitterFollowers != null ? (
                      <div>
                        <span>X followers</span>
                        <strong>
                          {fmtCompactNumber(detail.community.twitterFollowers)}
                        </strong>
                      </div>
                    ) : null}
                    {detail.developer.stars != null ? (
                      <div>
                        <span>GitHub stars</span>
                        <strong>{fmtCompactNumber(detail.developer.stars)}</strong>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="pro-link-list">
                  {detail.links.map((link) => (
                    <a
                      key={link.url}
                      className={`pro-link kind-${link.kind}`}
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
                            label: `Pro · ${link.label}`,
                          },
                        })
                      }
                    >
                      <span className="pro-link-label">{link.label}</span>
                      <span className={`pro-trust-chip trust-${link.trust}`}>
                        <span className="trust-dot" aria-hidden />
                        {link.trust === "high"
                          ? "Trust · high"
                          : link.trust === "medium"
                            ? "Trust · medium"
                            : "Community"}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
