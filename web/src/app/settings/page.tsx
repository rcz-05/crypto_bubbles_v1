"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { loadLocalFavorites } from "@/lib/favorites";
import {
  clearTelemetry,
  exportTelemetryPayload,
  loadTelemetry,
  TelemetryEvent,
} from "@/lib/telemetry";
import { resetOnboarding } from "@/components/OnboardingOverlay";
import { AccountControl } from "@/components/AccountControl";
import { useAuthStore } from "@/store/auth";

export default function SettingsPage() {
  const [events, setEvents] = useState<TelemetryEvent[]>(() => loadTelemetry());
  const [favoriteCount] = useState(() => loadLocalFavorites().length);
  const [downloadState, setDownloadState] = useState<"idle" | "done">("idle");
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          SETTINGS
        </div>
        <div className="topbar-copy">Sources, local data, and app diagnostics.</div>
        <div className="controls">
          <AccountControl />
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
            <p className="hero-kicker">App data</p>
            <h1>Manage your local CoinCanvas data.</h1>
            <p className="hero-copy">
              Keep tabs on saved coins, local diagnostics, and the verified market
              data sources used throughout the app.
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
            {authStatus === "authenticated" && authUser ? (
              <>
                <div className="account-section">
                  <div style={{ fontWeight: 700 }}>
                    Signed in{authUser.displayName ? ` as ${authUser.displayName}` : ""}
                  </div>
                  <div style={{ color: "var(--muted)" }}>
                    {authUser.email} · your saved coins sync to this account on
                    every device you sign in on.
                  </div>
                </div>
                <button
                  className="refresh-btn secondary"
                  type="button"
                  onClick={() => void logout()}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <div className="account-section">
                  <div style={{ fontWeight: 700 }}>Your account</div>
                  <div style={{ color: "var(--muted)" }}>
                    Create a free account to keep your favorites on every
                    device. You can keep using CoinCanvas as a guest too.
                  </div>
                </div>
                <div className="account-actions">
                  <Link href="/login" className="refresh-btn secondary">
                    Sign in
                  </Link>
                  <Link href="/register" className="refresh-btn">
                    Create account
                  </Link>
                </div>
              </>
            )}
          </div>

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
              <div style={{ fontWeight: 700 }}>Plain-English explanations</div>
              <div style={{ color: "var(--muted)" }}>
                CoinCanvas explains market moves in beginner-friendly language and falls
                back to deterministic market-data heuristics when the language model is unavailable.
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

          <div className="list-card">
            <div>
              <div style={{ fontWeight: 700 }}>Export local diagnostics</div>
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
              <div style={{ fontWeight: 700 }}>Clear local diagnostics</div>
              <div style={{ color: "var(--muted)" }}>
                Clear the current interaction dataset from this browser.
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
    </div>
  );
}
