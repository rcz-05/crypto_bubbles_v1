import { describe, expect, it, vi } from "vitest";
import { fetchMarketData } from "../../web/src/lib/coingecko";
import { marketCoins } from "../fixtures/coins";

describe("coingecko client lib", () => {
  it("fetches market data from the web API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => marketCoins,
      }),
    );

    await expect(fetchMarketData()).resolves.toEqual(marketCoins);
    expect(fetch).toHaveBeenCalledWith("/api/market", { cache: "no-store" });
  });

  it("throws when the market API returns a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
      }),
    );

    await expect(fetchMarketData()).rejects.toThrow("Market API failed with 502");
  });
});
