import { NextResponse } from "next/server";
import { buildCoinContext } from "@/lib/coin-context";
import { fetchCoinGeckoMarketSnapshot, getCoinByQuery } from "@/lib/coingecko-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TTL_MS = 600_000;

type CacheEntry = {
  data: ReturnType<typeof buildCoinContext>;
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const id = searchParams.get("id");

  if (!symbol && !id) {
    return NextResponse.json(
      { error: "symbol or id query param is required" },
      { status: 400 },
    );
  }

  const cacheKey = `${id?.toLowerCase() ?? ""}:${symbol?.toLowerCase() ?? ""}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (cached && now - cached.timestamp < TTL_MS) {
    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=120" },
    });
  }

  try {
    const coins = await fetchCoinGeckoMarketSnapshot();
    const coin = getCoinByQuery(coins, id, symbol);

    if (!coin) {
      return NextResponse.json(
        { error: "coin not found in current market snapshot" },
        { status: 404 },
      );
    }

    const data = buildCoinContext(coin);
    cache.set(cacheKey, { data, timestamp: now });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=120" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to generate coin context", details: `${error}` },
      { status: 500 },
    );
  }
}
