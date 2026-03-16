import { beforeEach, describe, expect, it, vi } from "vitest";
import { marketCoins } from "../fixtures/coins";

const marketLibMocks = vi.hoisted(() => ({
  fetchMarketData: vi.fn(),
}));

vi.mock("@/lib/coingecko", () => ({
  fetchMarketData: marketLibMocks.fetchMarketData,
}));

import { useMarketStore } from "../../web/src/store/market";

describe("market store", () => {
  beforeEach(() => {
    useMarketStore.setState({
      coins: [],
      status: "idle",
      error: undefined,
      lastUpdated: undefined,
    });
    marketLibMocks.fetchMarketData.mockReset();
  });

  it("hydrates the market state on success", async () => {
    marketLibMocks.fetchMarketData.mockResolvedValue(marketCoins);

    await useMarketStore.getState().fetchCoins();

    expect(useMarketStore.getState()).toMatchObject({
      coins: marketCoins,
      status: "idle",
      error: undefined,
    });
    expect(useMarketStore.getState().lastUpdated).toEqual(expect.any(Number));
  });

  it("captures the error state when the fetch fails", async () => {
    marketLibMocks.fetchMarketData.mockRejectedValue(new Error("network unavailable"));

    await useMarketStore.getState().fetchCoins();

    expect(useMarketStore.getState()).toMatchObject({
      coins: [],
      status: "error",
      error: "network unavailable",
    });
  });
});
