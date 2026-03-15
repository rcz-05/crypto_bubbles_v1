export type Coin = {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  image: string;
  market_cap_rank: number | null;
  total_volume: number | null;
  high_24h: number | null;
  low_24h: number | null;
};

export const COINGECKO_ENDPOINT =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false";

export async function fetchMarketData(): Promise<Coin[]> {
  const res = await fetch("/api/market", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Market API failed with ${res.status}`);
  }
  const data = (await res.json()) as Coin[];
  return data;
}
