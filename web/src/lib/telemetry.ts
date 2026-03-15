"use client";

export type TelemetryEvent =
  | {
      type: "modal_opened";
      recordedAt: string;
      payload: { symbol: string; coinId: string };
    }
  | {
      type: "context_loaded";
      recordedAt: string;
      payload: { symbol: string; time_to_context_ms: number; context_fallback_used: boolean; headline_count: number };
    }
  | {
      type: "context_failed";
      recordedAt: string;
      payload: { symbol: string; reason: string };
    }
  | {
      type: "source_opened";
      recordedAt: string;
      payload: { symbol: string; url: string; label: string };
    }
  | {
      type: "favorite_added";
      recordedAt: string;
      payload: { symbol: string };
    }
  | {
      type: "favorite_removed";
      recordedAt: string;
      payload: { symbol: string };
    };

const STORAGE_KEY = "coincanvas-sprint3-telemetry";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
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

export function trackEvent(event: TelemetryEvent) {
  if (!canUseStorage()) return;
  const next = [...loadTelemetry(), event];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearTelemetry() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function exportTelemetryPayload() {
  const events = loadTelemetry();
  const payload = {
    exportedAt: new Date().toISOString(),
    eventCount: events.length,
    events,
  };

  return JSON.stringify(payload, null, 2);
}
