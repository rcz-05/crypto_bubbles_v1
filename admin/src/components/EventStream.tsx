"use client";

import { useEffect, useState } from "react";
import type { AdminEvent, Variant } from "@/lib/events";
import { getVariant } from "@/lib/events";

const STREAM_LIMIT = 50;

const TYPE_ICONS: Record<string, string> = {
  pro_subscribed: "★",
  pro_canceled: "✕",
  pro_checkout_opened: "$",
  pro_explanation_loaded: "✦",
  variant_assigned: "▶",
  variant_overridden: "⇒",
  ai_explanation_failed: "⚠",
  comprehension_rated: "⌘",
  trust_rated: "✓",
  modal_opened: "▢",
};

const SPECIAL_TONES: Record<string, string> = {
  pro_subscribed: "var(--buy)",
  pro_canceled: "var(--sell)",
  pro_checkout_opened: "var(--accent)",
  ai_explanation_failed: "var(--sell)",
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
  if (event.type === "pro_subscribed") {
    const w = (p as { withTrial?: unknown }).withTrial;
    return w === true ? "trial · $3/mo" : "subscribed · $3/mo";
  }
  if (event.type === "pro_explanation_loaded") {
    const v = (p as { verdict?: unknown }).verdict;
    const sym = (p as { symbol?: unknown }).symbol;
    return `${typeof sym === "string" ? sym.toUpperCase() : ""} · ${typeof v === "string" ? v : "—"}`;
  }
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
  if (event.type === "comprehension_rated") {
    const v = (p as { value?: unknown }).value;
    const sym = (p as { symbol?: unknown }).symbol;
    return `${typeof sym === "string" ? sym.toUpperCase() : ""} · score ${v}`;
  }
  if (event.type === "trust_rated") {
    const v = (p as { value?: unknown }).value;
    return `★ ${v} / 5`;
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
            No events yet — visit the main app to populate, or seed demo data
            from the controls panel.
          </div>
        ) : (
          stream.map((event, i) => {
            const v: Variant | null = getVariant(event);
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
                    gridTemplateColumns: "auto auto 1fr auto",
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
                  {v ? (
                    <span
                      style={{
                        padding: "2px 7px",
                        borderRadius: 999,
                        fontSize: "0.66rem",
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        background: v === "a" ? "var(--variant-a-dim)" : "var(--variant-b-dim)",
                        color: v === "a" ? "var(--variant-a)" : "var(--variant-b)",
                      }}
                    >
                      [{v.toUpperCase()}]
                    </span>
                  ) : (
                    <span style={{ width: 30 }} />
                  )}
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
