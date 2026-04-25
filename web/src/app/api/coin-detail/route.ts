import { NextResponse } from "next/server";
import { getCoinDetail } from "@/lib/coingecko-detail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type {
  CuratedLink,
  CoinDetailPayload,
} from "@/lib/coingecko-detail";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const coinId = searchParams.get("id");

  if (!coinId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data, cacheStatus } = await getCoinDetail(coinId);

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "s-maxage=1800, stale-while-revalidate=300",
      "X-Coin-Detail-Cache": cacheStatus,
      "X-Coin-Detail-Source": data.isFallback ? "fallback" : "coingecko",
    },
  });
}
