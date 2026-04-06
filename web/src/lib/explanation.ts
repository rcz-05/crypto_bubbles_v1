import { OpenRouter } from "@openrouter/sdk";

export type ExplanationNewsItem = {
  title: string;
  source: string;
  publishedAt?: string;
  summary?: string;
  url?: string;
};

export type ExplanationTrendInput = {
  price_change_percentage_24h?: number | null;
  market_cap_rank?: number | null;
  total_volume?: number | null;
  market_cap?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
};

export type ExplanationRequest = {
  coin: {
    id?: string;
    symbol: string;
    name: string;
    category?: string;
  };
  trend: ExplanationTrendInput;
  news: ExplanationNewsItem[];
};

export type ExplanationResponse = {
  explanation: string;
  model: string;
  generatedAt: string;
};

const DEFAULT_MODEL = "qwen/qwen3-next-80b-a3b-instruct:free";
const DEFAULT_FALLBACK_MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
  "google/gemma-3-27b-it:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
];

function formatNumber(value?: number | null) {
  if (value == null) return "n/a";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value?: number | null) {
  if (value == null) return "n/a";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 100000 ? "compact" : "standard",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatPercent(value?: number | null) {
  if (value == null) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function buildPrompt(input: ExplanationRequest) {
  const { coin, trend, news } = input;
  const newsLines =
    news.length > 0
      ? news
          .slice(0, 5)
          .map((item, index) => {
            const parts = [
              `${index + 1}. ${item.title}`,
              `source: ${item.source}`,
              item.publishedAt ? `publishedAt: ${item.publishedAt}` : null,
              item.summary ? `summary: ${item.summary}` : null,
            ].filter(Boolean);
            return parts.join(" | ");
          })
          .join("\n")
      : "No current headlines were provided.";

  console.log("[explanation] newsLines", newsLines);

  return [
    "You are writing a single-paragraph crypto move explanation for a beginner-facing product.",
    "Explain the likely move in plain English using only the supplied trend data and news.",
    "Do not mention being an AI. Do not give financial advice. Do not invent facts beyond the input.",
    "Keep it to 90 words max in exactly one paragraph.",
    "",
    `Coin: ${coin.name} (${coin.symbol.toUpperCase()})`,
    `Coin type/category: ${coin.category ?? "unknown"}`,
    `24h price change: ${formatPercent(trend.price_change_percentage_24h)}`,
    `Market cap rank: ${trend.market_cap_rank ?? "n/a"}`,
    `Market cap: ${formatCurrency(trend.market_cap)}`,
    `24h volume: ${formatCurrency(trend.total_volume)}`,
    `24h high: ${formatCurrency(trend.high_24h)}`,
    `24h low: ${formatCurrency(trend.low_24h)}`,
    `Volume / market-cap quick read: ${
      trend.total_volume != null && trend.market_cap
        ? formatNumber(trend.total_volume / trend.market_cap)
        : "n/a"
    }`,
    "",
    "Current news:",
    newsLines,
  ].join("\n");
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getCandidateModels() {
  const configured = process.env.OPENROUTER_MODEL?.trim();
  const envFallbacks =
    process.env.OPENROUTER_FALLBACK_MODELS
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? [];

  return Array.from(
    new Set([
      configured || DEFAULT_MODEL,
      ...envFallbacks,
      ...DEFAULT_FALLBACK_MODELS,
    ]),
  );
}

export function buildExplanationCacheKey(input: ExplanationRequest) {
  return JSON.stringify({
    coin: {
      id: input.coin.id ?? "",
      symbol: input.coin.symbol,
      name: input.coin.name,
      category: input.coin.category ?? "",
    },
    trend: {
      price_change_percentage_24h: input.trend.price_change_percentage_24h ?? null,
      market_cap_rank: input.trend.market_cap_rank ?? null,
      total_volume: input.trend.total_volume ?? null,
      market_cap: input.trend.market_cap ?? null,
      high_24h: input.trend.high_24h ?? null,
      low_24h: input.trend.low_24h ?? null,
    },
    news: input.news.map((item) => ({
      title: item.title,
      source: item.source,
      publishedAt: item.publishedAt ?? "",
      summary: item.summary ?? "",
      url: item.url ?? "",
    })),
    model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
    fallbackModels: process.env.OPENROUTER_FALLBACK_MODELS ?? "",
  });
}

function extractContent(
  value: string | Array<{ text?: string }> | null | undefined,
) {
  if (typeof value === "string") {
    return collapseWhitespace(value);
  }

  if (Array.isArray(value)) {
    return collapseWhitespace(
      value
        .map((item) => item?.text ?? "")
        .filter(Boolean)
        .join(" "),
    );
  }

  return "";
}

export async function generateCoinExplanation(
  input: ExplanationRequest,
): Promise<ExplanationResponse> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const client = new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });
  const models = getCandidateModels();
  const failures: string[] = [];

  for (const model of models) {
    try {
      const response = await client.chat.send({
        httpReferer: process.env.OPENROUTER_HTTP_REFERER,
        appTitle: process.env.OPENROUTER_APP_TITLE ?? "CoinCanvas",
        chatRequest: {
          model,
          messages: [
            {
              role: "user",
              content: buildPrompt(input),
            },
          ],
          stream: false,
        },
      });

      const explanation = extractContent(response.choices?.[0]?.message?.content);

      if (!explanation) {
        failures.push(`${model}: empty explanation`);
        continue;
      }

      return {
        explanation,
        model,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : `${error}`;
      failures.push(`${model}: ${detail}`);
      console.error("[explanation] model failed", { model, detail });
    }
  }

  throw new Error(`All OpenRouter models failed. ${failures.join(" | ")}`);
}
