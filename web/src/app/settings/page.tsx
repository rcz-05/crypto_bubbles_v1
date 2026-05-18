"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  // Telemetry lives in localStorage. Reading it during the initial render
  // would desync SSR (empty) from the client (populated) and trigger a
  // hydration mismatch — so load it after mount instead.
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  useEffect(() => {
    // Defer past first paint: server + initial client render both show the
    // empty snapshot (no hydration mismatch), then we hydrate from
    // localStorage. rAF keeps the setState out of the effect body so it
    // doesn't trip react-hooks/set-state-in-effect.
    const id = window.requestAnimationFrame(() =>
      setEvents(loadTelemetry()),
    );
    return () => window.cancelAnimationFrame(id);
  }, []);
  const [downloadState, setDownloadState] = useState<"idle" | "done">("idle");
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const signedIn = authStatus === "authenticated" && authUser;

  const handleDownload = () => {
    const blob = new Blob([exportTelemetryPayload()], {
      type: "application/json",
    });
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
        <div className="topbar-copy">Account, sources, and app preferences.</div>
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

      <main className="page-wrap interior-page settings-page">
        {/* 1 — Account, front and centre */}
        <section className="settings-account-card">
          <div className="settings-account-head">
            <span
              className={`sync-state ${signedIn ? "account" : ""}`}
            >
              <span className="sync-dot" />
              {signedIn ? "Signed in" : "Guest mode"}
            </span>
            <h1>
              {signedIn
                ? authUser?.displayName?.trim() || authUser?.email
                : "You're browsing as a guest."}
            </h1>
            <p className="hero-copy">
              {signedIn
                ? `${authUser?.email} — your saved coins sync to this account on every device you sign in on.`
                : "Saved coins live on this device only. Create a free account to keep them everywhere."}
            </p>
          </div>
          {signedIn ? (
            <button
              className="refresh-btn secondary"
              type="button"
              onClick={() => void logout()}
            >
              Sign out
            </button>
          ) : (
            <div className="account-actions">
              <Link href="/login" className="refresh-btn secondary">
                Sign in
              </Link>
              <Link href="/register" className="refresh-btn">
                Create account
              </Link>
            </div>
          )}
        </section>

        {/* 2 — Data & sources */}
        <div className="settings-section-label">Data &amp; sources</div>
        <div className="settings-grid">
          <div className="list-card">
            <div>
              <div className="list-card-title">Verified market data</div>
              <div className="list-card-sub">
                Live prices, rank, and volume come from the CoinGecko markets
                API.
              </div>
            </div>
            <Link
              href="https://www.coingecko.com"
              className="refresh-btn secondary"
              target="_blank"
              rel="noreferrer"
            >
              Visit
            </Link>
          </div>

          <div className="list-card">
            <div>
              <div className="list-card-title">Plain-English explanations</div>
              <div className="list-card-sub">
                Market moves are explained in beginner-friendly language, with a
                deterministic fallback when the language model is unavailable.
              </div>
            </div>
          </div>

          <div className="list-card">
            <div>
              <div className="list-card-title">Favorites sync</div>
              <div className="list-card-sub">
                Guests keep favorites on this device. Signed-in accounts sync
                them securely so they follow you across devices.
              </div>
            </div>
          </div>
        </div>

        {/* 3 — App */}
        <div className="settings-section-label">App</div>
        <div className="settings-grid">
          <div className="list-card">
            <div>
              <div className="list-card-title">Install CoinCanvas</div>
              <div className="list-card-sub">
                Add CoinCanvas to your home screen for a full-screen app
                experience. Use your browser&apos;s Install / Add to Home Screen
                option.
              </div>
            </div>
          </div>

          <div className="list-card">
            <div>
              <div className="list-card-title">Replay the intro</div>
              <div className="list-card-sub">
                Show the first-visit guide again next time you open the board.
              </div>
            </div>
            <button
              className="refresh-btn secondary"
              onClick={() => {
                resetOnboarding();
                window.location.href = "/";
              }}
            >
              Replay
            </button>
          </div>
        </div>

        {/* 4 — Diagnostics, tucked away */}
        <details className="settings-diagnostics">
          <summary>Diagnostics</summary>
          <div className="settings-grid">
            <div className="list-card">
              <div>
                <div className="list-card-title">Export interaction data</div>
                <div className="list-card-sub">
                  Download a local JSON of anonymous interaction events stored
                  in this browser.
                </div>
              </div>
              <button className="refresh-btn" onClick={handleDownload}>
                {downloadState === "done" ? "Downloaded" : "Export JSON"}
              </button>
            </div>

            <div className="list-card">
              <div>
                <div className="list-card-title">Clear local data</div>
                <div className="list-card-sub">
                  Remove the stored interaction events from this browser.
                </div>
              </div>
              <button className="refresh-btn secondary" onClick={handleClear}>
                Clear
              </button>
            </div>

            <div className="list-card">
              <div>
                <div className="list-card-title">Recent events</div>
                <div className="card-meta">
                  {events.length === 0
                    ? "No events recorded yet."
                    : events
                        .slice(-3)
                        .reverse()
                        .map(
                          (event) =>
                            `${event.type} • ${new Date(
                              event.recordedAt,
                            ).toLocaleTimeString()}`,
                        )
                        .join("  |  ")}
                </div>
              </div>
            </div>
          </div>
        </details>
      </main>
    </div>
  );
}
