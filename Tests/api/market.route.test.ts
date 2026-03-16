import { beforeEach, describe, expect, it, vi } from "vitest";
import { marketCoins } from "../fixtures/coins";

describe("/api/market", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns the market snapshot with cache headers", async () => {
    const fetchCoinGeckoMarketSnapshot = vi.fn().mockResolvedValue(marketCoins);
    vi.doMock("@/lib/coingecko-server", () => ({
      fetchCoinGeckoMarketSnapshot,
    }));

    const { GET } = await import("../../web/src/app/api/market/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=60");
    await expect(response.json()).resolves.toEqual(marketCoins);
    expect(fetchCoinGeckoMarketSnapshot).toHaveBeenCalledTimes(1);
  });

  it("returns a 500 when the upstream snapshot fetch fails", async () => {
    vi.doMock("@/lib/coingecko-server", () => ({
      fetchCoinGeckoMarketSnapshot: vi.fn().mockRejectedValue(new Error("rate limited")),
    }));

    const { GET } = await import("../../web/src/app/api/market/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      error: "CoinGecko fetch error",
    });
    expect(body.details).toContain("rate limited");
  });
});
