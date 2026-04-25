"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminControls } from "@/components/AdminControls";
import { EventStream } from "@/components/EventStream";
import {
  AbTestPanel,
  ActivityPanel,
  PerformancePanel,
  ProFunnelPanel,
} from "@/components/Panels";
import type { DashboardStats } from "@/lib/aggregate";
import type { AdminEvent } from "@/lib/events";

const POLL_INTERVAL_MS = 5_000;

type ApiResponse = {
  events: AdminEvent[];
  stats?: DashboardStats;
};

export function Dashboard() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetch("/api/events", { cache: "no-store" });
      if (!res.ok) throw new Error(`events api ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setEvents(json.events);
      if (json.stats) setStats(json.stats);
      setError(null);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch failed");
    } finally {
      inflight.current = false;
    }
  }, []);

  useEffect(() => {
    // Initial fetch and recurring poll — these are external-data effects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const t = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [refresh]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-dot" />
          CoinCanvas · Ops
        </div>
        <div className="topbar-meta">
          <span className="live-dot" /> live · refresh {POLL_INTERVAL_MS / 1000}s
          <span>·</span>
          <span>
            {lastUpdated ? lastUpdated.toLocaleTimeString() : "loading…"}
          </span>
          <span>·</span>
          <span>
            {stats?.totalEvents ?? events.length} events · {stats?.activity.activeSessions ?? 0} active
          </span>
        </div>
      </header>

      {error ? (
        <div
          className="panel"
          style={{ background: "rgba(239, 68, 68, 0.15)", borderColor: "rgba(239, 68, 68, 0.4)", marginBottom: 12 }}
        >
          <strong>Connection error:</strong> {error}
        </div>
      ) : null}

      <div className="dash-grid">
        <ActivityPanel stats={stats?.activity} />
        <AbTestPanel stats={stats?.abTest} />
        <ProFunnelPanel stats={stats?.proFunnel} />
        <PerformancePanel stats={stats?.performance} />
        <EventStream events={events} />
        <AdminControls onAfterMutation={refresh} />
      </div>
    </div>
  );
}
