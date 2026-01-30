import { NextResponse } from "next/server";
import { COINGECKO_ENDPOINT, Coin } from "@/lib/coingecko";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type CacheEntry = { data: Coin[]; timestamp: number };
const TTL_MS = 60_000;
let cache: CacheEntry | null = null;

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.timestamp < TTL_MS) {
    return NextResponse.json(cache.data, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    });
  }

  try {
    const res = await fetch(COINGECKO_ENDPOINT, {
      headers: { "User-Agent": "CryptoBubblesWeb/1.0 (+github.com/vercel)" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch CoinGecko" },
        { status: res.status },
      );
    }

    const data = (await res.json()) as Coin[];
    cache = { data, timestamp: now };

    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "CoinGecko fetch error", details: `${error}` },
      { status: 500 },
    );
  }
}
