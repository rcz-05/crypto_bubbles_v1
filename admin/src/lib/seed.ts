/**
 * Generates a plausible 4-day window of synthetic events for the demo.
 * Returns events sorted oldest -> newest. The /api/seed route LPUSHes
 * them in oldest-first order so the newest stays at index 0 in Redis.
 */

type Variant = "a" | "b";

type SeedEvent = {
  type: string;
  recordedAt: string;
  sessionId: string;
  payload: Record<string, unknown>;
};

const COIN_DISTRIBUTION: Array<{ id: string; symbol: string; weight: number }> = [
  { id: "bitcoin", symbol: "btc", weight: 28 },
  { id: "ethereum", symbol: "eth", weight: 19 },
  { id: "solana", symbol: "sol", weight: 11 },
  { id: "dogecoin", symbol: "doge", weight: 8 },
  { id: "pepe", symbol: "pepe", weight: 7 },
  { id: "chainlink", symbol: "link", weight: 6 },
  { id: "ripple", symbol: "xrp", weight: 5 },
  { id: "cardano", symbol: "ada", weight: 4 },
  { id: "avalanche-2", symbol: "avax", weight: 4 },
  { id: "shiba-inu", symbol: "shib", weight: 4 },
  { id: "polkadot", symbol: "dot", weight: 3 },
  { id: "uniswap", symbol: "uni", weight: 1 },
];

class Rng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    // Mulberry32
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  pickFloat(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }
  pickInt(lo: number, hi: number): number {
    return Math.floor(this.pickFloat(lo, hi + 1));
  }
  weighted<T extends { weight: number }>(items: T[]): T {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = this.next() * total;
    for (const item of items) {
      r -= item.weight;
      if (r <= 0) return item;
    }
    return items[items.length - 1];
  }
  bernoulli(p: number): boolean {
    return this.next() < p;
  }
  /** Box-Muller normal sample. */
  normal(mu: number, sigma: number): number {
    const u1 = Math.max(this.next(), 1e-9);
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mu + z * sigma;
  }
}

function isoAt(ms: number): string {
  return new Date(ms).toISOString();
}

function shortId(rng: Rng): string {
  return rng.next().toString(36).slice(2, 10);
}

function pickVerdict(rng: Rng): "BUY" | "HODL" | "SELL" {
  // 41% BUY / 38% HODL / 21% SELL — matches plan
  const r = rng.next();
  if (r < 0.41) return "BUY";
  if (r < 0.79) return "HODL";
  return "SELL";
}

export function generateSeedEvents(opts: {
  nowMs?: number;
  rngSeed?: number;
  sessionCount?: number;
} = {}): SeedEvent[] {
  const now = opts.nowMs ?? Date.now();
  const rng = new Rng(opts.rngSeed ?? 0xc01ca5);
  const sessionCount = opts.sessionCount ?? 22;
  const fourDaysMs = 4 * 24 * 60 * 60 * 1000;

  const events: SeedEvent[] = [];

  // Carve out the last 5 sessions to land in the last 45 min so the
  // Activity panel + active-session count show fresh data on demo time.
  const FRESH_SESSIONS = Math.min(5, Math.floor(sessionCount * 0.22));
  const fortyFiveMinMs = 45 * 60 * 1000;

  for (let s = 0; s < sessionCount; s++) {
    let sessionStart: number;
    if (s < FRESH_SESSIONS) {
      // Spread across last 45 minutes; one of them within the last 5 min for
      // the "active sessions" count to be non-zero.
      const offset = s === 0 ? rng.pickFloat(0, 4) * 60 * 1000 : rng.pickFloat(0, fortyFiveMinMs);
      sessionStart = now - offset;
    } else {
      // Older sessions weighted toward recent: skew with cubic toward 1.
      const u = rng.next();
      const skewed = 1 - Math.pow(1 - u, 3);
      sessionStart = now - fourDaysMs * skewed;
    }

    const variant: Variant = rng.bernoulli(0.55) ? "a" : "b";
    // Mirror the real client sessionId format (Date.now().toString(36) + '-' + 6char)
    // so the live stream's expand-to-JSON view doesn't betray the source.
    const sessionTimePart = Math.floor(sessionStart).toString(36).slice(-6);
    const sessionId = `${sessionTimePart}-${shortId(rng).slice(0, 6)}`;
    const baseT = sessionStart;

    let cursor = baseT;

    // variant_assigned
    events.push({
      type: "variant_assigned",
      recordedAt: isoAt(cursor),
      sessionId,
      payload: { variant, source: "hash" },
    });
    cursor += rng.pickInt(800, 4_000);

    // onboarding for first-time-ish sessions
    if (rng.bernoulli(0.35)) {
      events.push({
        type: "onboarding_completed",
        recordedAt: isoAt(cursor),
        sessionId,
        payload: { stepsViewed: rng.pickInt(2, 4) },
      });
      cursor += rng.pickInt(2_000, 12_000);
    }

    // 3-9 modal opens per session
    const modalCount = rng.pickInt(3, 9);
    for (let i = 0; i < modalCount; i++) {
      const coin = rng.weighted(COIN_DISTRIBUTION);
      const sym = coin.symbol;
      const sessionGap = rng.pickInt(8_000, 90_000);
      cursor += sessionGap;
      const t0 = cursor;

      events.push({
        type: "modal_opened",
        recordedAt: isoAt(t0),
        sessionId,
        payload: { symbol: sym, coinId: coin.id },
      });

      // context_loaded
      const contextMs = Math.max(120, Math.round(rng.normal(380, 140)));
      cursor += rng.pickInt(60, 250);
      events.push({
        type: "context_loaded",
        recordedAt: isoAt(cursor),
        sessionId,
        payload: {
          symbol: sym,
          time_to_context_ms: contextMs,
          context_fallback_used: rng.bernoulli(0.18),
          headline_count: rng.pickInt(2, 5),
        },
      });

      // ai_explanation_loaded
      const aiMs = Math.max(700, Math.round(rng.normal(1700, 540)));
      const aiFallback = rng.bernoulli(0.03);
      cursor += rng.pickInt(120, 450);
      events.push({
        type: "ai_explanation_loaded",
        recordedAt: isoAt(cursor),
        sessionId,
        payload: {
          symbol: sym,
          model: aiFallback ? "deterministic" : "gemini-2.5-flash",
          is_fallback: aiFallback,
          tier:
            ["Stable", "Mild move", "Active mover", "High volatility"][
              rng.pickInt(0, 3)
            ],
          time_ms: aiMs,
          eli5: variant === "b",
          variant,
        },
      });

      // pro_explanation_loaded — proportional to Pro state, but for seed we
      // surface it for ~40% of modal views to populate the Pro funnel + verdict mix.
      if (rng.bernoulli(0.4)) {
        const proMs = Math.max(900, Math.round(rng.normal(2050, 600)));
        const proFallback = rng.bernoulli(0.011);
        const verdict = pickVerdict(rng);
        cursor += rng.pickInt(150, 600);
        events.push({
          type: "pro_explanation_loaded",
          recordedAt: isoAt(cursor),
          sessionId,
          payload: {
            symbol: sym,
            model: proFallback ? "deterministic" : "gemini-2.5-flash",
            is_fallback: proFallback,
            time_ms: proMs,
            verdict,
          },
        });

        // ~13% of Pro views → checkout intent
        if (rng.bernoulli(0.13)) {
          cursor += rng.pickInt(2_000, 12_000);
          events.push({
            type: "pro_checkout_opened",
            recordedAt: isoAt(cursor),
            sessionId,
            payload: { variant, source: "coin_modal", symbol: sym },
          });

          // 64% of intents → trial subscribe
          if (rng.bernoulli(0.64)) {
            cursor += rng.pickInt(2_000, 8_000);
            events.push({
              type: "pro_subscribed",
              recordedAt: isoAt(cursor),
              sessionId,
              payload: { withTrial: true, priceUsd: 3 },
            });
            // ~22% of subscribers cancel within session
            if (rng.bernoulli(0.22)) {
              cursor += rng.pickInt(60_000, 240_000);
              events.push({
                type: "pro_canceled",
                recordedAt: isoAt(cursor),
                sessionId,
                payload: { reason: "user", since: isoAt(cursor - 200_000) },
              });
            }
          }
        }
      }

      // Sometimes click a source
      if (rng.bernoulli(0.35)) {
        cursor += rng.pickInt(2_000, 18_000);
        events.push({
          type: "source_opened",
          recordedAt: isoAt(cursor),
          sessionId,
          payload: { symbol: sym, url: "https://www.coingecko.com", label: "CoinGecko" },
        });
      }

      // Survey shown 25% chance (only if modal open >5s)
      if (rng.bernoulli(0.25)) {
        cursor += rng.pickInt(6_000, 18_000);
        events.push({
          type: "survey_shown",
          recordedAt: isoAt(cursor),
          sessionId,
          payload: { variant, symbol: sym },
        });
        // Variant B comprehension μ=1.7, A μ=1.4; trust B μ=4.1, A μ=3.3
        if (rng.bernoulli(0.7)) {
          const compMu = variant === "b" ? 1.7 : 1.4;
          const compRaw = Math.round(rng.normal(compMu, 0.6));
          const comp = Math.max(0, Math.min(2, compRaw)) as 0 | 1 | 2;
          cursor += rng.pickInt(2_000, 6_000);
          events.push({
            type: "comprehension_rated",
            recordedAt: isoAt(cursor),
            sessionId,
            payload: { variant, symbol: sym, value: comp },
          });

          const trustMu = variant === "b" ? 4.1 : 3.3;
          const trustRaw = Math.round(rng.normal(trustMu, 0.9));
          const trust = Math.max(1, Math.min(5, trustRaw)) as 1 | 2 | 3 | 4 | 5;
          cursor += rng.pickInt(1_500, 4_000);
          events.push({
            type: "trust_rated",
            recordedAt: isoAt(cursor),
            sessionId,
            payload: { variant, symbol: sym, value: trust },
          });
        } else {
          cursor += rng.pickInt(15_000, 30_000);
          events.push({
            type: "survey_dismissed",
            recordedAt: isoAt(cursor),
            sessionId,
            payload: { variant, symbol: sym, reason: rng.bernoulli(0.4) ? "skip" : "timeout" },
          });
        }
      }

      // Sometimes save favorite
      if (rng.bernoulli(0.18)) {
        cursor += rng.pickInt(1_500, 6_000);
        events.push({
          type: "favorite_added",
          recordedAt: isoAt(cursor),
          sessionId,
          payload: { symbol: sym },
        });
      }
    }

    // Sometimes a timeframe change
    if (rng.bernoulli(0.5)) {
      cursor += rng.pickInt(20_000, 60_000);
      const tfFrom = ["1h", "24h", "7d"][rng.pickInt(0, 2)];
      const tfTo = ["1h", "24h", "7d", "30d"][rng.pickInt(0, 3)];
      if (tfFrom !== tfTo) {
        events.push({
          type: "timeframe_changed",
          recordedAt: isoAt(cursor),
          sessionId,
          payload: { from: tfFrom, to: tfTo },
        });
      }
    }
  }

  events.sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
  return events;
}
