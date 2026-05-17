"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ActivityStats,
  PerformanceStats,
} from "@/lib/aggregate";

function fmtMs(value: number | null) {
  if (value == null) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

function fmt(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

const tooltipStyle = {
  background: "var(--surface-2)",
  border: "1px solid var(--border-strong)",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: "0.78rem",
  color: "var(--text)",
  fontFamily: "inherit",
};

export function ActivityPanel({ stats }: { stats: ActivityStats | undefined }) {
  const sparkData = (stats?.eventsPerMinute ?? Array(60).fill(0)).map((v, i) => ({
    minute: i,
    count: v,
  }));

  return (
    <section className="panel span-12">
      <div className="panel-head">
        <h2 className="panel-title">Activity · last 60 min</h2>
        <span className="panel-meta">real app events</span>
      </div>

      <div className="metric-row">
        <Metric label="events/hr" value={stats?.totalEventsLastHour ?? 0} />
        <Metric label="active sessions" value={stats?.activeSessions ?? 0} sub="last 5 min" />
        <Metric label="unique sessions/hr" value={stats?.uniqueSessions ?? 0} />
        <Metric
          label="events/sec avg"
          value={fmt((stats?.totalEventsLastHour ?? 0) / 3600, 2)}
        />
      </div>

      <div style={{ width: "100%", height: 90 }}>
        <ResponsiveContainer>
          <AreaChart data={sparkData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#818cf8" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis dataKey="minute" hide />
            <YAxis hide />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ stroke: "rgba(148, 163, 184, 0.3)" }}
              labelFormatter={(label) => `${60 - Number(label)} min ago`}
              formatter={(value: unknown) => [`${value} events`, ""]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#818cf8"
              fill="url(#sparkGrad)"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {stats && stats.topCoinsLastHour.length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          <span className="panel-meta" style={{ alignSelf: "center" }}>
            top coins ·
          </span>
          {stats.topCoinsLastHour.map((c) => (
            <span
              key={c.symbol}
              className="mono"
              style={{
                padding: "4px 10px",
                borderRadius: 8,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                fontSize: "0.78rem",
                color: "var(--text)",
              }}
            >
              {c.symbol} · {c.views}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function PerformancePanel({
  stats,
}: {
  stats: PerformanceStats | undefined;
}) {
  return (
    <section className="panel span-7">
      <div className="panel-head">
        <h2 className="panel-title">API Health</h2>
        <span className="panel-meta">latency, fallback, failures</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <LatencyTile
          label="Context"
          avg={stats?.contextAvgMs ?? null}
          p95={stats?.contextP95Ms ?? null}
        />
        <LatencyTile
          label="Explanation"
          avg={stats?.aiAvgMs ?? null}
          p95={stats?.aiP95Ms ?? null}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <FallbackTile
          label="Explanation fallback"
          rate={stats?.fallbackRatePct ?? null}
        />
        <FailureTile label="Context failures" value={stats?.contextFailures ?? 0} />
        <FailureTile label="Explanation failures" value={stats?.explanationFailures ?? 0} />
      </div>

      {stats && stats.fallbackByCoin.length > 0 ? (
        <div>
          <div
            style={{
              fontSize: "0.7rem",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--muted)",
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Fallback rate by coin
          </div>
          <div style={{ width: "100%", height: 110 }}>
            <ResponsiveContainer>
              <BarChart
                data={stats.fallbackByCoin.map((c) => ({
                  symbol: c.symbol,
                  rate: c.rate * 100,
                  n: c.n,
                }))}
                layout="vertical"
                margin={{ top: 0, right: 60, bottom: 0, left: 8 }}
              >
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis
                  type="category"
                  dataKey="symbol"
                  tick={{ fill: "var(--muted)", fontSize: 11, fontFamily: "inherit" }}
                  width={50}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                  formatter={(value: unknown, _name: unknown, item: unknown) => {
                    const n =
                      ((item as { payload?: { n?: number } } | undefined)?.payload
                        ?.n as number | undefined) ?? 0;
                    const v = typeof value === "number" ? value : 0;
                    return [`${v.toFixed(1)}% · n=${n}`, "fallback"];
                  }}
                />
                <Bar dataKey="rate" radius={[6, 6, 6, 6]}>
                  {stats.fallbackByCoin.map((c) => (
                    <Cell
                      key={c.symbol}
                      fill={c.rate > 0.1 ? "var(--sell)" : c.rate > 0.05 ? "var(--hodl)" : "var(--accent)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <strong className="metric-value mono">{value}</strong>
      {sub ? <span className="metric-sub">{sub}</span> : null}
    </div>
  );
}

function LatencyTile({
  label,
  avg,
  p95,
}: {
  label: string;
  avg: number | null;
  p95: number | null;
}) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <strong className="metric-value small mono">{fmtMs(avg)}</strong>
      <span className="metric-sub mono">p95 {fmtMs(p95)}</span>
    </div>
  );
}

function FallbackTile({
  label,
  rate,
}: {
  label: string;
  rate: number | null;
}) {
  const color =
    rate == null ? "var(--text)" : rate > 5 ? "var(--sell)" : rate > 1 ? "var(--hodl)" : "var(--buy)";
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <strong className="metric-value small mono" style={{ color }}>
        {rate == null ? "—" : `${rate.toFixed(1)}%`}
      </strong>
      <span className="metric-sub">deterministic fallback</span>
    </div>
  );
}

function FailureTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <strong
        className="metric-value small mono"
        style={{ color: value > 0 ? "var(--sell)" : "var(--buy)" }}
      >
        {value}
      </strong>
      <span className="metric-sub">all retained events</span>
    </div>
  );
}
