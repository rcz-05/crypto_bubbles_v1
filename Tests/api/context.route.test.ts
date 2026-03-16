import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fallbackCoin, marketCoins } from "../fixtures/coins";

describe("/api/context", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects requests that do not include symbol or id", async () => {
    const { GET } = await import("../../web/src/app/api/context/route");
    const response = await GET(new Request("http://localhost/api/context"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "symbol or id query param is required",
    });
  });

  it("returns 404 when the coin is missing from the current snapshot", async () => {
    vi.doMock("@/lib/coingecko-server", () => ({
      fetchCoinGeckoMarketSnapshot: vi.fn().mockResolvedValue(marketCoins),
      getCoinByQuery: vi.fn().mockReturnValue(null),
    }));

    const { GET } = await import("../../web/src/app/api/context/route");
    const response = await GET(new Request("http://localhost/api/context?symbol=zzz"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "coin not found in current market snapshot",
    });
  });

  it("builds guided context and caches it within the route TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00.000Z"));

    const fetchCoinGeckoMarketSnapshot = vi.fn().mockResolvedValue([fallbackCoin]);
    vi.doMock("@/lib/coingecko-server", () => ({
      fetchCoinGeckoMarketSnapshot,
      getCoinByQuery: (
        coins: typeof marketCoins,
        id?: string | null,
        symbol?: string | null,
      ) =>
        coins.find(
          (coin) =>
            coin.id.toLowerCase() === id?.toLowerCase() ||
            coin.symbol.toLowerCase() === symbol?.toLowerCase(),
        ) ?? null,
    }));

    const { GET } = await import("../../web/src/app/api/context/route");
    const request = new Request("http://localhost/api/context?symbol=pepe&id=pepe");

    const first = await GET(request);
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(first.headers.get("Cache-Control")).toContain("s-maxage=600");
    expect(firstBody).toMatchObject({
      coinId: "pepe",
      symbol: "pepe",
      isFallback: true,
    });
    expect(fetchCoinGeckoMarketSnapshot).toHaveBeenCalledTimes(1);

    const second = await GET(request);
    await second.json();
    expect(fetchCoinGeckoMarketSnapshot).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(600_001);
    const third = await GET(request);
    await third.json();
    expect(fetchCoinGeckoMarketSnapshot).toHaveBeenCalledTimes(2);
  });

  it("returns 500 when context generation dependencies fail", async () => {
    vi.doMock("@/lib/coingecko-server", () => ({
      fetchCoinGeckoMarketSnapshot: vi.fn().mockRejectedValue(new Error("context unavailable")),
      getCoinByQuery: vi.fn(),
    }));

    const { GET } = await import("../../web/src/app/api/context/route");
    const response = await GET(new Request("http://localhost/api/context?symbol=btc"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      error: "Unable to generate coin context",
    });
    expect(body.details).toContain("context unavailable");
  });
});
