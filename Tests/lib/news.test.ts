import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { makeCoin } from "../fixtures/coins";

describe("news lib", () => {
  const env = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it("auto-selects the first configured provider in priority order", async () => {
    process.env.NEWSAPI_API_KEY = "newsapi-key";
    process.env.ALPHAVANTAGE_API_KEY = "alpha-key";

    const { resolveNewsProvider } = await import("../../web/src/lib/news");
    expect(resolveNewsProvider()).toBe("newsapi");
  });

  it("fetches and normalizes GNews articles", async () => {
    process.env.GNEWS_API_KEY = "gnews-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          articles: [
            {
              title: "Bitcoin jumps on ETF optimism",
              description: "A fresh move higher followed ETF headlines.",
              url: "https://example.com/btc",
              image: "https://example.com/btc.jpg",
              publishedAt: "2026-04-02T12:00:00.000Z",
              source: { name: "Example News" },
            },
          ],
        }),
      }),
    );

    const { fetchRelevantNews } = await import("../../web/src/lib/news");
    const payload = await fetchRelevantNews({
      coin: makeCoin(),
      provider: "gnews",
      language: "en",
      limit: 3,
    });

    expect(payload.provider).toBe("gnews");
    expect(payload.query).toContain("Bitcoin");
    expect(payload.articles).toEqual([
      expect.objectContaining({
        title: "Bitcoin jumps on ETF optimism",
        source: "Example News",
        provider: "gnews",
      }),
    ]);
  });

  it("fetches and normalizes Alpha Vantage articles", async () => {
    process.env.ALPHAVANTAGE_API_KEY = "alpha-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          feed: [
            {
              title: "BTC sentiment improves",
              summary: "Market participants turned constructive.",
              url: "https://example.com/sentiment",
              banner_image: "https://example.com/sentiment.jpg",
              time_published: "20260402T120000",
              source: "Alpha Feed",
            },
          ],
        }),
      }),
    );

    const { fetchRelevantNews } = await import("../../web/src/lib/news");
    const payload = await fetchRelevantNews({
      coin: makeCoin(),
      provider: "alphavantage",
      limit: 2,
    });

    expect(payload.provider).toBe("alphavantage");
    expect(payload.query).toBe("CRYPTO:BTC + blockchain");
    expect(payload.articles[0]).toMatchObject({
      title: "BTC sentiment improves",
      source: "Alpha Feed",
      provider: "alphavantage",
    });
    expect(payload.articles[0]?.publishedAt).toBe("2026-04-02T12:00:00.000Z");
  });
});

