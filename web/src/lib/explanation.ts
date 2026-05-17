import type { Coin } from "@/lib/coingecko";

export type ExplanationTier =
  | "Stable"
  | "Mild move"
  | "Active mover"
  | "High volatility";

export type WatchNote = {
  label: string;
  detail: string;
};

export type CoinExplanation = {
  summary: string;
  tier: ExplanationTier;
  watchNotes: WatchNote[];
  model: string;
  generatedAt: string;
  isFallback: boolean;
};

export type ExplanationRequestCoin = Pick<
  Coin,
  | "id"
  | "symbol"
  | "name"
  | "current_price"
  | "price_change_percentage_24h"
  | "price_change_percentage_1h_in_currency"
  | "price_change_percentage_7d_in_currency"
  | "price_change_percentage_30d_in_currency"
  | "market_cap"
  | "market_cap_rank"
  | "total_volume"
  | "high_24h"
  | "low_24h"
>;

export type ExplanationRequest = {
  coin: ExplanationRequestCoin;
  eli5?: boolean;
};

const MODEL_CHAIN = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
];

const API_TIMEOUT_MS = 12_000;
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    tier: {
      type: "string",
      enum: ["Stable", "Mild move", "Active mover", "High volatility"],
    },
    watchNotes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          detail: { type: "string" },
        },
        required: ["label", "detail"],
      },
    },
  },
  required: ["summary", "tier", "watchNotes"],
} as const;

function formatPercent(value: number | null | undefined): string {
  if (value == null) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "n/a";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 4,
  }).format(value);
}

function formatCompactCurrency(value: number | null | undefined): string {
  if (value == null) return "n/a";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function getIntradayRangePercent(
  coin: ExplanationRequestCoin,
): number | null {
  if (!coin.high_24h || !coin.low_24h || coin.low_24h <= 0) return null;
  return ((coin.high_24h - coin.low_24h) / coin.low_24h) * 100;
}

function getVolumeToMarketCap(
  coin: ExplanationRequestCoin,
): number | null {
  if (!coin.total_volume || !coin.market_cap) return null;
  return coin.total_volume / coin.market_cap;
}

function deterministicTier(coin: ExplanationRequestCoin): ExplanationTier {
  const absChange = Math.abs(coin.price_change_percentage_24h ?? 0);
  const rangePercent = getIntradayRangePercent(coin) ?? 0;

  if (absChange >= 15 || rangePercent >= 20) return "High volatility";
  if (absChange >= 5 || rangePercent >= 10) return "Active mover";
  if (absChange >= 2) return "Mild move";
  return "Stable";
}

export function deterministicFallback(
  req: ExplanationRequest,
): CoinExplanation {
  const { coin } = req;
  const absChange = Math.abs(coin.price_change_percentage_24h ?? 0);
  const rangePercent = getIntradayRangePercent(coin);
  const volumeRatio = getVolumeToMarketCap(coin);
  const direction = (coin.price_change_percentage_24h ?? 0) >= 0 ? "up" : "down";
  const rankLabel = coin.market_cap_rank != null
    ? `rank #${coin.market_cap_rank}`
    : "unranked";

  const summary = `${coin.name} is ${direction} ${absChange.toFixed(1)}% over the past 24 hours at ${rankLabel}. ${
    rangePercent != null && rangePercent >= 8
      ? `The intraday range of ${rangePercent.toFixed(1)}% suggests notable volatility.`
      : "Price action has been relatively contained within its 24-hour range."
  }`;

  const watchNotes: WatchNote[] = [];

  watchNotes.push({
    label: "24h price change",
    detail: `${formatPercent(coin.price_change_percentage_24h)} (${direction})`,
  });

  if (rangePercent != null) {
    watchNotes.push({
      label: "Intraday range",
      detail: `${formatCurrency(coin.low_24h)} → ${formatCurrency(coin.high_24h)} (${rangePercent.toFixed(1)}%)`,
    });
  }

  if (volumeRatio != null) {
    const label = volumeRatio >= 0.18 ? "Heavy turnover" : "Volume / market cap";
    watchNotes.push({
      label,
      detail: `${formatCompactCurrency(coin.total_volume)} traded, ${(volumeRatio * 100).toFixed(0)}% of market cap`,
    });
  }

  return {
    summary,
    tier: deterministicTier(coin),
    watchNotes: watchNotes.slice(0, 3),
    model: "deterministic",
    generatedAt: new Date().toISOString(),
    isFallback: true,
  };
}

function buildSystemInstruction(): string {
  const base = [
    "You explain why a specific coin has moved today using only the numeric data provided.",
    "Never invent news, regulatory events, partnerships, or catalysts you were not given.",
    "Never give financial advice or price predictions.",
    "Never mention being an AI, LLM, or model.",
    "Output must strictly match the JSON schema you are given.",
    "Audience: someone who is curious about crypto but does not want trading-desk jargon.",
    "Avoid jargon. Banned words include: market capitalization, liquidity, turnover, momentum, accumulation, distribution, capitulation, float, mean reversion, sell-side, buy-side.",
    "If you use unavoidable terms like price, volume, rank, or range, explain them in everyday words.",
    "When you reference a percentage, translate it to a concrete example like 'for every $100 someone had, they'd have $96.80 now'.",
    "Use everyday verbs only: 'went up', 'went down', 'stayed about the same', 'bounced around', 'a lot of people are trading it'.",
    "Keep every sentence short — under 14 words each.",
    "Tone: warm, patient, and useful to someone checking the market on a phone.",
  ];
  return base.join(" ");
}

function buildPrompt(req: ExplanationRequest): string {
  const { coin } = req;
  const volumeRatio = getVolumeToMarketCap(coin);
  const rangePercent = getIntradayRangePercent(coin);

  const lines = [
    `Coin: ${coin.name} (${coin.symbol.toUpperCase()})`,
    `Current price: ${formatCurrency(coin.current_price)}`,
    `Market cap rank: ${coin.market_cap_rank != null ? `#${coin.market_cap_rank}` : "unranked"}`,
    `Market cap: ${formatCompactCurrency(coin.market_cap)}`,
    `24h volume: ${formatCompactCurrency(coin.total_volume)}`,
    `1h change: ${formatPercent(coin.price_change_percentage_1h_in_currency)}`,
    `24h change: ${formatPercent(coin.price_change_percentage_24h)}`,
    `7d change: ${formatPercent(coin.price_change_percentage_7d_in_currency)}`,
    `30d change: ${formatPercent(coin.price_change_percentage_30d_in_currency)}`,
    `24h high / low: ${formatCurrency(coin.high_24h)} / ${formatCurrency(coin.low_24h)}`,
    `Intraday range: ${rangePercent != null ? `${rangePercent.toFixed(1)}%` : "n/a"}`,
    `Volume / market cap: ${volumeRatio != null ? `${(volumeRatio * 100).toFixed(0)}%` : "n/a"}`,
    "",
    "Produce a JSON object with:",
    "- summary: 1-2 short sentences on why the 24h move looks the way it does, grounded only in the numbers above.",
    '- tier: exactly one of "Stable", "Mild move", "Active mover", "High volatility". Use these rough anchors: |24h| < 2% → Stable, 2-5% → Mild move, 5-15% → Active mover, >=15% OR intraday range >= 20% → High volatility.',
    "- watchNotes: 2-3 concrete observations, each with a short `label` (2-4 words) and `detail` (one sentence referencing specific numbers from the data).",
  ];

  return lines.join("\n");
}

function parseGeminiResponse(text: string): Partial<CoinExplanation> | null {
  try {
    const parsed = JSON.parse(text) as {
      summary?: unknown;
      tier?: unknown;
      watchNotes?: unknown;
    };
    if (typeof parsed.summary !== "string") return null;
    if (typeof parsed.tier !== "string") return null;
    const validTiers: ExplanationTier[] = [
      "Stable",
      "Mild move",
      "Active mover",
      "High volatility",
    ];
    if (!validTiers.includes(parsed.tier as ExplanationTier)) return null;
    if (!Array.isArray(parsed.watchNotes)) return null;

    const watchNotes: WatchNote[] = parsed.watchNotes
      .filter(
        (n): n is { label: string; detail: string } =>
          typeof n === "object" &&
          n !== null &&
          typeof (n as { label?: unknown }).label === "string" &&
          typeof (n as { detail?: unknown }).detail === "string",
      )
      .slice(0, 3);

    if (watchNotes.length === 0) return null;

    return {
      summary: parsed.summary.trim(),
      tier: parsed.tier as ExplanationTier,
      watchNotes,
    };
  } catch {
    return null;
  }
}

async function callGemini(
  model: string,
  systemInstruction: string,
  prompt: string,
): Promise<CoinExplanation | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(
      `${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0.3,
            maxOutputTokens: 600,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = parseGeminiResponse(text);
    if (!parsed || !parsed.summary || !parsed.tier || !parsed.watchNotes) {
      return null;
    }

    return {
      summary: parsed.summary,
      tier: parsed.tier,
      watchNotes: parsed.watchNotes,
      model,
      generatedAt: new Date().toISOString(),
      isFallback: false,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateCoinExplanation(
  req: ExplanationRequest,
): Promise<CoinExplanation> {
  const systemInstruction = buildSystemInstruction();
  const prompt = buildPrompt(req);

  for (const model of MODEL_CHAIN) {
    const result = await callGemini(model, systemInstruction, prompt);
    if (result) return result;
  }

  return deterministicFallback(req);
}

export function buildExplanationCacheKey(req: ExplanationRequest): string {
  const c = req.coin;
  const bucketize = (v: number | null | undefined, step = 0.5) => {
    if (v == null) return "na";
    return Math.round(v / step) * step;
  };
  return [
    c.id ?? c.symbol.toLowerCase(),
    bucketize(c.price_change_percentage_24h),
    bucketize(c.price_change_percentage_1h_in_currency),
    bucketize(getIntradayRangePercent(c) ?? null, 1),
    "plain",
  ].join(":");
}
