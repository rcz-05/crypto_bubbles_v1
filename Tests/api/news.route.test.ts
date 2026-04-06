import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { marketCoins } from "../fixtures/coins";

describe("/api/news", () => {
  const env = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...env };
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = env;
  });

  it("rejects requests without symbol, id, or name", async () => {
    const { GET } = await import("../../web/src/app/api/news/route");
    const response = await GET(new Request("http://localhost/api/news"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "symbol, id, or name query param is required",
    });
  });

  it("returns 503 when no provider is configured", async () => {
    delete process.env.GNEWS_API_KEY;
    delete process.env.NEWSAPI_API_KEY;
    delete process.env.ALPHAVANTAGE_API_KEY;

    const { GET } = await import("../../web/src/app/api/news/route");
    const response = await GET(new Request("http://localhost/api/news?symbol=btc"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "No news provider configured",
      availableProviders: [],
    });
  });

  it("retrieves news for a resolved coin and caches it within the route TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T12:00:00.000Z"));
    process.env.GNEWS_API_KEY = "gnews-key";

    const fetchCoinGeckoMarketSnapshot = vi.fn().mockResolvedValue(marketCoins);
    const fetchRelevantNews = vi.fn().mockResolvedValue({
      coin: { id: "bitcoin", symbol: "btc", name: "Bitcoin" },
      provider: "gnews",
      query: "(\"Bitcoin\" OR \"BTC\") AND (crypto OR cryptocurrency OR blockchain)",
      fetchedAt: "2026-04-02T12:00:00.000Z",
      articles: [
        {
          title: "Bitcoin news",
          description: "A relevant headline",
          url: "https://example.com/btc",
          image: null,
          publishedAt: "2026-04-02T11:50:00.000Z",
          source: "Example Source",
          provider: "gnews",
        },
      ],
    });

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
    vi.doMock("@/lib/news", async () => {
      const actual = await vi.importActual<typeof import("../../web/src/lib/news")>(
        "../../web/src/lib/news",
      );
      return {
        ...actual,
        fetchRelevantNews,
      };
    });

    const { GET } = await import("../../web/src/app/api/news/route");
    const request = new Request("http://localhost/api/news?symbol=btc&provider=gnews");

    const first = await GET(request);
    expect(first.status).toBe(200);
    expect(first.headers.get("Cache-Control")).toContain("s-maxage=600");
    await expect(first.json()).resolves.toMatchObject({
      provider: "gnews",
      coin: { symbol: "btc" },
      articles: [expect.objectContaining({ title: "Bitcoin news" })],
    });
    expect(fetchCoinGeckoMarketSnapshot).toHaveBeenCalledTimes(1);
    expect(fetchRelevantNews).toHaveBeenCalledTimes(1);

    const second = await GET(request);
    expect(second.status).toBe(200);
    await second.json();
    expect(fetchCoinGeckoMarketSnapshot).toHaveBeenCalledTimes(1);
    expect(fetchRelevantNews).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(600_001);
    const third = await GET(request);
    expect(third.status).toBe(200);
    await third.json();
    expect(fetchCoinGeckoMarketSnapshot).toHaveBeenCalledTimes(2);
    expect(fetchRelevantNews).toHaveBeenCalledTimes(2);
  });
});
