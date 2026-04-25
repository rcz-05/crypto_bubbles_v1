import { NextResponse } from "next/server";
import { getCoinDetail } from "@/lib/coingecko-detail";
import {
  fetchCoinGeckoMarketSnapshot,
  getCoinByQuery,
} from "@/lib/coingecko-server";
import {
  buildPeerBenchmark,
  buildVolatilityProfile,
} from "@/lib/peer-benchmark";
import {
  buildProCacheKey,
  generateProNarrative,
  type ProNarrative,
} from "@/lib/pro-explanation";
import { computeProSignal, type ProSignal } from "@/lib/pro-signal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TTL_MS = 600_000;
const MAX_CACHE_ENTRIES = 256;

type CacheEntry = {
  narrative: ProNarrative;
  benchmark: ReturnType<typeof buildPeerBenchmark>;
  volatility: ReturnType<typeof buildVolatilityProfile>;
  signal: ProSignal;
  sentimentUpPct: number | null;
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();

function pruneCache(now: number) {
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp >= TTL_MS) cache.delete(key);
  }
  if (cache.size > MAX_CACHE_ENTRIES) {
    const overflow = cache.size - MAX_CACHE_ENTRIES;
    const keys = Array.from(cache.keys()).slice(0, overflow);
    for (const key of keys) cache.delete(key);
  }
}

type Body = { coinId?: string; symbol?: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const coinId = typeof body.coinId === "string" ? body.coinId : null;
  const symbol = typeof body.symbol === "string" ? body.symbol : null;
  if (!coinId && !symbol) {
    return NextResponse.json(
      { error: "coinId or symbol is required" },
      { status: 400 },
    );
  }

  let universe;
  try {
    universe = await fetchCoinGeckoMarketSnapshot();
  } catch {
    return NextResponse.json(
      { error: "market data unavailable" },
      { status: 503 },
    );
  }

  const self = getCoinByQuery(universe, coinId, symbol);
  if (!self) {
    return NextResponse.json(
      { error: "coin not found in top-100 universe" },
      { status: 404 },
    );
  }

  const detail = await getCoinDetail(self.id);
  const sentimentUpPct = detail.data.community.sentimentUpPct;

  const cacheKey = buildProCacheKey(self, sentimentUpPct);
  const now = Date.now();
  pruneCache(now);

  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < TTL_MS) {
    return NextResponse.json(
      {
        narrative: cached.narrative,
        benchmark: cached.benchmark,
        volatility: cached.volatility,
        signal: cached.signal,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=600, stale-while-revalidate=120",
          "X-Pro-Cache": "hit",
        },
      },
    );
  }

  const benchmark = buildPeerBenchmark(self, universe);
  const volatility = buildVolatilityProfile(self, benchmark);
  const signal = computeProSignal({
    coin: self,
    benchmark,
    volatility,
    sentimentUpPct,
  });

  const narrative: ProNarrative = await generateProNarrative(
    self,
    benchmark,
    volatility,
    signal,
    sentimentUpPct,
  );

  cache.set(cacheKey, {
    narrative,
    benchmark,
    volatility,
    signal,
    sentimentUpPct,
    timestamp: now,
  });

  return NextResponse.json(
    { narrative, benchmark, volatility, signal },
    {
      headers: {
        "Cache-Control": "s-maxage=600, stale-while-revalidate=120",
        "X-Pro-Cache": "miss",
        "X-Pro-Source": narrative.isFallback ? "deterministic" : "llm",
        "X-Pro-Verdict": signal.verdict,
      },
    },
  );
}
