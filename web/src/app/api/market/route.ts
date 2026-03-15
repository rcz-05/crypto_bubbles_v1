import { NextResponse } from "next/server";
import { fetchCoinGeckoMarketSnapshot } from "@/lib/coingecko-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await fetchCoinGeckoMarketSnapshot();

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
