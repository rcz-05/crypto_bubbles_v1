import { AdminEvent, getSymbol } from "@/lib/events";

const ACTIVE_SESSION_WINDOW_MS = 5 * 60_000;
const SPARKLINE_BUCKETS = 60;
const SPARKLINE_WINDOW_MS = 60 * 60_000;

export type ActivityStats = {
  totalEventsLastHour: number;
  activeSessions: number;
  uniqueSessions: number;
  eventsPerMinute: number[];
  topCoinsLastHour: Array<{ symbol: string; views: number }>;
};

export type PerformanceStats = {
  contextAvgMs: number | null;
  contextP95Ms: number | null;
  aiAvgMs: number | null;
  aiP95Ms: number | null;
  fallbackRatePct: number | null;
  fallbackByCoin: Array<{ symbol: string; rate: number; n: number }>;
  explanationFailures: number;
  contextFailures: number;
};

export type DashboardStats = {
  generatedAt: string;
  totalEvents: number;
  activity: ActivityStats;
  performance: PerformanceStats;
};

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function percentile(sorted: number[], pct: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((pct / 100) * sorted.length)),
  );
  return sorted[idx];
}

function timestamp(event: AdminEvent): number {
  return Date.parse(event.recordedAt);
}

function buildActivity(events: AdminEvent[], now: number): ActivityStats {
  const lastHour = events.filter(
    (e) => now - timestamp(e) <= SPARKLINE_WINDOW_MS,
  );
  const totalEventsLastHour = lastHour.length;
  const uniqueSessions = new Set(lastHour.map((e) => e.sessionId)).size;
  const activeSessions = new Set(
    events
      .filter((e) => now - timestamp(e) <= ACTIVE_SESSION_WINDOW_MS)
      .map((e) => e.sessionId),
  ).size;

  const buckets = new Array<number>(SPARKLINE_BUCKETS).fill(0);
  for (const e of lastHour) {
    const age = now - timestamp(e);
    const idx = SPARKLINE_BUCKETS - 1 - Math.floor(age / 60_000);
    if (idx >= 0 && idx < SPARKLINE_BUCKETS) buckets[idx] += 1;
  }

  const coinCounts = new Map<string, number>();
  for (const e of lastHour) {
    if (e.type !== "modal_opened" && e.type !== "favorite_opened") continue;
    const s = getSymbol(e);
    if (!s) continue;
    coinCounts.set(s, (coinCounts.get(s) ?? 0) + 1);
  }

  const topCoinsLastHour = Array.from(coinCounts.entries())
    .map(([symbol, views]) => ({ symbol, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);

  return {
    totalEventsLastHour,
    activeSessions,
    uniqueSessions,
    eventsPerMinute: buckets,
    topCoinsLastHour,
  };
}

function buildPerformance(events: AdminEvent[]): PerformanceStats {
  const contextLatencies: number[] = [];
  const aiLatencies: number[] = [];
  let aiTotal = 0;
  let aiFallback = 0;
  let explanationFailures = 0;
  let contextFailures = 0;
  const fallbackByCoin = new Map<string, { fallback: number; total: number }>();

  for (const e of events) {
    const p = (e.payload ?? {}) as {
      time_ms?: unknown;
      time_to_context_ms?: unknown;
      is_fallback?: unknown;
      symbol?: unknown;
    };

    if (e.type === "context_loaded" && typeof p.time_to_context_ms === "number") {
      contextLatencies.push(p.time_to_context_ms);
    }
    if (e.type === "context_failed") {
      contextFailures += 1;
    }
    if (e.type === "ai_explanation_failed") {
      explanationFailures += 1;
    }
    if (e.type === "ai_explanation_loaded" && typeof p.time_ms === "number") {
      aiLatencies.push(p.time_ms);
      aiTotal += 1;
      if (p.is_fallback === true) aiFallback += 1;
      if (typeof p.symbol === "string") {
        const sym = p.symbol.toUpperCase();
        const cur = fallbackByCoin.get(sym) ?? { fallback: 0, total: 0 };
        cur.total += 1;
        if (p.is_fallback === true) cur.fallback += 1;
        fallbackByCoin.set(sym, cur);
      }
    }
  }

  const sortedContext = [...contextLatencies].sort((a, b) => a - b);
  const sortedAi = [...aiLatencies].sort((a, b) => a - b);

  const fallbackList = Array.from(fallbackByCoin.entries())
    .filter(([, v]) => v.total >= 2)
    .map(([symbol, v]) => ({
      symbol,
      rate: v.fallback / v.total,
      n: v.total,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);

  return {
    contextAvgMs: avg(contextLatencies),
    contextP95Ms: percentile(sortedContext, 95),
    aiAvgMs: avg(aiLatencies),
    aiP95Ms: percentile(sortedAi, 95),
    fallbackRatePct: aiTotal > 0 ? (aiFallback / aiTotal) * 100 : null,
    fallbackByCoin: fallbackList,
    explanationFailures,
    contextFailures,
  };
}

export function aggregate(events: AdminEvent[], nowMs?: number): DashboardStats {
  const now = nowMs ?? Date.now();
  return {
    generatedAt: new Date(now).toISOString(),
    totalEvents: events.length,
    activity: buildActivity(events, now),
    performance: buildPerformance(events),
  };
}
