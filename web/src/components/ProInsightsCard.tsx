"use client";

import type { PeerBenchmark, VolatilityProfile } from "@/lib/peer-benchmark";
import type { ProSignal, Verdict } from "@/lib/pro-signal";

const VERDICT_TONE: Record<Verdict, string> = {
  BUY: "buy",
  HODL: "hodl",
  SELL: "sell",
};

function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(digits)}%`;
}

export function ProInsightsCard({
  signal,
  benchmark,
  volatility,
}: {
  signal: ProSignal;
  benchmark: PeerBenchmark;
  volatility: VolatilityProfile;
}) {
  const tone = VERDICT_TONE[signal.verdict];
  return (
    <section className={`context-card pro-card verdict-${tone}`}>
      <div className="context-section-header">
        <div>
          <p className="section-label pro-eyebrow">CoinCanvas Pro · signal</p>
          <h3>Multi-factor read</h3>
        </div>
        <span className={`pro-verdict pill-${tone}`}>{signal.verdict}</span>
      </div>

      {/* Distribution bar */}
      <div
        className="pro-dist"
        role="img"
        aria-label={`BUY ${signal.distribution.buy}%, HODL ${signal.distribution.hodl}%, SELL ${signal.distribution.sell}%`}
      >
        <span
          className="pro-dist-seg buy"
          style={{ width: `${signal.distribution.buy}%` }}
        />
        <span
          className="pro-dist-seg hodl"
          style={{ width: `${signal.distribution.hodl}%` }}
        />
        <span
          className="pro-dist-seg sell"
          style={{ width: `${signal.distribution.sell}%` }}
        />
      </div>
      <div className="pro-dist-legend">
        <span className="buy">BUY {signal.distribution.buy}%</span>
        <span className="hodl">HODL {signal.distribution.hodl}%</span>
        <span className="sell">SELL {signal.distribution.sell}%</span>
        <span className="pro-conf">{signal.confidence} confidence</span>
      </div>

      {/* Component breakdown */}
      <ul className="pro-components">
        {signal.components.map((c) => (
          <li key={c.name} className={`pro-comp dir-${c.direction}`}>
            <div className="pro-comp-head">
              <strong>{c.name}</strong>
              <span className="pro-comp-score">{c.score}/100</span>
            </div>
            <div className="pro-comp-meter" aria-hidden>
              <span style={{ width: `${c.score}%` }} />
            </div>
            <p className="pro-comp-interp">{c.interpretation}</p>
          </li>
        ))}
      </ul>

      {/* Peer benchmark */}
      <div className="pro-subsection">
        <p className="section-label">Peer benchmark · {benchmark.cohortLabel}</p>
        <div className="pro-bench">
          <div className="pro-bench-row head">
            <span>Coin</span>
            <span>24h</span>
            <span>7d</span>
          </div>
          {benchmark.peers.slice(0, 5).map((p) => (
            <div key={p.symbol} className="pro-bench-row">
              <span>{p.symbol}</span>
              <span className={p.change24h >= 0 ? "up" : "down"}>
                {pct(p.change24h)}
              </span>
              <span
                className={
                  (p.change7d ?? 0) >= 0 ? "up" : "down"
                }
              >
                {pct(p.change7d)}
              </span>
            </div>
          ))}
          <div className="pro-bench-foot">
            Self vs cohort 7d:{" "}
            <strong
              className={(benchmark.selfAvgGap7d ?? 0) >= 0 ? "up" : "down"}
            >
              {benchmark.selfAvgGap7d == null
                ? "—"
                : `${benchmark.selfAvgGap7d >= 0 ? "+" : ""}${benchmark.selfAvgGap7d.toFixed(1)} pts`}
            </strong>
          </div>
        </div>
      </div>

      {/* Volatility */}
      <div className="pro-vol">
        <span className="section-label">Volatility</span>
        <span className={`pro-vol-tag ${volatility.label.replace(/\s/g, "-").toLowerCase()}`}>
          {volatility.label}
        </span>
        <span className="pro-vol-detail">
          intraday {pct(volatility.intradayRangePct)} vs cohort{" "}
          {pct(volatility.peerAvgRangePct)}
        </span>
      </div>

      <p className="pro-disclaimer">
        A deterministic synthesis of the market data shown — not financial
        advice. No prediction of future price.
      </p>
    </section>
  );
}
