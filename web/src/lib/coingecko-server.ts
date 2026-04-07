import { COINGECKO_ENDPOINT, Coin } from "@/lib/coingecko";

const TTL_MS = 60_000;

type CacheEntry = {
  data: Coin[];
  timestamp: number;
};

let cache: CacheEntry | null = null;

function normalizeCoin(coin: Partial<Coin> & Record<string, unknown>): Coin {
  return {
    id: (coin.id as string) ?? "",
    symbol: (coin.symbol as string) ?? "",
    name: (coin.name as string) ?? "",
    current_price: coin.current_price ?? 0,
    price_change_percentage_24h: coin.price_change_percentage_24h ?? 0,
    price_change_percentage_1h_in_currency:
      (coin.price_change_percentage_1h_in_currency as number | null) ?? null,
    price_change_percentage_7d_in_currency:
      (coin.price_change_percentage_7d_in_currency as number | null) ?? null,
    price_change_percentage_30d_in_currency:
      (coin.price_change_percentage_30d_in_currency as number | null) ?? null,
    market_cap: coin.market_cap ?? 0,
    image: coin.image ?? "",
    market_cap_rank: coin.market_cap_rank ?? null,
    total_volume: coin.total_volume ?? null,
    high_24h: coin.high_24h ?? null,
    low_24h: coin.low_24h ?? null,
  };
}

export async function fetchCoinGeckoMarketSnapshot(): Promise<Coin[]> {
  const now = Date.now();

  if (cache && now - cache.timestamp < TTL_MS) {
    return cache.data;
  }

  const res = await fetch(COINGECKO_ENDPOINT, {
    headers: { "User-Agent": "CoinCanvas/1.0 (+vercel.app)" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`CoinGecko failed with ${res.status}`);
  }

  const payload = (await res.json()) as Array<Partial<Coin>>;
  const data = Array.isArray(payload) ? payload.map(normalizeCoin) : [];

  cache = {
    data,
    timestamp: now,
  };

  return data;
}

export function getCoinByQuery(coins: Coin[], id?: string | null, symbol?: string | null) {
  const normalizedId = id?.trim().toLowerCase();
  const normalizedSymbol = symbol?.trim().toLowerCase();

  return (
    coins.find((coin) => normalizedId && coin.id.toLowerCase() === normalizedId) ??
    coins.find((coin) => normalizedSymbol && coin.symbol.toLowerCase() === normalizedSymbol) ??
    null
  );
}
