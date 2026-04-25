import type { Coin } from "@/lib/coingecko";
import type { PeerBenchmark, VolatilityProfile } from "@/lib/peer-benchmark";

export type ProNarrative = {
  headline: string;
  multiHorizon: string;
  positioning: string;
  model: string;
  generatedAt: string;
  isFallback: boolean;
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
    headline: { type: "string" },
    multiHorizon: { type: "string" },
    positioning: { type: "string" },
  },
  required: ["headline", "multiHorizon", "positioning"],
} as const;

function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function fmtPctSigned(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  if (value === 0) return "flat";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)} pts`;
}

function deterministicNarrative(
  self: Coin,
  benchmark: PeerBenchmark,
  vol: VolatilityProfile,
): ProNarrative {
  const c1 = self.price_change_percentage_1h_in_currency ?? 0;
  const c24 = self.price_change_percentage_24h ?? 0;
  const c7 = self.price_change_percentage_7d_in_currency ?? null;
  const c30 = self.price_change_percentage_30d_in_currency ?? null;

  const direction24 = c24 >= 0 ? "up" : "down";
  const direction7 = c7 == null ? null : c7 >= 0 ? "up" : "down";
  const direction30 = c30 == null ? null : c30 >= 0 ? "up" : "down";

  const headline =
    `${self.name} (${self.symbol.toUpperCase()}) trading ${direction24} ${Math.abs(c24).toFixed(2)}% on the session` +
    (direction7
      ? `, ${direction7} ${Math.abs(c7 ?? 0).toFixed(1)}% over 7d`
      : "") +
    (direction30
      ? `, ${direction30} ${Math.abs(c30 ?? 0).toFixed(1)}% over 30d.`
      : ".");

  const multiHorizon =
    `Timeframes are ${
      direction7 && direction24 && direction7 === direction24
        ? "aligned"
        : "diverging"
    }. 1h ${fmtPct(c1)}, 24h ${fmtPct(c24)}, 7d ${fmtPct(c7)}, 30d ${fmtPct(c30)}. ` +
    (Math.abs(c24) > Math.abs(c7 ?? 0)
      ? "Short-term move is the dominant signal — recent flow is leading the multi-week tape."
      : "Short-term move sits inside the broader 7d trend — single-session noise rather than a structural break.");

  const peerGapStr = fmtPctSigned(benchmark.selfAvgGap24h);
  const positioning =
    `Versus ${benchmark.cohortLabel.toLowerCase()}: ${
      benchmark.selfAvgGap24h == null
        ? "no peer data."
        : benchmark.selfAvgGap24h >= 0
          ? `outperforming peer average by ${peerGapStr}.`
          : `underperforming peer average by ${peerGapStr}.`
    }` +
    (vol.label !== "Unknown"
      ? ` Intraday volatility ${vol.label.toLowerCase()} (${(vol.intradayRangePct ?? 0).toFixed(1)}% vs cohort ${(vol.peerAvgRangePct ?? 0).toFixed(1)}%).`
      : "");

  return {
    headline,
    multiHorizon,
    positioning,
    model: "deterministic",
    generatedAt: new Date().toISOString(),
    isFallback: true,
  };
}

function buildSystemInstruction(): string {
  return [
    "You are a sell-side desk analyst writing a Pro tier daily read for an experienced crypto trader.",
    "Use precise trading desk vocabulary: drawdown / drawup, intraday range, realized volatility, turnover ratio, support / resistance, distribution vs accumulation, capitulation, mean reversion, basis vs spot, beta to BTC.",
    "Three sections, each ground in the data provided:",
    "  - headline: 1 punchy sentence framing the multi-horizon stance.",
    "  - multiHorizon: 2-3 sentences synthesizing 1h / 24h / 7d / 30d context. Call out alignment vs divergence between timeframes.",
    "  - positioning: 2-3 sentences benchmarking against the named peer cohort + interpreting the volatility profile. End with one interpretive read.",
    "Every numeric claim must come from the data shown. Never invent news, partnerships, regulation, or catalysts.",
    "Never give financial advice or price predictions. Never mention being an AI, LLM, or model.",
    "Voice: terse, analytical, sell-side desk note. No hedging, no fluff, no exclamation marks.",
    "Output must strictly match the JSON schema you are given.",
  ].join(" ");
}

function buildPrompt(
  self: Coin,
  benchmark: PeerBenchmark,
  vol: VolatilityProfile,
): string {
  const lines: string[] = [];
  lines.push(`Coin: ${self.name} (${self.symbol.toUpperCase()})`);
  lines.push(
    `Market cap rank: ${self.market_cap_rank != null ? `#${self.market_cap_rank}` : "unranked"}`,
  );
  lines.push(`1h change: ${fmtPct(self.price_change_percentage_1h_in_currency)}`);
  lines.push(`24h change: ${fmtPct(self.price_change_percentage_24h)}`);
  lines.push(`7d change: ${fmtPct(self.price_change_percentage_7d_in_currency)}`);
  lines.push(`30d change: ${fmtPct(self.price_change_percentage_30d_in_currency)}`);
  lines.push(
    `24h high / low: ${self.high_24h ?? "n/a"} / ${self.low_24h ?? "n/a"}`,
  );
  lines.push(
    `Intraday range: ${vol.intradayRangePct != null ? vol.intradayRangePct.toFixed(2) + "%" : "n/a"}`,
  );
  lines.push("");
  lines.push(`Peer cohort: ${benchmark.cohortLabel}`);
  lines.push(
    `Peer avg 24h: ${fmtPct(benchmark.peerAvg24h)} (gap vs self: ${fmtPctSigned(benchmark.selfAvgGap24h)})`,
  );
  lines.push(
    `Peer avg 7d: ${fmtPct(benchmark.peerAvg7d)} (gap vs self: ${fmtPctSigned(benchmark.selfAvgGap7d)})`,
  );
  lines.push(
    `Peer avg intraday range: ${benchmark.peerAvgIntradayRangePct != null ? benchmark.peerAvgIntradayRangePct.toFixed(2) + "%" : "n/a"}`,
  );
  lines.push(`Volatility classification vs cohort: ${vol.label}`);
  lines.push("Peers:");
  for (const p of benchmark.peers) {
    lines.push(
      `  - ${p.symbol} (${p.name}, rank ${p.rank ?? "n/a"}): 24h ${fmtPct(p.change24h)}, 7d ${fmtPct(p.change7d)}`,
    );
  }
  lines.push("");
  lines.push(
    "Produce a JSON object with: headline, multiHorizon, positioning. Voice and rules per system instructions.",
  );
  return lines.join("\n");
}

function parseGemini(text: string): Partial<ProNarrative> | null {
  try {
    const parsed = JSON.parse(text) as {
      headline?: unknown;
      multiHorizon?: unknown;
      positioning?: unknown;
    };
    if (
      typeof parsed.headline !== "string" ||
      typeof parsed.multiHorizon !== "string" ||
      typeof parsed.positioning !== "string"
    ) {
      return null;
    }
    return {
      headline: parsed.headline.trim(),
      multiHorizon: parsed.multiHorizon.trim(),
      positioning: parsed.positioning.trim(),
    };
  } catch {
    return null;
  }
}

async function callGemini(
  model: string,
  systemInstruction: string,
  prompt: string,
): Promise<ProNarrative | null> {
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
            maxOutputTokens: 700,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );

    if (!res.ok) return null;

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = parseGemini(text);
    if (!parsed?.headline || !parsed.multiHorizon || !parsed.positioning) {
      return null;
    }

    return {
      headline: parsed.headline,
      multiHorizon: parsed.multiHorizon,
      positioning: parsed.positioning,
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

export async function generateProNarrative(
  self: Coin,
  benchmark: PeerBenchmark,
  vol: VolatilityProfile,
): Promise<ProNarrative> {
  const systemInstruction = buildSystemInstruction();
  const prompt = buildPrompt(self, benchmark, vol);

  for (const model of MODEL_CHAIN) {
    const result = await callGemini(model, systemInstruction, prompt);
    if (result) return result;
  }

  return deterministicNarrative(self, benchmark, vol);
}

export function buildProCacheKey(self: Coin): string {
  const bucketize = (v: number | null | undefined, step = 0.5) => {
    if (v == null) return "na";
    return Math.round(v / step) * step;
  };
  return [
    "pro",
    self.id ?? self.symbol.toLowerCase(),
    bucketize(self.price_change_percentage_24h),
    bucketize(self.price_change_percentage_7d_in_currency),
    bucketize(self.price_change_percentage_30d_in_currency, 1),
  ].join(":");
}
