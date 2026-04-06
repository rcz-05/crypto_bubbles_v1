import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/explanation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects invalid requests", async () => {
    const { POST } = await import("../../web/src/app/api/explanation/route");

    const response = await POST(
      new Request("http://localhost/api/explanation", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "coin.symbol and coin.name are required",
    });
  });

  it("returns a one-paragraph explanation", async () => {
    vi.doMock("@/lib/explanation", () => ({
      buildExplanationCacheKey: vi.fn().mockReturnValue("cache-key"),
      generateCoinExplanation: vi.fn().mockResolvedValue({
        explanation:
          "Bitcoin is moving higher as strong 24-hour momentum and heavy turnover line up with fresh positive headlines, which suggests traders are reacting to both price strength and supportive news rather than a random spike.",
        model: "qwen/qwen3-next-80b-a3b-instruct:free",
        generatedAt: "2026-04-03T01:00:00.000Z",
      }),
    }));

    const { POST } = await import("../../web/src/app/api/explanation/route");

    const response = await POST(
      new Request("http://localhost/api/explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coin: {
            id: "bitcoin",
            symbol: "btc",
            name: "Bitcoin",
            category: "store of value",
          },
          trend: {
            price_change_percentage_24h: 4.7,
            market_cap_rank: 1,
            total_volume: 130_000_000_000,
            market_cap: 1_250_000_000_000,
            high_24h: 65000,
            low_24h: 61000,
          },
          news: [
            {
              title: "ETF inflows support Bitcoin demand",
              source: "Example News",
              publishedAt: "2026-04-03T00:30:00.000Z",
              summary: "Investors added to ETF positions during the latest session.",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=600");
    await expect(response.json()).resolves.toMatchObject({
      explanation: expect.stringContaining("Bitcoin is moving higher"),
      model: "qwen/qwen3-next-80b-a3b-instruct:free",
    });
  });

  it("caches identical explanation requests", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-03T01:00:00.000Z"));

    const generateCoinExplanation = vi.fn().mockResolvedValue({
      explanation:
        "Bitcoin is moving higher as strong momentum and fresh headlines align.",
      model: "qwen/qwen3-next-80b-a3b-instruct:free",
      generatedAt: "2026-04-03T01:00:00.000Z",
    });

    vi.doMock("@/lib/explanation", async () => {
      const actual = await vi.importActual<typeof import("../../web/src/lib/explanation")>(
        "../../web/src/lib/explanation",
      );
      return {
        ...actual,
        buildExplanationCacheKey: vi.fn().mockReturnValue("cache-key"),
        generateCoinExplanation,
      };
    });

    const { POST } = await import("../../web/src/app/api/explanation/route");
    const makeRequest = () =>
      new Request("http://localhost/api/explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coin: {
            id: "bitcoin",
            symbol: "btc",
            name: "Bitcoin",
          },
          trend: {
            price_change_percentage_24h: 4.7,
            market_cap_rank: 1,
          },
          news: [
            {
              title: "ETF inflows support Bitcoin demand",
              source: "Example News",
              summary: "Investors added to ETF positions during the latest session.",
            },
          ],
        }),
      });

    const first = await POST(makeRequest());
    expect(first.status).toBe(200);
    await first.json();
    expect(generateCoinExplanation).toHaveBeenCalledTimes(1);

    const second = await POST(makeRequest());
    expect(second.status).toBe(200);
    await second.json();
    expect(generateCoinExplanation).toHaveBeenCalledTimes(1);
  });
});
