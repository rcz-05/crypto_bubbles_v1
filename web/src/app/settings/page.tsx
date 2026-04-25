"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ProCheckoutSheet } from "@/components/ProCheckoutSheet";
import { loadLocalFavorites } from "@/lib/favorites";
import {
  PRO_PRICE_USD,
  PRO_TRIAL_DAYS,
  cancelPro,
  trialDaysRemaining,
  useProStatus,
} from "@/lib/pro-status";
import {
  clearTelemetry,
  exportTelemetryPayload,
  loadTelemetry,
  trackEvent,
  TelemetryEvent,
} from "@/lib/telemetry";
import { useVariant } from "@/lib/variant";
import { resetOnboarding } from "@/components/OnboardingOverlay";

function formatProSinceDate(value: string | null): string {
  if (!value) return "today";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "today";
  return dt.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function SettingsPage() {
  const [events, setEvents] = useState<TelemetryEvent[]>(() => loadTelemetry());
  const [favoriteCount] = useState(() => loadLocalFavorites().length);
  const [downloadState, setDownloadState] = useState<"idle" | "done">("idle");
  const [proCheckoutOpen, setProCheckoutOpen] = useState(false);
  const variant = useVariant();
  const proStatus = useProStatus();
  const trialDaysLeft = trialDaysRemaining(proStatus.trialEndsAt);

  const summary = useMemo(() => {
    const contextLoads = events.filter(
      (event): event is Extract<TelemetryEvent, { type: "context_loaded" }> =>
        event.type === "context_loaded",
    );
    const sourceClicks = events.filter((event) => event.type === "source_opened").length;
    const modalOpens = events.filter((event) => event.type === "modal_opened").length;
    const timeframeChanges = events.filter((event) => event.type === "timeframe_changed").length;
    const uniqueSessions = new Set(events.map((e) => e.sessionId)).size;
    const avgTime =
      contextLoads.length > 0
        ? Math.round(
            contextLoads.reduce((sum, event) => sum + event.payload.time_to_context_ms, 0) /
              contextLoads.length,
          )
        : 0;

    return {
      modalOpens,
      contextLoads: contextLoads.length,
      sourceClicks,
      timeframeChanges,
      uniqueSessions,
      avgTime,
    };
  }, [events]);

  const handleDownload = () => {
    const blob = new Blob([exportTelemetryPayload()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "coincanvas-telemetry.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setDownloadState("done");
  };

  const handleClear = () => {
    clearTelemetry();
    setEvents([]);
    setDownloadState("idle");
  };

  const handleProIntent = useCallback(() => {
    trackEvent({
      type: "premium_intent_clicked",
      recordedAt: new Date().toISOString(),
      payload: {
        variant,
        source: "settings",
      },
    });
    trackEvent({
      type: "pro_checkout_opened",
      recordedAt: new Date().toISOString(),
      payload: {
        variant,
        source: "settings",
      },
    });
    setProCheckoutOpen(true);
  }, [variant]);

  const handleProCancel = useCallback(() => {
    cancelPro("user");
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          SETTINGS
        </div>
        <div className="topbar-copy">Sources, instrumentation, and export tools.</div>
        <div className="controls">
          <Link href="/" className="nav-link">
            Canvas
          </Link>
          <Link href="/favorites" className="nav-link">
            Favorites
          </Link>
          <Link href="/settings" className="nav-link" aria-current="page">
            Settings
          </Link>
        </div>
      </header>

      <main className="page-wrap interior-page">
        <section className="hero-grid compact">
          <div className="hero-panel">
            <p className="hero-kicker">Testing operations</p>
            <h1>Export raw interaction data for the project notebook.</h1>
            <p className="hero-copy">
              This page keeps the learning prototype honest: context is deterministic,
              market data is verified, and every key user action can be exported as raw JSON.
            </p>
          </div>
          <div className="hero-panel emphasis">
            <div className="metric-grid">
              <div className="metric-card">
                <span className="metric-label">Modal opens</span>
                <strong>{summary.modalOpens}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Context loads</span>
                <strong>{summary.contextLoads}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Source clicks</span>
                <strong>{summary.sourceClicks}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Timeframe changes</span>
                <strong>{summary.timeframeChanges}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Avg. time to context</span>
                <strong>{summary.avgTime ? `${summary.avgTime}ms` : "—"}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Unique sessions</span>
                <strong>{summary.uniqueSessions}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Saved favorites</span>
                <strong>{favoriteCount}</strong>
              </div>
            </div>
          </div>
        </section>

        <div className="settings-grid">
          <div className="list-card">
            <div>
              <div style={{ fontWeight: 700 }}>Verified market data</div>
              <div style={{ color: "var(--muted)" }}>
                CoinGecko markets API provides the live 24h board, price, rank, and volume
                values shown in the modal.
              </div>
            </div>
            <Link href="https://www.coingecko.com" className="refresh-btn secondary">
              Visit
            </Link>
          </div>

          <div className="list-card">
            <div>
              <div style={{ fontWeight: 700 }}>Guided context layer</div>
              <div style={{ color: "var(--muted)" }}>
                CoinCanvas uses curated research notes for primary demo coins and falls back
                to deterministic market-data heuristics for the rest of the board.
              </div>
            </div>
          </div>

          <div className="list-card">
            <div>
              <div style={{ fontWeight: 700 }}>Favorites backend</div>
              <div style={{ color: "var(--muted)" }}>
                Favorites stay local-first for deploy safety, with optional Vercel Postgres
                syncing when env vars are configured.
              </div>
            </div>
          </div>

          {proStatus.isPro ? (
            <div className="list-card pro-settings-card">
              <div>
                <div style={{ fontWeight: 700 }}>
                  CoinCanvas Pro · {proStatus.state === "trial" ? "trial active" : "subscribed"}
                </div>
                <div style={{ color: "var(--muted)" }}>
                  {proStatus.state === "trial"
                    ? `Free trial — ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left, then $${PRO_PRICE_USD}/mo. Includes multi-horizon read, peer benchmark, volatility profile, and curated trust-tagged sources.`
                    : `Active since ${formatProSinceDate(proStatus.since)} at $${PRO_PRICE_USD}/mo. Includes multi-horizon read, peer benchmark, volatility profile, and curated trust-tagged sources.`}
                </div>
              </div>
              <button
                className="refresh-btn secondary"
                type="button"
                onClick={handleProCancel}
              >
                Cancel subscription
              </button>
            </div>
          ) : (
            <div className="list-card pro-settings-card">
              <div>
                <div style={{ fontWeight: 700 }}>CoinCanvas Pro</div>
                <div style={{ color: "var(--muted)" }}>
                  ${PRO_PRICE_USD}/mo after a {PRO_TRIAL_DAYS}-day free trial.
                  Multi-horizon analyst read, peer-cohort benchmark, volatility
                  profile, and curated trust-tagged sources for serious novices.
                </div>
              </div>
              <button className="refresh-btn" type="button" onClick={handleProIntent}>
                Start {PRO_TRIAL_DAYS}-day free trial
              </button>
            </div>
          )}

          <div className="list-card">
            <div>
              <div style={{ fontWeight: 700 }}>Export raw data</div>
              <div style={{ color: "var(--muted)" }}>
                Download `coincanvas-telemetry.json` with modal opens, context load
                timing, fallback usage, source clicks, timeframe changes, session IDs,
                and favorite actions.
              </div>
            </div>
            <button className="refresh-btn" onClick={handleDownload}>
              {downloadState === "done" ? "Downloaded" : "Export JSON"}
            </button>
          </div>

          <div className="list-card">
            <div>
              <div style={{ fontWeight: 700 }}>Reset local evidence</div>
              <div style={{ color: "var(--muted)" }}>
                Clear the current interaction dataset before the next moderated
                testing session.
              </div>
            </div>
            <button className="refresh-btn secondary" onClick={handleClear}>
              Clear telemetry
            </button>
          </div>

          <div className="list-card">
            <div>
              <div style={{ fontWeight: 700 }}>Replay onboarding</div>
              <div style={{ color: "var(--muted)" }}>
                Reset the first-visit guide so it shows again on the next visit to the
                bubble board. Useful for testing the onboarding flow with new participants.
              </div>
            </div>
            <button className="refresh-btn secondary" onClick={() => { resetOnboarding(); window.location.href = "/"; }}>
              Reset &amp; go to board
            </button>
          </div>

          <div className="list-card">
            <div>
              <div style={{ fontWeight: 700 }}>Latest events</div>
              <div className="card-meta">
                {events.length === 0
                  ? "No events recorded yet."
                  : events
                      .slice(-3)
                      .reverse()
                      .map(
                        (event) =>
                          `${event.type} • ${new Date(event.recordedAt).toLocaleTimeString()}`,
                      )
                      .join(" | ")}
              </div>
            </div>
          </div>
        </div>
      </main>

      <ProCheckoutSheet
        open={proCheckoutOpen}
        variant={variant}
        source="settings"
        onClose={() => setProCheckoutOpen(false)}
      />
    </div>
  );
}
