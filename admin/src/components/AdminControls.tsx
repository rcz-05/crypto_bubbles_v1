"use client";

import { useCallback, useEffect, useState } from "react";

type Flags = {
  forceVariant: "a" | "b" | null;
  proOverride: boolean;
};

type Toast = { kind: "ok" | "err"; message: string } | null;

export function AdminControls({
  onAfterMutation,
}: {
  onAfterMutation: () => void | Promise<void>;
}) {
  const [flags, setFlags] = useState<Flags>({
    forceVariant: null,
    proOverride: false,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const refreshFlags = useCallback(async () => {
    try {
      const res = await fetch("/api/flags", { cache: "no-store" });
      if (res.ok) {
        setFlags((await res.json()) as Flags);
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    // External-data fetch on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshFlags();
  }, [refreshFlags]);

  const setFlagsRemote = useCallback(
    async (patch: { forceVariant?: "a" | "b" | "clear" | null; proOverride?: boolean }) => {
      setBusy("flags");
      try {
        const res = await fetch("/api/flags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (res.ok) {
          setFlags((await res.json()) as Flags);
          setToast({ kind: "ok", message: "Flag updated" });
        } else {
          setToast({ kind: "err", message: "Flag update failed" });
        }
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const seed = useCallback(async () => {
    if (!window.confirm("Restore the 4-day activity baseline? This will replace the current event data with the saved baseline snapshot.")) {
      return;
    }
    setBusy("seed");
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; seeded?: number };
      if (res.ok && data.ok) {
        setToast({ kind: "ok", message: `Baseline restored · ${data.seeded ?? 0} events` });
        await onAfterMutation();
      } else {
        setToast({ kind: "err", message: "Restore failed" });
      }
    } finally {
      setBusy(null);
    }
  }, [onAfterMutation]);

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
        <h2 className="panel-title">Controls · feature flags + dataset</h2>
        <span className="panel-meta">writes shared Redis flags</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <ControlBlock
          title="Force next session variant"
          description="Overrides hash-bucketing on the main app's next session start. Useful for back-to-back A/B demos."
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <ToggleBtn
              label="A · Standard"
              tone="variant-a"
              active={flags.forceVariant === "a"}
              disabled={busy === "flags"}
              onClick={() => setFlagsRemote({ forceVariant: "a" })}
            />
            <ToggleBtn
              label="B · ELI5"
              tone="variant-b"
              active={flags.forceVariant === "b"}
              disabled={busy === "flags"}
              onClick={() => setFlagsRemote({ forceVariant: "b" })}
            />
            <ToggleBtn
              label="Clear"
              tone="muted"
              active={flags.forceVariant === null}
              disabled={busy === "flags"}
              onClick={() => setFlagsRemote({ forceVariant: "clear" })}
            />
          </div>
        </ControlBlock>

        <ControlBlock
          title="Pro override flag"
          description="Grants every visiting session full Pro access until cleared. Fast-path for showing the unlocked Pro card without going through checkout."
        >
          <ToggleBtn
            label={flags.proOverride ? "Pro: ENABLED for all" : "Pro: off (normal)"}
            tone={flags.proOverride ? "buy" : "muted"}
            active={flags.proOverride}
            disabled={busy === "flags"}
            onClick={() => setFlagsRemote({ proOverride: !flags.proOverride })}
          />
        </ControlBlock>

        <ControlBlock
          title="Restore baseline dataset"
          description="Reload the 4-day activity baseline that powers the panels on first open. Useful if telemetry is cleared mid-demo or you want a clean reset before recording."
        >
          <button
            type="button"
            className="control-btn primary"
            onClick={seed}
            disabled={busy != null}
          >
            {busy === "seed" ? "Restoring…" : "Restore 4-day baseline"}
          </button>
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

function ToggleBtn({
  label,
  tone,
  active,
  disabled,
  onClick,
}: {
  label: string;
  tone: "variant-a" | "variant-b" | "buy" | "muted";
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const colorVar =
    tone === "variant-a"
      ? "var(--variant-a)"
      : tone === "variant-b"
        ? "var(--variant-b)"
        : tone === "buy"
          ? "var(--buy)"
          : "var(--muted)";
  const dimVar =
    tone === "variant-a"
      ? "var(--variant-a-dim)"
      : tone === "variant-b"
        ? "var(--variant-b-dim)"
        : tone === "buy"
          ? "var(--buy-dim)"
          : "var(--surface)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        appearance: "none",
        padding: "7px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? colorVar : "var(--border)"}`,
        background: active ? dimVar : "transparent",
        color: active ? colorVar : "var(--text-secondary)",
        fontFamily: "inherit",
        fontSize: "0.78rem",
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}
