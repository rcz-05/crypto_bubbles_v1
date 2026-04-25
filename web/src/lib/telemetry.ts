"use client";

export type TelemetryEvent =
  | {
      type: "variant_assigned";
      recordedAt: string;
      sessionId: string;
      payload: { variant: "a" | "b"; source: "hash" | "stored" };
    }
  | {
      type: "variant_overridden";
      recordedAt: string;
      sessionId: string;
      payload: { variant: "a" | "b"; previousVariant: "a" | "b" | null };
    }
  | {
      type: "modal_opened";
      recordedAt: string;
      sessionId: string;
      payload: { symbol: string; coinId: string };
    }
  | {
      type: "context_loaded";
      recordedAt: string;
      sessionId: string;
      payload: { symbol: string; time_to_context_ms: number; context_fallback_used: boolean; headline_count: number };
    }
  | {
      type: "context_failed";
      recordedAt: string;
      sessionId: string;
      payload: { symbol: string; reason: string };
    }
  | {
      type: "source_opened";
      recordedAt: string;
      sessionId: string;
      payload: { symbol: string; url: string; label: string };
    }
  | {
      type: "favorite_added";
      recordedAt: string;
      sessionId: string;
      payload: { symbol: string };
    }
  | {
      type: "favorite_removed";
      recordedAt: string;
      sessionId: string;
      payload: { symbol: string };
    }
  | {
      type: "timeframe_changed";
      recordedAt: string;
      sessionId: string;
      payload: { from: string; to: string };
    }
  | {
      type: "onboarding_completed";
      recordedAt: string;
      sessionId: string;
      payload: { stepsViewed: number };
    }
  | {
      type: "ai_explanation_loaded";
      recordedAt: string;
      sessionId: string;
      payload: {
        symbol: string;
        model: string;
        is_fallback: boolean;
        tier: string;
        time_ms: number;
        eli5: boolean;
        variant?: "a" | "b";
      };
    }
  | {
      type: "ai_explanation_failed";
      recordedAt: string;
      sessionId: string;
      payload: { symbol: string; reason: string };
    }
  | {
      type: "eli5_toggled";
      recordedAt: string;
      sessionId: string;
      payload: { symbol: string; value: boolean };
    }
  | {
      type: "favorite_opened";
      recordedAt: string;
      sessionId: string;
      payload: { symbol: string; source: "favorites_page" | "bubble_board" };
    }
  | {
      type: "survey_shown";
      recordedAt: string;
      sessionId: string;
      payload: { variant: "a" | "b"; symbol: string };
    }
  | {
      type: "survey_dismissed";
      recordedAt: string;
      sessionId: string;
      payload: {
        variant: "a" | "b";
        symbol: string;
        reason: "skip" | "timeout";
      };
    }
  | {
      type: "comprehension_rated";
      recordedAt: string;
      sessionId: string;
      payload: { variant: "a" | "b"; symbol: string; value: 0 | 1 | 2 };
    }
  | {
      type: "trust_rated";
      recordedAt: string;
      sessionId: string;
      payload: { variant: "a" | "b"; symbol: string; value: 1 | 2 | 3 | 4 | 5 };
    }
  | {
      type: "premium_intent_clicked";
      recordedAt: string;
      sessionId: string;
      payload: {
        variant: "a" | "b";
        source: "coin_modal" | "settings";
        symbol?: string;
      };
    }
  | {
      type: "premium_waitlist_submitted";
      recordedAt: string;
      sessionId: string;
      payload: {
        variant: "a" | "b";
        source: "coin_modal" | "settings";
        providedEmail: boolean;
        symbol?: string;
        email?: string;
      };
    }
  | {
      type: "pro_checkout_opened";
      recordedAt: string;
      sessionId: string;
      payload: {
        variant: "a" | "b";
        source: "coin_modal" | "settings";
        symbol?: string;
      };
    }
  | {
      type: "pro_checkout_canceled";
      recordedAt: string;
      sessionId: string;
      payload: {
        variant: "a" | "b";
        source: "coin_modal" | "settings";
        symbol?: string;
      };
    }
  | {
      type: "pro_subscribed";
      recordedAt: string;
      sessionId: string;
      payload: {
        withTrial: boolean;
        priceUsd: number;
      };
    }
  | {
      type: "pro_canceled";
      recordedAt: string;
      sessionId: string;
      payload: {
        reason: "user" | "override";
        since: string | null;
      };
    }
  | {
      type: "pro_explanation_loaded";
      recordedAt: string;
      sessionId: string;
      payload: {
        symbol: string;
        model: string;
        is_fallback: boolean;
        time_ms: number;
        verdict?: "BUY" | "HODL" | "SELL";
      };
    }
  | {
      type: "pro_explanation_failed";
      recordedAt: string;
      sessionId: string;
      payload: { symbol: string; reason: string };
    }
  | {
      type: "bubble_page_changed";
      recordedAt: string;
      sessionId: string;
      payload: {
        from: number;
        to: number;
        timeframe: "1h" | "24h" | "7d" | "30d" | "market_cap";
      };
    };

const STORAGE_KEY = "coincanvas-telemetry";
const SESSION_KEY = "coincanvas-session-id";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getSessionId(): string {
  if (!canUseStorage()) return "unknown";
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = generateId();
    window.sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function loadTelemetry(): TelemetryEvent[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TelemetryEvent[]) : [];
  } catch {
    return [];
  }
}

// Outbound queue for forwarding events to /api/telemetry-ingest. Events are
// batched and flushed periodically (or on visibility change) so we don't fire
// a request per click, but we still get near-real-time updates on the ops
// dashboard.
const FORWARD_QUEUE: TelemetryEvent[] = [];
const FLUSH_INTERVAL_MS = 1500;
const FLUSH_BATCH_LIMIT = 25;
let flushTimer: number | null = null;

function flushForwardQueue() {
  if (flushTimer != null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (FORWARD_QUEUE.length === 0) return;
  const batch = FORWARD_QUEUE.splice(0, FLUSH_BATCH_LIMIT);
  const body = JSON.stringify(batch);
  // Prefer sendBeacon during pagehide so we don't lose the tail; fall back to fetch.
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    try {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/telemetry-ingest", blob);
      return;
    } catch {
      // fall through to fetch
    }
  }
  void fetch("/api/telemetry-ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Ingest is best-effort; never surface ingest failures to the UI.
  });
}

function scheduleFlush() {
  if (flushTimer != null) return;
  if (typeof window === "undefined") return;
  flushTimer = window.setTimeout(flushForwardQueue, FLUSH_INTERVAL_MS);
}

function ensureFlushHooks() {
  if (typeof window === "undefined") return;
  if ((ensureFlushHooks as { wired?: boolean }).wired) return;
  (ensureFlushHooks as { wired?: boolean }).wired = true;
  window.addEventListener("pagehide", flushForwardQueue);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushForwardQueue();
  });
}

function forwardEvent(event: TelemetryEvent) {
  ensureFlushHooks();
  FORWARD_QUEUE.push(event);
  if (FORWARD_QUEUE.length >= FLUSH_BATCH_LIMIT) {
    flushForwardQueue();
  } else {
    scheduleFlush();
  }
}

export function trackEvent(event: Omit<TelemetryEvent, "sessionId">) {
  if (!canUseStorage()) return;
  const enriched = { ...event, sessionId: getSessionId() } as TelemetryEvent;
  const next = [...loadTelemetry(), enriched];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  forwardEvent(enriched);
}

export function clearTelemetry() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function exportTelemetryPayload() {
  const events = loadTelemetry();
  const uniqueSessions = new Set(events.map((e) => e.sessionId)).size;
  const payload = {
    exportedAt: new Date().toISOString(),
    eventCount: events.length,
    uniqueSessions,
    events,
  };

  return JSON.stringify(payload, null, 2);
}
