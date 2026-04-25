import { AdminEvent, Variant, getSymbol, getVariant } from "@/lib/events";

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

export type AbStats = {
  variants: Record<
    Variant,
    {
      sessions: number;
      modalOpens: number;
      surveysShown: number;
      comprehensionN: number;
      comprehensionAvg: number | null;
      trustN: number;
      trustAvg: number | null;
    }
  >;
  effect: {
    comprehension: number | null;
    trust: number | null;
  };
};

export type ProFunnelStats = {
  views: number;
  intent: number;
  subscribed: number;
  canceled: number;
  byVariant: Record<
    Variant,
    {
      views: number;
      intent: number;
      subscribed: number;
    }
  >;
  verdictMix: { buy: number; hodl: number; sell: number };
};

export type PerformanceStats = {
  contextAvgMs: number | null;
  contextP95Ms: number | null;
  aiAvgMs: number | null;
  aiP95Ms: number | null;
  proAvgMs: number | null;
  proP95Ms: number | null;
  fallbackRateFreePct: number | null;
  fallbackRateProPct: number | null;
  fallbackByCoin: Array<{ symbol: string; rate: number; n: number }>;
};

export type DashboardStats = {
  generatedAt: string;
  totalEvents: number;
  activity: ActivityStats;
  abTest: AbStats;
  proFunnel: ProFunnelStats;
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

  // Bucket events per minute (60 buckets, oldest first).
  const buckets = new Array<number>(SPARKLINE_BUCKETS).fill(0);
  for (const e of lastHour) {
    const age = now - timestamp(e);
    const idx = SPARKLINE_BUCKETS - 1 - Math.floor(age / 60_000);
    if (idx >= 0 && idx < SPARKLINE_BUCKETS) buckets[idx] += 1;
  }

  const coinCounts = new Map<string, number>();
  for (const e of lastHour) {
    if (e.type !== "modal_opened") continue;
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
    uniqueSessions,
    activeSessions,
    eventsPerMinute: buckets,
    topCoinsLastHour,
  };
}

function buildAbTest(events: AdminEvent[]): AbStats {
  const variants: AbStats["variants"] = {
    a: {
      sessions: 0,
      modalOpens: 0,
      surveysShown: 0,
      comprehensionN: 0,
      comprehensionAvg: null,
      trustN: 0,
      trustAvg: null,
    },
    b: {
      sessions: 0,
      modalOpens: 0,
      surveysShown: 0,
      comprehensionN: 0,
      comprehensionAvg: null,
      trustN: 0,
      trustAvg: null,
    },
  };

  // Variant per session — first variant_assigned wins.
  const sessionVariant = new Map<string, Variant>();
  for (const e of events) {
    if (e.type !== "variant_assigned" && e.type !== "variant_overridden") continue;
    const v = getVariant(e);
    if (!v) continue;
    if (!sessionVariant.has(e.sessionId)) {
      sessionVariant.set(e.sessionId, v);
    }
  }

  for (const [, v] of sessionVariant.entries()) {
    variants[v].sessions += 1;
  }

  const compScores: Record<Variant, number[]> = { a: [], b: [] };
  const trustScores: Record<Variant, number[]> = { a: [], b: [] };

  for (const e of events) {
    const v = getVariant(e) ?? sessionVariant.get(e.sessionId) ?? null;
    if (e.type === "modal_opened" && v) {
      variants[v].modalOpens += 1;
    }
    if (e.type === "survey_shown" && v) {
      variants[v].surveysShown += 1;
    }
    if (e.type === "comprehension_rated" && v) {
      const value = (e.payload as { value?: unknown } | undefined)?.value;
      if (typeof value === "number") compScores[v].push(value);
    }
    if (e.type === "trust_rated" && v) {
      const value = (e.payload as { value?: unknown } | undefined)?.value;
      if (typeof value === "number") trustScores[v].push(value);
    }
  }

  for (const v of ["a", "b"] as const) {
    variants[v].comprehensionN = compScores[v].length;
    variants[v].comprehensionAvg = avg(compScores[v]);
    variants[v].trustN = trustScores[v].length;
    variants[v].trustAvg = avg(trustScores[v]);
  }

  const compEffect =
    variants.a.comprehensionAvg != null && variants.b.comprehensionAvg != null
      ? variants.b.comprehensionAvg - variants.a.comprehensionAvg
      : null;
  const trustEffect =
    variants.a.trustAvg != null && variants.b.trustAvg != null
      ? variants.b.trustAvg - variants.a.trustAvg
      : null;

  return {
    variants,
    effect: { comprehension: compEffect, trust: trustEffect },
  };
}

function buildProFunnel(events: AdminEvent[]): ProFunnelStats {
  let views = 0;
  let intent = 0;
  let subscribed = 0;
  let canceled = 0;
  const byVariant: ProFunnelStats["byVariant"] = {
    a: { views: 0, intent: 0, subscribed: 0 },
    b: { views: 0, intent: 0, subscribed: 0 },
  };
  const verdictMix = { buy: 0, hodl: 0, sell: 0 };

  // Session variant lookup for events that don't carry variant directly.
  const sessionVariant = new Map<string, Variant>();
  for (const e of events) {
    if (e.type !== "variant_assigned" && e.type !== "variant_overridden") continue;
    const v = getVariant(e);
    if (!v) continue;
    if (!sessionVariant.has(e.sessionId)) sessionVariant.set(e.sessionId, v);
  }

  for (const e of events) {
    const variant =
      getVariant(e) ?? sessionVariant.get(e.sessionId) ?? null;

    // Pro card view — counts pro_explanation_loaded events (one per modal Pro card view).
    if (e.type === "pro_explanation_loaded") {
      views += 1;
      if (variant) byVariant[variant].views += 1;
      const verdict = (e.payload as { verdict?: unknown } | undefined)?.verdict;
      if (verdict === "BUY") verdictMix.buy += 1;
      else if (verdict === "HODL") verdictMix.hodl += 1;
      else if (verdict === "SELL") verdictMix.sell += 1;
    }

    // Intent — roll up legacy premium_intent_clicked + new pro_checkout_opened.
    if (
      e.type === "pro_checkout_opened" ||
      e.type === "premium_intent_clicked"
    ) {
      intent += 1;
      if (variant) byVariant[variant].intent += 1;
    }

    if (e.type === "pro_subscribed") {
      subscribed += 1;
      if (variant) byVariant[variant].subscribed += 1;
    }
    if (e.type === "pro_canceled") {
      canceled += 1;
    }
  }

  return { views, intent, subscribed, canceled, byVariant, verdictMix };
}

function buildPerformance(events: AdminEvent[]): PerformanceStats {
  const contextLatencies: number[] = [];
  const aiLatencies: number[] = [];
  const proLatencies: number[] = [];
  let aiTotal = 0;
  let aiFallback = 0;
  let proTotal = 0;
  let proFallback = 0;
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
    if (e.type === "pro_explanation_loaded" && typeof p.time_ms === "number") {
      proLatencies.push(p.time_ms);
      proTotal += 1;
      if (p.is_fallback === true) proFallback += 1;
    }
  }

  const sortedContext = [...contextLatencies].sort((a, b) => a - b);
  const sortedAi = [...aiLatencies].sort((a, b) => a - b);
  const sortedPro = [...proLatencies].sort((a, b) => a - b);

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
    proAvgMs: avg(proLatencies),
    proP95Ms: percentile(sortedPro, 95),
    fallbackRateFreePct: aiTotal > 0 ? (aiFallback / aiTotal) * 100 : null,
    fallbackRateProPct: proTotal > 0 ? (proFallback / proTotal) * 100 : null,
    fallbackByCoin: fallbackList,
  };
}

export function aggregate(events: AdminEvent[], nowMs?: number): DashboardStats {
  const now = nowMs ?? Date.now();
  return {
    generatedAt: new Date(now).toISOString(),
    totalEvents: events.length,
    activity: buildActivity(events, now),
    abTest: buildAbTest(events),
    proFunnel: buildProFunnel(events),
    performance: buildPerformance(events),
  };
}
