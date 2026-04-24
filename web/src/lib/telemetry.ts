"use client";

export type TelemetryEvent =
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
      };
    }
  | {
      type: "ai_explanation_failed";
      recordedAt: string;
      sessionId: string;
      payload: { symbol: string; reason: string };
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

export function trackEvent(event: Omit<TelemetryEvent, "sessionId">) {
  if (!canUseStorage()) return;
  const enriched = { ...event, sessionId: getSessionId() } as TelemetryEvent;
  const next = [...loadTelemetry(), enriched];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
