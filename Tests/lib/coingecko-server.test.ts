import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { marketCoins } from "../fixtures/coins";

describe("coingecko-server", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes the market snapshot payload and caches it for 60 seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00.000Z"));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "bitcoin",
          symbol: "btc",
          name: "Bitcoin",
          current_price: 64000,
          market_cap: 1_200_000_000_000,
          image: "https://assets.example.test/btc.png",
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchCoinGeckoMarketSnapshot } = await import("../../web/src/lib/coingecko-server");
    const first = await fetchCoinGeckoMarketSnapshot();
    const second = await fetchCoinGeckoMarketSnapshot();

    expect(first).toEqual([
      {
        id: "bitcoin",
        symbol: "btc",
        name: "Bitcoin",
        current_price: 64000,
        price_change_percentage_24h: 0,
        market_cap: 1_200_000_000_000,
        image: "https://assets.example.test/btc.png",
        market_cap_rank: null,
        total_volume: null,
        high_24h: null,
        low_24h: null,
      },
    ]);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_001);
    await fetchCoinGeckoMarketSnapshot();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when CoinGecko returns a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      }),
    );

    const { fetchCoinGeckoMarketSnapshot } = await import("../../web/src/lib/coingecko-server");
    await expect(fetchCoinGeckoMarketSnapshot()).rejects.toThrow("CoinGecko failed with 429");
  });

  it("finds a coin by id or symbol with case-insensitive matching", async () => {
    const { getCoinByQuery } = await import("../../web/src/lib/coingecko-server");

    expect(getCoinByQuery(marketCoins, "BITCOIN", null)).toMatchObject({
      id: "bitcoin",
    });
    expect(getCoinByQuery(marketCoins, null, " eth ")).toMatchObject({
      id: "ethereum",
    });
    expect(getCoinByQuery(marketCoins, null, "zzz")).toBeNull();
  });
});
