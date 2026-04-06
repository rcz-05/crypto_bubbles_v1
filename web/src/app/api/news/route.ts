import { NextResponse } from "next/server";
import { getCoinByQuery, fetchCoinGeckoMarketSnapshot } from "@/lib/coingecko-server";
import {
  fetchRelevantNews,
  getAvailableNewsProviders,
  resolveNewsProvider,
} from "@/lib/news";
import type { CoinNews } from "@/lib/news";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TTL_MS = 600_000;

type CacheEntry = {
  data: CoinNews;
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const id = searchParams.get("id");
  const name = searchParams.get("name");
  const providerParam = searchParams.get("provider");
  const lang = searchParams.get("lang") ?? undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  if (!symbol && !id && !name) {
    return NextResponse.json(
      { error: "symbol, id, or name query param is required" },
      { status: 400 },
    );
  }

  const provider = resolveNewsProvider(providerParam);
  if (!provider) {
    return NextResponse.json(
      {
        error:
          providerParam
            ? `Requested news provider "${providerParam}" is unavailable or not configured`
            : "No news provider configured",
        availableProviders: getAvailableNewsProviders(),
      },
      { status: 503 },
    );
  }

  const cacheKey = [
    provider,
    id?.toLowerCase() ?? "",
    symbol?.toLowerCase() ?? "",
    name?.toLowerCase() ?? "",
    lang?.toLowerCase() ?? "",
    limit ?? "",
  ].join(":");
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (cached && now - cached.timestamp < TTL_MS) {
    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=120" },
    });
  }

  try {
    let coin: ReturnType<typeof getCoinByQuery> = null;

    if (id || symbol) {
      const coins = await fetchCoinGeckoMarketSnapshot();
      coin = getCoinByQuery(coins, id, symbol);
    }

    if (!coin && !name) {
      return NextResponse.json(
        { error: "coin not found in current market snapshot" },
        { status: 404 },
      );
    }

    const resolvedCoin = coin ?? {
      id: id ?? symbol?.toLowerCase() ?? name?.toLowerCase().replace(/\s+/g, "-") ?? "unknown",
      symbol: symbol ?? name?.slice(0, 10).toLowerCase() ?? "unknown",
      name: name ?? symbol?.toUpperCase() ?? "Unknown",
    };

    const data = await fetchRelevantNews({
      coin: {
        id: resolvedCoin.id,
        symbol: resolvedCoin.symbol,
        name: resolvedCoin.name,
      },
      provider,
      language: lang,
      limit,
    });

    cache.set(cacheKey, { data, timestamp: now });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=120" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to fetch coin news", details: `${error}` },
      { status: 500 },
    );
  }
}
