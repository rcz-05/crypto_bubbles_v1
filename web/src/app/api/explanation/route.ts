import { NextResponse } from "next/server";
import {
  buildExplanationCacheKey,
  deterministicFallback,
  generateCoinExplanation,
  type CoinExplanation,
  type ExplanationRequest,
} from "@/lib/explanation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TTL_MS = 600_000;
const MAX_CACHE_ENTRIES = 256;

type CacheEntry = {
  data: CoinExplanation;
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();

function pruneCache(now: number) {
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp >= TTL_MS) {
      cache.delete(key);
    }
  }
  if (cache.size > MAX_CACHE_ENTRIES) {
    const overflow = cache.size - MAX_CACHE_ENTRIES;
    const keys = Array.from(cache.keys()).slice(0, overflow);
    for (const key of keys) cache.delete(key);
  }
}

function validate(body: Partial<ExplanationRequest>): string | null {
  if (!body.coin || typeof body.coin !== "object") {
    return "coin is required";
  }
  const c = body.coin;
  if (typeof c.symbol !== "string" || !c.symbol) return "coin.symbol is required";
  if (typeof c.name !== "string" || !c.name) return "coin.name is required";
  if (typeof c.price_change_percentage_24h !== "number") {
    return "coin.price_change_percentage_24h must be a number";
  }
  return null;
}

export async function POST(req: Request) {
  let body: Partial<ExplanationRequest>;

  try {
    body = (await req.json()) as Partial<ExplanationRequest>;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const validationError = validate(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const typedBody = body as ExplanationRequest;
  const cacheKey = buildExplanationCacheKey(typedBody);
  const now = Date.now();
  pruneCache(now);

  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < TTL_MS) {
    return NextResponse.json(cached.data, {
      headers: {
        "Cache-Control": "s-maxage=600, stale-while-revalidate=120",
        "X-Explanation-Cache": "hit",
      },
    });
  }

  let data: CoinExplanation;
  try {
    data = await generateCoinExplanation(typedBody);
  } catch {
    data = deterministicFallback(typedBody);
  }

  cache.set(cacheKey, { data, timestamp: now });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "s-maxage=600, stale-while-revalidate=120",
      "X-Explanation-Cache": "miss",
      "X-Explanation-Source": data.isFallback ? "deterministic" : "llm",
    },
  });
}
