"use client";

import { create } from "zustand";
import { Coin, fetchMarketData } from "@/lib/coingecko";

type MarketState = {
  coins: Coin[];
  status: "idle" | "loading" | "error";
  error?: string;
  lastUpdated?: number;
  fetchCoins: () => Promise<void>;
};

export const useMarketStore = create<MarketState>((set) => ({
  coins: [],
  status: "idle",
  error: undefined,
  lastUpdated: undefined,
  fetchCoins: async () => {
    set({ status: "loading", error: undefined });
    try {
      const coins = await fetchMarketData();
      set({ coins, status: "idle", lastUpdated: Date.now() });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to fetch market data";
      set({ status: "error", error: message });
    }
  },
}));
