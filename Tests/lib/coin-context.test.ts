import { describe, expect, it } from "vitest";
import { buildCoinContext } from "../../web/src/lib/coin-context";
import { fallbackCoin, makeCoin } from "../fixtures/coins";

describe("coin-context", () => {
  it("uses curated fixtures for supported demo coins and de-duplicates repeated links", () => {
    const context = buildCoinContext(
      makeCoin({
        id: "bitcoin",
        symbol: "btc",
        name: "Bitcoin",
        price_change_percentage_24h: 4.7,
        market_cap_rank: 1,
        total_volume: 140_000_000_000,
        market_cap: 1_250_000_000_000,
        high_24h: 65000,
        low_24h: 61000,
      }),
    );

    expect(context.isFallback).toBe(false);
    expect(context.headlines).toHaveLength(3);
    expect(context.summary).toContain("In this learning prototype");
    expect(context.sourceLinks).toHaveLength(2);
    expect(context.sourceLinks[0].url).toContain("coingecko.com");
    expect(context.riskBadges.map((badge) => badge.label)).toEqual(
      expect.arrayContaining(["Fast Move", "Large-Cap Anchor"]),
    );
  });

  it("builds a deterministic fallback context with volatility, volume, and thin-context guardrails", () => {
    const context = buildCoinContext(fallbackCoin);

    expect(context).toMatchObject({
      coinId: "pepe",
      symbol: "pepe",
      isFallback: true,
    });
    expect(context.summary).toContain("CoinCanvas does not have a curated research note");
    expect(context.headlines).toHaveLength(3);
    expect(context.sourceLinks).toEqual([
      {
        label: "CoinGecko market page",
        url: "https://www.coingecko.com/en/coins/pepe",
        kind: "market",
      },
    ]);
    expect(context.riskBadges.map((badge) => badge.label)).toEqual([
      "High Volatility",
      "Heavy Turnover",
      "Context May Be Thin",
    ]);
  });
});
