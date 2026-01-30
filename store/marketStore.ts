import { create } from 'zustand';
import { fetchMarketData, type Coin } from '../services/coingecko';

type MarketState = {
  coins: Coin[];
  loading: boolean;
  error?: string;
  fetchData: () => Promise<void>;
};

const useMarketStore = create<MarketState>((set) => ({
  coins: [],
  loading: false,
  error: undefined,
  fetchData: async () => {
    set({ loading: true, error: undefined });
    try {
      const data = await fetchMarketData();
      set({ coins: data, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch market data',
        loading: false
      });
    }
  }
}));

export default useMarketStore;
