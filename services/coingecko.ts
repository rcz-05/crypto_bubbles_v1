export type Coin = {
  id: string;
  symbol: string;
  name?: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  image: string;
};

export const fetchMarketData = async (): Promise<Coin[]> => {
  const endpoint =
    'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false';

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Coingecko error: ${response.status}`);
  }
  const data = (await response.json()) as Coin[];
  return data.map((coin) => ({
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    current_price: coin.current_price,
    price_change_percentage_24h: coin.price_change_percentage_24h,
    market_cap: coin.market_cap,
    image: coin.image
  }));
};
