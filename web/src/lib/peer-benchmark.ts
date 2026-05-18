import type { Coin } from "@/lib/coingecko";

export type PeerBenchmark = {
  cohortLabel: string;
  peers: Array<{
    symbol: string;
    name: string;
    rank: number | null;
    change24h: number;
    change7d: number | null;
  }>;
  peerAvg24h: number | null;
  peerAvg7d: number | null;
  selfAvgGap24h: number | null;
  selfAvgGap7d: number | null;
  peerAvgIntradayRangePct: number | null;
};

const MAX_PEERS = 5;

function getIntradayRangePct(c: Coin): number | null {
  if (!c.high_24h || !c.low_24h || c.low_24h <= 0) return null;
  return ((c.high_24h - c.low_24h) / c.low_24h) * 100;
}

function avg(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (!filtered.length) return null;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

function cohortLabel(rank: number | null): string {
  if (rank == null) return "Top-100 cohort";
  if (rank <= 10) return "Top-10 large caps";
  if (rank <= 25) return "Top-25 large caps";
  if (rank <= 50) return "Mid-cap cohort";
  return "Lower top-100 cohort";
}

export function buildPeerBenchmark(
  self: Coin,
  universe: Coin[],
): PeerBenchmark {
  const others = universe.filter((c) => c.id !== self.id);
  const selfRank = self.market_cap_rank;

  let peers: Coin[];
  if (selfRank != null) {
    const sorted = [...others]
      .filter((c) => c.market_cap_rank != null)
      .sort((a, b) => {
        const da = Math.abs((a.market_cap_rank ?? 0) - selfRank);
        const db = Math.abs((b.market_cap_rank ?? 0) - selfRank);
        return da - db;
      });
    peers = sorted.slice(0, MAX_PEERS);
  } else {
    const sorted = [...others].sort(
      (a, b) => Math.abs(b.market_cap - self.market_cap) - Math.abs(a.market_cap - self.market_cap),
    );
    peers = sorted.slice(0, MAX_PEERS);
  }

  const peerAvg24h = avg(peers.map((p) => p.price_change_percentage_24h));
  const peerAvg7d = avg(peers.map((p) => p.price_change_percentage_7d_in_currency));
  const peerAvgIntradayRangePct = avg(peers.map((p) => getIntradayRangePct(p)));

  const self24h = self.price_change_percentage_24h ?? 0;
  const self7d = self.price_change_percentage_7d_in_currency ?? null;

  return {
    cohortLabel: cohortLabel(selfRank),
    peers: peers.map((p) => ({
      symbol: p.symbol.toUpperCase(),
      name: p.name,
      rank: p.market_cap_rank,
      change24h: p.price_change_percentage_24h ?? 0,
      change7d: p.price_change_percentage_7d_in_currency ?? null,
    })),
    peerAvg24h,
    peerAvg7d,
    selfAvgGap24h: peerAvg24h != null ? self24h - peerAvg24h : null,
    selfAvgGap7d:
      peerAvg7d != null && self7d != null ? self7d - peerAvg7d : null,
    peerAvgIntradayRangePct,
  };
}

export type VolatilityProfile = {
  intradayRangePct: number | null;
  peerAvgRangePct: number | null;
  gapVsPeerPct: number | null;
  label: "Below average" | "In line" | "Above average" | "Unknown";
};

export function buildVolatilityProfile(
  self: Coin,
  benchmark: PeerBenchmark,
): VolatilityProfile {
  const intraday = getIntradayRangePct(self);
  const peer = benchmark.peerAvgIntradayRangePct;

  if (intraday == null || peer == null) {
    return {
      intradayRangePct: intraday,
      peerAvgRangePct: peer,
      gapVsPeerPct: null,
      label: "Unknown",
    };
  }

  const gap = intraday - peer;
  let label: VolatilityProfile["label"];
  if (Math.abs(gap) < peer * 0.15) {
    label = "In line";
  } else if (gap > 0) {
    label = "Above average";
  } else {
    label = "Below average";
  }

  return {
    intradayRangePct: intraday,
    peerAvgRangePct: peer,
    gapVsPeerPct: gap,
    label,
  };
}
