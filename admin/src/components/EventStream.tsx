"use client";

import { useEffect, useState } from "react";
import type { AdminEvent } from "@/lib/events";

const STREAM_LIMIT = 50;

const TYPE_ICONS: Record<string, string> = {
  ai_explanation_failed: "⚠",
  context_failed: "⚠",
  auth_signed_up: "+",
  auth_logged_in: "→",
  auth_logged_out: "←",
  favorite_added: "★",
  favorite_removed: "☆",
  market_refreshed: "↻",
  modal_opened: "▢",
  source_opened: "↗",
};

const SPECIAL_TONES: Record<string, string> = {
  ai_explanation_failed: "var(--sell)",
  context_failed: "var(--sell)",
  favorite_added: "var(--buy)",
  favorite_removed: "var(--sell)",
};

function formatRelative(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const ms = now - t;
  if (ms < 5_000) return "just now";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  const d = new Date(t);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function payloadPreview(event: AdminEvent): string {
  const p = event.payload ?? {};
  if (event.type === "ai_explanation_loaded") {
    const sym = (p as { symbol?: unknown }).symbol;
    const t = (p as { time_ms?: unknown }).time_ms;
    const fb = (p as { is_fallback?: unknown }).is_fallback;
    return `${typeof sym === "string" ? sym.toUpperCase() : ""} · ${typeof t === "number" ? t + "ms" : ""}${fb ? " · fallback" : ""}`;
  }
  if (event.type === "modal_opened") {
    const sym = (p as { symbol?: unknown }).symbol;
    return typeof sym === "string" ? sym.toUpperCase() : "";
  }
  if (event.type === "favorite_added" || event.type === "favorite_removed" || event.type === "favorite_opened") {
    const sym = (p as { symbol?: unknown }).symbol;
    return typeof sym === "string" ? sym.toUpperCase() : "";
  }
  if (event.type === "market_refreshed") {
    const source = (p as { source?: unknown }).source;
    const timeframe = (p as { timeframe?: unknown }).timeframe;
    return `${typeof source === "string" ? source : "refresh"}${typeof timeframe === "string" ? ` · ${timeframe}` : ""}`;
  }
  // generic compact
  const keys = Object.keys(p);
  if (keys.length === 0) return "";
  return keys.slice(0, 2).map((k) => `${k}: ${String((p as Record<string, unknown>)[k]).slice(0, 24)}`).join(" · ");
}

export function EventStream({ events }: { events: AdminEvent[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  // Tick clock every second so relative times stay fresh. Initial value is
  // set in an effect to avoid running impure Date.now() during render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const stream = events.slice(0, STREAM_LIMIT);

  return (
    <section className="panel span-5" style={{ minHeight: 480, maxHeight: 720 }}>
      <div className="panel-head">
        <h2 className="panel-title">Live event stream</h2>
        <span className="panel-meta">last {STREAM_LIMIT} · click to expand</span>
      </div>

      <div
        style={{
          display: "grid",
          gap: 4,
          overflowY: "auto",
          maxHeight: 620,
          paddingRight: 4,
        }}
      >
        {stream.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "var(--muted)",
              fontSize: "0.84rem",
            }}
          >
            No events to display. Open the main app and interact with the
            board to populate live telemetry.
          </div>
        ) : (
          stream.map((event, i) => {
            const id = `${event.recordedAt}:${i}`;
            const expanded = expandedId === id;
            const tone = SPECIAL_TONES[event.type];
            return (
              <button
                key={id}
                type="button"
                onClick={() => setExpandedId(expanded ? null : id)}
                style={{
                  appearance: "none",
                  textAlign: "left",
                  background: expanded ? "var(--surface-2)" : "transparent",
                  border: "1px solid",
                  borderColor: expanded ? "var(--border-strong)" : "transparent",
                  color: "inherit",
                  font: "inherit",
                  borderRadius: 8,
                  padding: "6px 10px",
                  cursor: "pointer",
                  transition: "background 120ms ease, border-color 120ms ease",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto auto 1fr",
                    gap: 8,
                    alignItems: "center",
                    fontSize: "0.84rem",
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.74rem",
                      width: 64,
                    }}
                  >
                    {formatRelative(event.recordedAt, now)}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      width: 18,
                      textAlign: "center",
                      color: tone ?? "var(--accent)",
                      fontSize: "0.96rem",
                    }}
                  >
                    {TYPE_ICONS[event.type] ?? "·"}
                  </span>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ color: tone ?? "var(--text)", fontWeight: 600 }}>
                      {event.type}
                    </span>
                    <span
                      style={{
                        marginLeft: 8,
                        color: "var(--muted)",
                        fontSize: "0.78rem",
                      }}
                    >
                      {payloadPreview(event)}
                    </span>
                  </span>
                </div>
                {expanded ? (
                  <pre
                    className="mono"
                    style={{
                      marginTop: 6,
                      marginBottom: 0,
                      padding: 8,
                      background: "var(--bg)",
                      borderRadius: 6,
                      fontSize: "0.74rem",
                      color: "var(--text-secondary)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {JSON.stringify(event, null, 2)}
                  </pre>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
