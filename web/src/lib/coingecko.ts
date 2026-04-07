export type Coin = {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  price_change_percentage_1h_in_currency: number | null;
  price_change_percentage_7d_in_currency: number | null;
  price_change_percentage_30d_in_currency: number | null;
  market_cap: number;
  image: string;
  market_cap_rank: number | null;
  total_volume: number | null;
  high_24h: number | null;
  low_24h: number | null;
};

export type TimeFrame = "1h" | "24h" | "7d" | "30d" | "market_cap";

export function getChangeForTimeFrame(coin: Coin, tf: TimeFrame): number {
  switch (tf) {
    case "1h":
      return coin.price_change_percentage_1h_in_currency ?? 0;
    case "24h":
      return coin.price_change_percentage_24h ?? 0;
    case "7d":
      return coin.price_change_percentage_7d_in_currency ?? 0;
    case "30d":
      return coin.price_change_percentage_30d_in_currency ?? 0;
    case "market_cap":
      return coin.price_change_percentage_24h ?? 0;
  }
}

export const COINGECKO_ENDPOINT =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=1h%2C7d%2C30d";

export async function fetchMarketData(): Promise<Coin[]> {
  const res = await fetch("/api/market", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Market API failed with ${res.status}`);
  }
  const data = (await res.json()) as Coin[];
  return data;
}
