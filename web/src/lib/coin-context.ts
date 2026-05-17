import { Coin } from "@/lib/coingecko";
import { CONTEXT_FIXTURES } from "@/lib/context-fixtures";

export type ContextHeadline = {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
};

export type RiskBadgeTone = "calm" | "watch" | "alert" | "neutral";

export type RiskBadge = {
  label: string;
  tone: RiskBadgeTone;
  detail: string;
};

export type SourceLink = {
  label: string;
  url: string;
  kind: "market" | "official" | "research";
};

export type ConfidenceLevel = "high" | "medium" | "low";

export type ReasoningStep = {
  signal: string;
  value: string;
  interpretation: string;
};

export type CoinContext = {
  coinId: string;
  symbol: string;
  summary: string;
  headlines: ContextHeadline[];
  riskBadges: RiskBadge[];
  lastUpdated: string;
  isFallback: boolean;
  sourceLinks: SourceLink[];
  confidence: ConfidenceLevel;
  reasoning: ReasoningStep[];
};

function formatPercent(value: number) {
  return `${Math.abs(value).toFixed(1)}%`;
}

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

function getRangePercent(coin: Coin) {
  if (!coin.high_24h || !coin.low_24h || coin.low_24h <= 0) {
    return null;
  }

  return ((coin.high_24h - coin.low_24h) / coin.low_24h) * 100;
}

function getVolumeRatio(coin: Coin) {
  if (!coin.total_volume || !coin.market_cap) {
    return null;
  }

  return coin.total_volume / coin.market_cap;
}

function buildRiskBadges(coin: Coin, isFallback: boolean): RiskBadge[] {
  const badges: RiskBadge[] = [];
  const absChange = Math.abs(coin.price_change_percentage_24h ?? 0);
  const rangePercent = getRangePercent(coin);
  const volumeRatio = getVolumeRatio(coin);

  if (absChange >= 8 || (rangePercent != null && rangePercent >= 12)) {
    badges.push({
      label: "High Volatility",
      tone: "alert",
      detail: `The coin has stretched ${formatPercent(absChange)} in 24h${rangePercent != null ? ` with a ${rangePercent.toFixed(1)}% intraday range` : ""}.`,
    });
  } else if (absChange >= 4) {
    badges.push({
      label: "Fast Move",
      tone: "watch",
      detail: `The move is large enough to attract short-term traders, so confirmation matters.`,
    });
  } else {
    badges.push({
      label: "Calmer Tape",
      tone: "calm",
      detail: "This move is still meaningful, but it is not yet stretched by CoinCanvas guardrail thresholds.",
    });
  }

  if (volumeRatio != null && volumeRatio >= 0.18) {
    badges.push({
      label: "Heavy Turnover",
      tone: "watch",
      detail: `24h volume is ${Math.round(volumeRatio * 100)}% of market cap, which suggests a crowded short-term trade.`,
    });
  } else if (coin.market_cap_rank != null && coin.market_cap_rank > 25) {
    badges.push({
      label: "Thinner Liquidity",
      tone: "watch",
      detail: `This asset sits outside the largest-cap cohort, so price can move faster on smaller flows.`,
    });
  } else if (coin.market_cap_rank != null && coin.market_cap_rank <= 10) {
    badges.push({
      label: "Large-Cap Anchor",
      tone: "calm",
      detail: `Top-ranked assets usually provide cleaner market reads for beginners than thinner names do.`,
    });
  }

  if (isFallback) {
    badges.push({
      label: "Context May Be Thin",
      tone: "neutral",
      detail: "CoinCanvas is using market-data heuristics only for this asset because no curated research note is loaded.",
    });
  }

  return badges.slice(0, 3);
}

function buildFallbackHeadlines(coin: Coin, lastUpdated: string): ContextHeadline[] {
  const rangePercent = getRangePercent(coin);
  const volumeRatio = getVolumeRatio(coin);
  const rankLabel =
    coin.market_cap_rank != null ? `top-${coin.market_cap_rank}` : "tracked";

  return [
    {
      title: `${coin.name} is a ${rankLabel} asset and is ${coin.price_change_percentage_24h >= 0 ? "up" : "down"} ${formatPercent(
        coin.price_change_percentage_24h ?? 0,
      )} over the last 24 hours.`,
      source: "CoinGecko market data",
      publishedAt: lastUpdated,
      url: `https://www.coingecko.com/en/coins/${coin.id}`,
    },
    {
      title:
        rangePercent != null
          ? `The session range ran from ${formatCurrency(coin.low_24h)} to ${formatCurrency(coin.high_24h)}, a ${rangePercent.toFixed(
              1,
            )}% swing.`
          : "The intraday range is incomplete, so CoinCanvas is leaning more on the 24h move and volume picture.",
      source: "CoinGecko market data",
      publishedAt: lastUpdated,
      url: `https://www.coingecko.com/en/coins/${coin.id}`,
    },
    {
      title:
        volumeRatio != null
          ? `24h volume is ${formatCompactCurrency(coin.total_volume)}, about ${Math.round(volumeRatio * 100)}% of market cap.`
          : `24h volume is ${formatCompactCurrency(coin.total_volume)}. Use it as a confirmation signal before acting.`,
      source: "CoinGecko market data",
      publishedAt: lastUpdated,
      url: `https://www.coingecko.com/en/coins/${coin.id}`,
    },
  ];
}

function buildSummary(coin: Coin, isFallback: boolean) {
  const fixture = CONTEXT_FIXTURES[coin.symbol.toLowerCase()];
  const direction = coin.price_change_percentage_24h >= 0 ? "up" : "down";
  const absChange = formatPercent(coin.price_change_percentage_24h ?? 0);
  const rangePercent = getRangePercent(coin);
  const volumeRatio = getVolumeRatio(coin);

  const movementFrame =
    direction === "up"
      ? `${coin.name} is up ${absChange} over the last 24 hours.`
      : `${coin.name} is down ${absChange} over the last 24 hours.`;

  const narrative =
    fixture?.narratives[
      direction === "up" ? "positive" : direction === "down" ? "negative" : "neutral"
    ] ?? null;

  const contextFrame = isFallback
    ? "CoinCanvas does not have a curated research note for this asset yet, so this explanation is based on live market structure only."
    : `The first context to check is: ${narrative}`;

  const volumeFrame =
    volumeRatio == null
      ? "Volume context is limited, so treat this as a starting point rather than a full trade thesis."
      : volumeRatio >= 0.18
        ? "Turnover is elevated for the coin's size, which usually means the move is attracting short-term attention fast."
        : "Turnover looks more measured, so confirmation from fresh headlines or follow-through matters.";

  const rangeFrame =
    rangePercent == null
      ? "Intraday range data is incomplete."
      : `The intraday range spans ${rangePercent.toFixed(1)}%, so the move should be read with volatility in mind.`;

  return `${movementFrame} ${contextFrame} ${volumeFrame} ${rangeFrame}`;
}

function buildConfidence(coin: Coin, isFallback: boolean): ConfidenceLevel {
  let score = 0;

  // Curated fixture is the strongest signal
  if (!isFallback) score += 3;

  // Data completeness
  if (coin.total_volume != null && coin.total_volume > 0) score += 1;
  if (coin.high_24h != null && coin.low_24h != null) score += 1;
  if (coin.market_cap_rank != null && coin.market_cap_rank <= 25) score += 1;

  if (score >= 5) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function buildReasoning(coin: Coin, isFallback: boolean): ReasoningStep[] {
  const steps: ReasoningStep[] = [];
  const absChange = Math.abs(coin.price_change_percentage_24h ?? 0);
  const rangePercent = getRangePercent(coin);
  const volumeRatio = getVolumeRatio(coin);

  steps.push({
    signal: "24h price change",
    value: `${coin.price_change_percentage_24h >= 0 ? "+" : ""}${coin.price_change_percentage_24h.toFixed(2)}%`,
    interpretation: absChange >= 8
      ? "Large move — treat with caution, look for confirming evidence."
      : absChange >= 4
        ? "Noticeable move — worth investigating, but not extreme."
        : "Modest change — the market is relatively calm on this asset.",
  });

  if (rangePercent != null) {
    steps.push({
      signal: "Intraday range",
      value: `${formatCurrency(coin.low_24h)} – ${formatCurrency(coin.high_24h)} (${rangePercent.toFixed(1)}%)`,
      interpretation: rangePercent >= 12
        ? "Wide intraday swing — price has been volatile within the session."
        : "Moderate range — price action has been relatively contained.",
    });
  }

  if (volumeRatio != null) {
    steps.push({
      signal: "Volume / market cap",
      value: `${Math.round(volumeRatio * 100)}%`,
      interpretation: volumeRatio >= 0.18
        ? "High turnover relative to size — this coin is attracting active trading attention."
        : "Measured turnover — trading activity is not unusually elevated.",
    });
  }

  if (coin.market_cap_rank != null) {
    steps.push({
      signal: "Market cap rank",
      value: `#${coin.market_cap_rank}`,
      interpretation: coin.market_cap_rank <= 10
        ? "Top-tier asset — generally more liquid and better covered by analysts."
        : coin.market_cap_rank <= 25
          ? "Mid-cap — reasonable liquidity but can move faster than the largest names."
          : "Smaller-cap — price can shift on thinner volume and fewer participants.",
    });
  }

  if (isFallback) {
    steps.push({
      signal: "Context source",
      value: "Market-data heuristics only",
      interpretation: "No curated research note is available for this asset. The summary is generated from market data patterns alone.",
    });
  } else {
    steps.push({
      signal: "Context source",
      value: "Curated research note",
      interpretation: "This asset has a hand-reviewed research note that provides richer narrative context.",
    });
  }

  return steps;
}

export function buildCoinContext(coin: Coin): CoinContext {
  const fixture = CONTEXT_FIXTURES[coin.symbol.toLowerCase()];
  const lastUpdated = new Date().toISOString();
  const isFallback = !fixture;
  const sourceLinks: SourceLink[] = fixture?.links
    ? [
        ...fixture.links,
        {
          label: "CoinGecko market page",
          url: `https://www.coingecko.com/en/coins/${coin.id}`,
          kind: "market",
        },
      ]
    : [
        {
          label: "CoinGecko market page",
          url: `https://www.coingecko.com/en/coins/${coin.id}`,
          kind: "market",
        },
      ];

  const dedupedLinks = Array.from(
    new Map(sourceLinks.map((link) => [link.url, link])).values(),
  );

  return {
    coinId: coin.id,
    symbol: coin.symbol,
    summary: buildSummary(coin, isFallback),
    headlines: (fixture?.evidence ?? buildFallbackHeadlines(coin, lastUpdated)).slice(0, 3),
    riskBadges: buildRiskBadges(coin, isFallback),
    lastUpdated,
    isFallback,
    sourceLinks: dedupedLinks,
    confidence: buildConfidence(coin, isFallback),
    reasoning: buildReasoning(coin, isFallback),
  };
}
