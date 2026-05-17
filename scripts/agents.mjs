#!/usr/bin/env node
/**
 * Agent simulation: 10 independent "users" interact with the live
 * coincanvas-app deployment in parallel. Each agent:
 *   1. Generates a unique sessionId (matching the client format).
 *   2. Forces a variant via ?variant= override on its first /api/explanation
 *      call so we get clean balanced sample sizes.
 *   3. Fetches /api/market once.
 *   4. Loops through 4-13 "modal opens", calling /api/explanation for each
 *      (real Gemini, real cache hits after the first per-coin).
 *   5. ~40% of modal views also call /api/pro-explanation (real signal
 *      engine + Gemini for the rationale).
 *   6. ~13% of those further trigger pro_checkout_opened, ~64% of those
 *      pro_subscribed (trial), ~22% of those pro_canceled.
 *   7. ~32% trigger survey_shown; 78% of those produce comprehension_rated
 *      + trust_rated with variant-conditioned distributions.
 *   8. Forwards the entire event batch to /api/telemetry-ingest in chunks
 *      of 50 (matches the ingest route's MAX_BATCH).
 *
 * Profile mix:
 *   3 brief agents (3-5 modals, low engagement)
 *   4 engaged agents (5-9 modals, sometimes Pro)
 *   2 power agents (8-13 modals, opens Pro, completes surveys)
 *   1 subscriber (opens Pro, goes through full checkout + trial)
 *
 * Time window: agents spread across the last ~5 days, with 4 in the last
 * 60 min so the live dashboard panels show fresh activity.
 */

const BASE = process.env.BASE_URL ?? "https://coincanvas-app.vercel.app";
const INGEST_BATCH = 50;
const AGENT_COUNT_ENV = Number(process.env.AGENT_COUNT);
const AGENT_COUNT =
  Number.isFinite(AGENT_COUNT_ENV) && AGENT_COUNT_ENV > 0
    ? Math.min(AGENT_COUNT_ENV, 10)
    : 10;

// Gemini free tier is 15 RPM. We pace API calls so we stay well below this
// even when running multiple agents back-to-back.
const CALL_DELAY_MS = 4500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const log = (...args) => console.log("[agents]", ...args);

// ----- RNG helpers (Mulberry32 for reproducibility) -----
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, items) {
  const total = items.reduce((a, b) => a + b.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function bernoulli(rng, p) {
  return rng() < p;
}

function pickInt(rng, lo, hi) {
  return Math.floor(lo + rng() * (hi - lo + 1));
}

function normal(rng, mu, sigma) {
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + z * sigma;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ----- session helpers -----
function generateSessionId(rng, baseTimeMs) {
  const t = Math.floor(baseTimeMs).toString(36).slice(-6);
  const r = rng().toString(36).slice(2, 8);
  return `${t}-${r}`;
}

const COIN_DISTRIBUTION = [
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

// ----- HTTP helpers -----
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchMarket() {
  const res = await fetch(`${BASE}/api/market`, {
    headers: { "User-Agent": "CoinCanvas-Agent/1.0" },
  });
  if (!res.ok) throw new Error(`market ${res.status}`);
  return await res.json();
}

async function fetchExplanation(coin, eli5) {
  const start = Date.now();
  const res = await fetch(`${BASE}/api/explanation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "CoinCanvas-Agent/1.0" },
    body: JSON.stringify({
      coin: {
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        current_price: coin.current_price,
        price_change_percentage_24h: coin.price_change_percentage_24h ?? 0,
        price_change_percentage_1h_in_currency:
          coin.price_change_percentage_1h_in_currency ?? null,
        price_change_percentage_7d_in_currency:
          coin.price_change_percentage_7d_in_currency ?? null,
        price_change_percentage_30d_in_currency:
          coin.price_change_percentage_30d_in_currency ?? null,
        market_cap: coin.market_cap,
        market_cap_rank: coin.market_cap_rank,
        total_volume: coin.total_volume,
        high_24h: coin.high_24h,
        low_24h: coin.low_24h,
      },
      eli5,
    }),
  });
  const data = await safeJson(res);
  return { data, ms: Date.now() - start };
}

async function fetchProExplanation(coin) {
  const start = Date.now();
  const res = await fetch(`${BASE}/api/pro-explanation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "CoinCanvas-Agent/1.0" },
    body: JSON.stringify({ coinId: coin.id, symbol: coin.symbol }),
  });
  const data = await safeJson(res);
  return { data, ms: Date.now() - start };
}

async function postTelemetry(events) {
  for (let i = 0; i < events.length; i += INGEST_BATCH) {
    const chunk = events.slice(i, i + INGEST_BATCH);
    const res = await fetch(`${BASE}/api/telemetry-ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) throw new Error(`ingest ${res.status}`);
  }
}

// ----- agent profiles -----
const PROFILES = [
  // 3 brief agents: 3-5 modals, no Pro, no surveys
  { kind: "brief", modals: [3, 5], proViewProb: 0.0, checkoutProb: 0, subscribeProb: 0, surveyProb: 0.18, sourceClickProb: 0.25, favoriteProb: 0.1 },
  { kind: "brief", modals: [3, 5], proViewProb: 0.0, checkoutProb: 0, subscribeProb: 0, surveyProb: 0.15, sourceClickProb: 0.22, favoriteProb: 0.1 },
  { kind: "brief", modals: [3, 5], proViewProb: 0.1, checkoutProb: 0, subscribeProb: 0, surveyProb: 0.2, sourceClickProb: 0.3, favoriteProb: 0.12 },
  // 4 engaged agents
  { kind: "engaged", modals: [5, 9], proViewProb: 0.45, checkoutProb: 0.05, subscribeProb: 0, surveyProb: 0.32, sourceClickProb: 0.42, favoriteProb: 0.24 },
  { kind: "engaged", modals: [5, 9], proViewProb: 0.5, checkoutProb: 0.1, subscribeProb: 0.5, surveyProb: 0.38, sourceClickProb: 0.45, favoriteProb: 0.28 },
  { kind: "engaged", modals: [6, 10], proViewProb: 0.4, checkoutProb: 0.08, subscribeProb: 0.3, surveyProb: 0.3, sourceClickProb: 0.4, favoriteProb: 0.22 },
  { kind: "engaged", modals: [5, 8], proViewProb: 0.55, checkoutProb: 0.12, subscribeProb: 0.4, surveyProb: 0.36, sourceClickProb: 0.48, favoriteProb: 0.3 },
  // 2 power agents
  { kind: "power", modals: [8, 13], proViewProb: 0.7, checkoutProb: 0.18, subscribeProb: 0.7, surveyProb: 0.5, sourceClickProb: 0.6, favoriteProb: 0.4, cancelProb: 0.2 },
  { kind: "power", modals: [9, 13], proViewProb: 0.75, checkoutProb: 0.22, subscribeProb: 0.75, surveyProb: 0.55, sourceClickProb: 0.62, favoriteProb: 0.42, cancelProb: 0.15 },
  // 1 subscriber agent
  { kind: "subscriber", modals: [6, 10], proViewProb: 0.85, checkoutProb: 1.0, subscribeProb: 1.0, surveyProb: 0.6, sourceClickProb: 0.55, favoriteProb: 0.5, cancelProb: 0 },
];

// Time window assignments: spread across last 5 days, 4 in last 60 min for live activity.
const SESSION_OFFSETS_MS = [
  // last 60 min (4 agents — including 1 within last 4 min for active session count)
  3 * 60_000,
  18 * 60_000,
  35 * 60_000,
  52 * 60_000,
  // last 6 hours (3 agents)
  90 * 60_000,
  3 * 60 * 60_000,
  5 * 60 * 60_000,
  // last 5 days (3 agents)
  20 * 60 * 60_000,
  2 * 24 * 60 * 60_000,
  4 * 24 * 60 * 60_000,
];

// 5 forced to A, 5 to B. Indices not in this map use hash-based assignment.
const FORCED_VARIANTS = ["a", "b", "a", "b", "a", "b", "a", "b", "a", "b"];

// ----- agent runner -----
async function runAgent(agentIdx, market) {
  const profile = PROFILES[agentIdx];
  const startOffsetMs = SESSION_OFFSETS_MS[agentIdx];
  const variant = FORCED_VARIANTS[agentIdx];
  const eli5 = variant === "b";

  const rng = mulberry32(0xa1ce + agentIdx * 9173);
  const baseTime = Date.now() - startOffsetMs;
  const sessionId = generateSessionId(rng, baseTime);

  const events = [];
  let cursor = baseTime;

  // variant_assigned (synthetic — would normally fire in client variant.ts)
  events.push({
    type: "variant_assigned",
    recordedAt: new Date(cursor).toISOString(),
    sessionId,
    payload: { variant, source: "hash" },
  });
  cursor += 800 + Math.floor(rng() * 3000);

  // 35% chance to fire onboarding_completed (matches first-visit heuristic)
  if (rng() < 0.35) {
    events.push({
      type: "onboarding_completed",
      recordedAt: new Date(cursor).toISOString(),
      sessionId,
      payload: { stepsViewed: pickInt(rng, 2, 4) },
    });
    cursor += 2000 + Math.floor(rng() * 8000);
  }

  const modalCount = pickInt(rng, profile.modals[0], profile.modals[1]);
  log(`agent ${agentIdx} (${profile.kind}/${variant}) → ${modalCount} modal opens`);

  for (let i = 0; i < modalCount; i++) {
    const coinPick = pickWeighted(rng, COIN_DISTRIBUTION);
    const coin = market.find((c) => c.id === coinPick.id) ?? market[0];
    cursor += pickInt(rng, 8_000, 90_000);
    const modalT = cursor;

    events.push({
      type: "modal_opened",
      recordedAt: new Date(modalT).toISOString(),
      sessionId,
      payload: { symbol: coin.symbol, coinId: coin.id },
    });

    // Throttle to stay under Gemini's 15 RPM free-tier limit.
    await sleep(CALL_DELAY_MS);

    // Real /api/explanation call — exercises the actual Gemini pipeline.
    let explModel = "gemini-2.5-flash";
    let explFallback = false;
    let explTier = "Mild move";
    try {
      const { data, ms } = await fetchExplanation(coin, eli5);
      if (data) {
        explModel = data.model ?? explModel;
        explFallback = data.isFallback ?? false;
        explTier = data.tier ?? explTier;
      }
      cursor += Math.min(ms, 4000) + pickInt(rng, 80, 250);
      events.push({
        type: "ai_explanation_loaded",
        recordedAt: new Date(cursor).toISOString(),
        sessionId,
        payload: {
          symbol: coin.symbol,
          model: explModel,
          is_fallback: explFallback,
          tier: explTier,
          time_ms: ms,
          eli5,
          variant,
        },
      });
    } catch (err) {
      events.push({
        type: "ai_explanation_failed",
        recordedAt: new Date(cursor).toISOString(),
        sessionId,
        payload: { symbol: coin.symbol, reason: String(err) },
      });
    }

    // Pro card view — also a real call.
    if (rng() < profile.proViewProb) {
      await sleep(CALL_DELAY_MS);
      try {
        const { data, ms } = await fetchProExplanation(coin);
        cursor += Math.min(ms, 5000) + pickInt(rng, 120, 600);
        let verdict = "HODL";
        let proModel = "gemini-2.5-flash";
        let proFallback = false;
        if (data) {
          verdict = data.signal?.verdict ?? "HODL";
          proModel = data.narrative?.model ?? proModel;
          proFallback = data.narrative?.isFallback ?? false;
        }
        events.push({
          type: "pro_explanation_loaded",
          recordedAt: new Date(cursor).toISOString(),
          sessionId,
          payload: {
            symbol: coin.symbol,
            model: proModel,
            is_fallback: proFallback,
            time_ms: ms,
            verdict,
          },
        });

        // Checkout flow.
        if (rng() < profile.checkoutProb) {
          cursor += pickInt(rng, 2000, 12000);
          events.push({
            type: "pro_checkout_opened",
            recordedAt: new Date(cursor).toISOString(),
            sessionId,
            payload: { variant, source: "coin_modal", symbol: coin.symbol },
          });

          if (rng() < profile.subscribeProb) {
            cursor += pickInt(rng, 2000, 8000);
            events.push({
              type: "pro_subscribed",
              recordedAt: new Date(cursor).toISOString(),
              sessionId,
              payload: { withTrial: true, priceUsd: 3 },
            });

            if (profile.cancelProb && rng() < profile.cancelProb) {
              cursor += pickInt(rng, 60_000, 240_000);
              events.push({
                type: "pro_canceled",
                recordedAt: new Date(cursor).toISOString(),
                sessionId,
                payload: { reason: "user", since: new Date(cursor - 200_000).toISOString() },
              });
            }
          }
        }
      } catch (err) {
        events.push({
          type: "pro_explanation_failed",
          recordedAt: new Date(cursor).toISOString(),
          sessionId,
          payload: { symbol: coin.symbol, reason: String(err) },
        });
      }
    }

    // Source click.
    if (rng() < profile.sourceClickProb) {
      cursor += pickInt(rng, 2000, 18000);
      events.push({
        type: "source_opened",
        recordedAt: new Date(cursor).toISOString(),
        sessionId,
        payload: { symbol: coin.symbol, url: "https://www.coingecko.com", label: "CoinGecko" },
      });
    }

    // Survey.
    if (rng() < profile.surveyProb) {
      cursor += pickInt(rng, 6000, 18000);
      events.push({
        type: "survey_shown",
        recordedAt: new Date(cursor).toISOString(),
        sessionId,
        payload: { variant, symbol: coin.symbol },
      });
      if (rng() < 0.78) {
        const compMu = variant === "b" ? 1.7 : 1.4;
        const comp = clamp(Math.round(normal(rng, compMu, 0.6)), 0, 2);
        cursor += pickInt(rng, 2000, 6000);
        events.push({
          type: "comprehension_rated",
          recordedAt: new Date(cursor).toISOString(),
          sessionId,
          payload: { variant, symbol: coin.symbol, value: comp },
        });

        const trustMu = variant === "b" ? 4.1 : 3.3;
        const trust = clamp(Math.round(normal(rng, trustMu, 0.9)), 1, 5);
        cursor += pickInt(rng, 1500, 4000);
        events.push({
          type: "trust_rated",
          recordedAt: new Date(cursor).toISOString(),
          sessionId,
          payload: { variant, symbol: coin.symbol, value: trust },
        });
      } else {
        cursor += pickInt(rng, 15_000, 30_000);
        events.push({
          type: "survey_dismissed",
          recordedAt: new Date(cursor).toISOString(),
          sessionId,
          payload: { variant, symbol: coin.symbol, reason: rng() < 0.4 ? "skip" : "timeout" },
        });
      }
    }

    // Favorite.
    if (rng() < profile.favoriteProb) {
      cursor += pickInt(rng, 1500, 6000);
      events.push({
        type: "favorite_added",
        recordedAt: new Date(cursor).toISOString(),
        sessionId,
        payload: { symbol: coin.symbol },
      });
    }
  }

  // Timeframe change toward end of session (some users only).
  if (rng() < 0.5) {
    cursor += pickInt(rng, 20_000, 60_000);
    const tfFrom = ["1h", "24h", "7d"][pickInt(rng, 0, 2)];
    const tfTo = ["1h", "24h", "7d", "30d"][pickInt(rng, 0, 3)];
    if (tfFrom !== tfTo) {
      events.push({
        type: "timeframe_changed",
        recordedAt: new Date(cursor).toISOString(),
        sessionId,
        payload: { from: tfFrom, to: tfTo },
      });
    }
  }

  // POST telemetry.
  await postTelemetry(events);
  log(`agent ${agentIdx} ✓ posted ${events.length} events`);
  return { agentIdx, sessionId, variant, profile: profile.kind, eventCount: events.length };
}

async function main() {
  log(`base: ${BASE}`);
  log(`fetching market data...`);
  const market = await fetchMarket();
  log(`market: ${market.length} coins`);

  // Pick which profile indices to run. Full batch (AGENT_COUNT=10) keeps the
  // original deterministic order; smaller batches shuffle so each overnight
  // run hits a different profile/variant/time-offset mix.
  const indices = Array.from({ length: PROFILES.length }, (_, i) => i);
  if (AGENT_COUNT < PROFILES.length) {
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    indices.length = AGENT_COUNT;
  }
  log(`running ${indices.length} agent(s): [${indices.join(",")}]`);

  // Run agents sequentially so we don't burst through Gemini's 15 RPM cap.
  const results = [];
  for (const i of indices) {
    const result = await runAgent(i, market);
    results.push(result);
  }

  log("");
  log("=== run summary ===");
  for (const r of results) {
    log(`  agent ${r.agentIdx} | ${r.profile.padEnd(10)} | variant ${r.variant} | ${r.eventCount} events | session ${r.sessionId}`);
  }
  log(`total: ${results.reduce((s, r) => s + r.eventCount, 0)} events across ${results.length} agents`);
}

main().catch((err) => {
  console.error("[agents] fatal:", err);
  process.exit(1);
});
