"use client";

import { useCallback, useState } from "react";

type Toast = { kind: "ok" | "err"; message: string } | null;

export function AdminControls({
  onAfterMutation,
}: {
  onAfterMutation: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const clearEvents = useCallback(async () => {
    if (!window.confirm("Permanently clear ALL telemetry events from Redis?")) return;
    setBusy("clear");
    try {
      const res = await fetch("/api/clear-events", { method: "POST" });
      if (res.ok) {
        setToast({ kind: "ok", message: "Events cleared" });
        await onAfterMutation();
      } else {
        setToast({ kind: "err", message: "Clear failed" });
      }
    } finally {
      setBusy(null);
    }
  }, [onAfterMutation]);

  return (
    <section className="panel span-7">
      <div className="panel-head">
        <h2 className="panel-title">Controls · operations</h2>
        <span className="panel-meta">telemetry maintenance</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <ControlBlock
          title="Production mode"
          description="Plain-English explanations are the only active user-facing mode. Experiment overrides have been removed."
        >
          <span
            style={{
              display: "inline-flex",
              width: "fit-content",
              padding: "7px 12px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-secondary)",
              fontSize: "0.78rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Standard app mode
          </span>
        </ControlBlock>

        <ControlBlock
          title="Clear all telemetry"
          description="Wipes events:all in Redis. The main app will keep populating from the next user interaction."
        >
          <button
            type="button"
            className="control-btn danger"
            onClick={clearEvents}
            disabled={busy != null}
          >
            {busy === "clear" ? "Clearing…" : "Clear telemetry"}
          </button>
        </ControlBlock>
      </div>

      {toast ? (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            background:
              toast.kind === "ok"
                ? "rgba(34, 197, 94, 0.15)"
                : "rgba(239, 68, 68, 0.15)",
            border: `1px solid ${toast.kind === "ok" ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
            fontSize: "0.82rem",
            color: toast.kind === "ok" ? "var(--buy)" : "var(--sell)",
          }}
        >
          {toast.message}
        </div>
      ) : null}

      <style jsx>{`
        .control-btn {
          appearance: none;
          background: var(--surface-2);
          color: var(--text);
          border: 1px solid var(--border-strong);
          border-radius: 10px;
          padding: 10px 14px;
          font-family: inherit;
          font-size: 0.86rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 120ms ease, border-color 120ms ease;
        }
        .control-btn:hover:not(:disabled) {
          background: rgba(129, 140, 248, 0.18);
          border-color: var(--accent);
        }
        .control-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .control-btn.primary {
          background: rgba(129, 140, 248, 0.18);
          border-color: var(--accent);
          color: var(--text);
        }
        .control-btn.primary:hover:not(:disabled) {
          background: rgba(129, 140, 248, 0.32);
        }
        .control-btn.danger {
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(239, 68, 68, 0.4);
          color: #fecaca;
        }
        .control-btn.danger:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.22);
        }
      `}</style>
    </section>
  );
}

function ControlBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        display: "grid",
        gap: 10,
      }}
    >
      <div>
        <div
          style={{
            fontSize: "0.86rem",
            fontWeight: 600,
            color: "var(--text)",
            marginBottom: 3,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.45 }}>
          {description}
        </div>
      </div>
      {children}
    </div>
  );
}
