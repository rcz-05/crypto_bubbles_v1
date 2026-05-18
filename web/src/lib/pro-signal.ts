import type { Coin } from "@/lib/coingecko";
import type { PeerBenchmark, VolatilityProfile } from "@/lib/peer-benchmark";

export type Verdict = "BUY" | "HODL" | "SELL";
export type ComponentDirection = "buy" | "hodl" | "sell" | "neutral";
export type SignalConfidence = "low" | "medium" | "high";

export type SignalComponent = {
  name: string;
  score: number;
  weight: number;
  direction: ComponentDirection;
  interpretation: string;
};

export type ProSignal = {
  verdict: Verdict;
  distribution: { buy: number; hodl: number; sell: number };
  components: SignalComponent[];
  confidence: SignalConfidence;
  /** Direction-only: positive = bullish bias magnitude, negative = bearish, 0 = neutral. */
  netBias: number;
};

export type SignalInputs = {
  coin: Pick<
    Coin,
    | "price_change_percentage_1h_in_currency"
    | "price_change_percentage_24h"
    | "price_change_percentage_7d_in_currency"
    | "price_change_percentage_30d_in_currency"
    | "total_volume"
    | "market_cap"
  >;
  benchmark: PeerBenchmark;
  volatility: VolatilityProfile;
  sentimentUpPct: number | null;
};

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Map a signed magnitude to a 0-100 score where 50 = neutral.
 * Uses a soft cap so very large moves don't dominate.
 */
function scoreFromSignedPct(value: number, scale = 6): number {
  if (!Number.isFinite(value)) return 50;
  const t = value / scale;
  const compressed = Math.tanh(t);
  return clamp(50 + compressed * 50);
}

function directionFromScore(score: number): ComponentDirection {
  if (score >= 60) return "buy";
  if (score <= 40) return "sell";
  if (score >= 45 && score <= 55) return "neutral";
  return "hodl";
}

function confidenceFromScore(score: number): number {
  // 0 at 50 (neutral), 1 at extremes.
  return clamp(Math.abs(score - 50) / 50, 0, 1);
}

function buildMomentumComponent(coin: SignalInputs["coin"]): SignalComponent {
  const c1 = coin.price_change_percentage_1h_in_currency ?? 0;
  const c24 = coin.price_change_percentage_24h ?? 0;
  const c7 = coin.price_change_percentage_7d_in_currency ?? 0;
  const c30 = coin.price_change_percentage_30d_in_currency ?? 0;

  // Weight long > short, with 7d as the dominant horizon.
  const weighted = c1 * 0.1 + c24 * 0.25 + c7 * 0.4 + c30 * 0.25;
  const score = scoreFromSignedPct(weighted, 8);
  const direction = directionFromScore(score);
  const interpretation =
    direction === "buy"
      ? `Aggregated 1h/24h/7d/30d move of ${weighted.toFixed(1)}% leans bullish across timeframes.`
      : direction === "sell"
        ? `Aggregated 1h/24h/7d/30d move of ${weighted.toFixed(1)}% leans bearish across timeframes.`
        : `Aggregated 1h/24h/7d/30d move of ${weighted.toFixed(1)}% is mixed across timeframes.`;
  return {
    name: "Momentum",
    score: Math.round(score),
    weight: 30,
    direction,
    interpretation,
  };
}

function buildRelativeStrengthComponent(
  benchmark: PeerBenchmark,
): SignalComponent {
  const gap = benchmark.selfAvgGap7d;
  if (gap == null) {
    return {
      name: "Relative strength",
      score: 50,
      weight: 20,
      direction: "neutral",
      interpretation: "Insufficient peer data to compute relative strength.",
    };
  }
  const score = scoreFromSignedPct(gap, 4);
  const direction = directionFromScore(score);
  const verb = gap >= 0 ? "outperforming" : "underperforming";
  const interpretation = `Self ${verb} ${benchmark.cohortLabel.toLowerCase()} on 7d by ${Math.abs(gap).toFixed(1)} pts.`;
  return {
    name: "Relative strength",
    score: Math.round(score),
    weight: 20,
    direction,
    interpretation,
  };
}

function buildSentimentComponent(
  sentimentUpPct: number | null,
): SignalComponent {
  if (sentimentUpPct == null) {
    return {
      name: "Sentiment",
      score: 50,
      weight: 20,
      direction: "neutral",
      interpretation: "Community sentiment data unavailable.",
    };
  }
  // 50% up = neutral. 30% up = strong sell, 80% up = strong buy.
  const centered = (sentimentUpPct - 50) / 30;
  const score = clamp(50 + Math.tanh(centered) * 50);
  const direction = directionFromScore(score);
  const interpretation = `${sentimentUpPct.toFixed(0)}% of community votes are positive (CoinGecko).`;
  return {
    name: "Sentiment",
    score: Math.round(score),
    weight: 20,
    direction,
    interpretation,
  };
}

function buildVolatilityComponent(
  volatility: VolatilityProfile,
): SignalComponent {
  if (volatility.label === "Unknown" || volatility.gapVsPeerPct == null) {
    return {
      name: "Volatility profile",
      score: 50,
      weight: 15,
      direction: "neutral",
      interpretation: "Volatility data unavailable.",
    };
  }
  // Above-average vol → tilts to HODL (uncertainty).
  // In-line vol → mild conviction in whatever momentum says.
  // Below-average vol → moderate conviction.
  const score =
    volatility.label === "In line"
      ? 55
      : volatility.label === "Below average"
        ? 60
        : 40;
  const direction: ComponentDirection =
    volatility.label === "Above average" ? "hodl" : "neutral";
  const interpretation =
    volatility.label === "Above average"
      ? `Intraday range ${(volatility.intradayRangePct ?? 0).toFixed(1)}% is above cohort avg ${(volatility.peerAvgRangePct ?? 0).toFixed(1)}%; chop favors HODL.`
      : volatility.label === "Below average"
        ? `Intraday range ${(volatility.intradayRangePct ?? 0).toFixed(1)}% is below cohort avg ${(volatility.peerAvgRangePct ?? 0).toFixed(1)}%; tape is calm.`
        : `Intraday range in line with cohort avg ${(volatility.peerAvgRangePct ?? 0).toFixed(1)}%.`;
  return {
    name: "Volatility profile",
    score,
    weight: 15,
    direction,
    interpretation,
  };
}

function buildLiquidityComponent(
  coin: SignalInputs["coin"],
): SignalComponent {
  const ratio =
    coin.total_volume && coin.market_cap && coin.market_cap > 0
      ? coin.total_volume / coin.market_cap
      : null;
  if (ratio == null) {
    return {
      name: "Liquidity",
      score: 50,
      weight: 15,
      direction: "neutral",
      interpretation: "Volume / market-cap ratio unavailable.",
    };
  }
  // Healthy turnover ~ 5-15% favors action signal; very thin (<3%) or extreme (>30%) tilts HODL.
  const pct = ratio * 100;
  let score: number;
  let direction: ComponentDirection;
  let note: string;
  if (pct < 3) {
    score = 42;
    direction = "hodl";
    note = "thin turnover";
  } else if (pct > 30) {
    score = 45;
    direction = "hodl";
    note = "abnormally high turnover";
  } else if (pct >= 5 && pct <= 15) {
    score = 60;
    direction = "buy";
    note = "healthy turnover";
  } else {
    score = 55;
    direction = "neutral";
    note = "moderate turnover";
  }
  return {
    name: "Liquidity",
    score,
    weight: 15,
    direction,
    interpretation: `Volume is ${pct.toFixed(1)}% of market cap — ${note}.`,
  };
}

export function computeProSignal(inputs: SignalInputs): ProSignal {
  const components: SignalComponent[] = [
    buildMomentumComponent(inputs.coin),
    buildRelativeStrengthComponent(inputs.benchmark),
    buildSentimentComponent(inputs.sentimentUpPct),
    buildVolatilityComponent(inputs.volatility),
    buildLiquidityComponent(inputs.coin),
  ];

  let buyMass = 0;
  let sellMass = 0;
  let hodlMass = 0;
  let netBias = 0;

  for (const c of components) {
    const weight = c.weight / 100;
    const conf = confidenceFromScore(c.score);
    const directionalScore = (c.score - 50) / 50; // -1..1
    netBias += directionalScore * weight;

    if (c.direction === "buy") {
      buyMass += weight * conf;
      hodlMass += weight * (1 - conf) * 0.6;
    } else if (c.direction === "sell") {
      sellMass += weight * conf;
      hodlMass += weight * (1 - conf) * 0.6;
    } else if (c.direction === "hodl") {
      hodlMass += weight;
    } else {
      hodlMass += weight * 0.7;
      // Neutral still leaks a hint based on directionalScore sign.
      if (directionalScore > 0) buyMass += weight * 0.15 * Math.abs(directionalScore);
      else if (directionalScore < 0)
        sellMass += weight * 0.15 * Math.abs(directionalScore);
    }
  }

  // Normalize to 100.
  const total = buyMass + sellMass + hodlMass;
  const buyPct = total > 0 ? (buyMass / total) * 100 : 0;
  const sellPct = total > 0 ? (sellMass / total) * 100 : 0;
  const hodlPctRaw = total > 0 ? (hodlMass / total) * 100 : 100;

  // Round to 1 decimal then snap to integers summing to 100.
  const rough = {
    buy: round1(buyPct),
    hodl: round1(hodlPctRaw),
    sell: round1(sellPct),
  };
  // Integer normalization preserving sum=100.
  const intBuy = Math.round(rough.buy);
  const intSell = Math.round(rough.sell);
  const intHodl = 100 - intBuy - intSell;

  const distribution = { buy: intBuy, hodl: intHodl, sell: intSell };

  let verdict: Verdict;
  if (distribution.buy >= distribution.hodl && distribution.buy >= distribution.sell)
    verdict = "BUY";
  else if (
    distribution.sell >= distribution.hodl &&
    distribution.sell >= distribution.buy
  )
    verdict = "SELL";
  else verdict = "HODL";

  // Confidence: how far the leading bucket is from 1/3 (random).
  const lead = Math.max(distribution.buy, distribution.hodl, distribution.sell);
  let confidence: SignalConfidence;
  if (lead >= 60) confidence = "high";
  else if (lead >= 45) confidence = "medium";
  else confidence = "low";

  return {
    verdict,
    distribution,
    components,
    confidence,
    netBias: round1(netBias),
  };
}
