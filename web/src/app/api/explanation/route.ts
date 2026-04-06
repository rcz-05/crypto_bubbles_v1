import { NextResponse } from "next/server";
import {
  buildExplanationCacheKey,
  generateCoinExplanation,
  type ExplanationRequest,
} from "@/lib/explanation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TTL_MS = 600_000;

type CacheEntry = {
  data: Awaited<ReturnType<typeof generateCoinExplanation>>;
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();

function pruneExpiredEntries(now: number) {
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp >= TTL_MS) {
      cache.delete(key);
    }
  }
}

function validateBody(body: Partial<ExplanationRequest>) {
  if (!body.coin?.symbol || !body.coin?.name) {
    return "coin.symbol and coin.name are required";
  }

  if (!body.trend || typeof body.trend !== "object") {
    return "trend is required";
  }

  if (!Array.isArray(body.news)) {
    return "news must be an array";
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ExplanationRequest>;
    const validationError = validateBody(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const typedBody = body as ExplanationRequest;
    const cacheKey = buildExplanationCacheKey(typedBody);
    const now = Date.now();
    pruneExpiredEntries(now);
    const cached = cache.get(cacheKey);

    if (cached && now - cached.timestamp < TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=120" },
      });
    }

    const data = await generateCoinExplanation(typedBody);
    cache.set(cacheKey, { data, timestamp: now });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=120" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to generate explanation", details: `${error}` },
      { status: 500 },
    );
  }
}
