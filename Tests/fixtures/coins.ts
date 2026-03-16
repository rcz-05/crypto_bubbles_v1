import type { Coin } from "../../web/src/lib/coingecko";

export function makeCoin(overrides: Partial<Coin> = {}): Coin {
  return {
    id: "bitcoin",
    symbol: "btc",
    name: "Bitcoin",
    current_price: 64257,
    price_change_percentage_24h: 4.7,
    market_cap: 1_250_000_000_000,
    image: "https://assets.example.test/btc.png",
    market_cap_rank: 1,
    total_volume: 130_000_000_000,
    high_24h: 65000,
    low_24h: 61000,
    ...overrides,
  };
}

export const marketCoins: Coin[] = [
  makeCoin(),
  makeCoin({
    id: "ethereum",
    symbol: "eth",
    name: "Ethereum",
    current_price: 3250,
    price_change_percentage_24h: -2.1,
    market_cap: 450_000_000_000,
    image: "https://assets.example.test/eth.png",
    market_cap_rank: 2,
    total_volume: 35_000_000_000,
    high_24h: 3400,
    low_24h: 3200,
  }),
  makeCoin({
    id: "solana",
    symbol: "sol",
    name: "Solana",
    current_price: 185,
    price_change_percentage_24h: 9.8,
    market_cap: 85_000_000_000,
    image: "https://assets.example.test/sol.png",
    market_cap_rank: 5,
    total_volume: 20_000_000_000,
    high_24h: 190,
    low_24h: 160,
  }),
];

export const fallbackCoin = makeCoin({
  id: "pepe",
  symbol: "pepe",
  name: "Pepe",
  current_price: 0.000012,
  price_change_percentage_24h: 12.4,
  market_cap: 5_000_000_000,
  image: "https://assets.example.test/pepe.png",
  market_cap_rank: 42,
  total_volume: 1_100_000_000,
  high_24h: 0.000013,
  low_24h: 0.000010,
});
