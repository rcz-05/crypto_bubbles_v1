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
  AbStats,
  ActivityStats,
  PerformanceStats,
  ProFunnelStats,
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
        <span className="panel-meta">events / minute</span>
      </div>

      <div className="metric-row">
        <div className="metric">
          <span className="metric-label">events/hr</span>
          <strong className="metric-value mono">
            {stats?.totalEventsLastHour ?? 0}
          </strong>
        </div>
        <div className="metric">
          <span className="metric-label">active sessions</span>
          <strong className="metric-value mono">
            {stats?.activeSessions ?? 0}
          </strong>
          <span className="metric-sub">last 5 min</span>
        </div>
        <div className="metric">
          <span className="metric-label">unique sessions /hr</span>
          <strong className="metric-value mono">
            {stats?.uniqueSessions ?? 0}
          </strong>
        </div>
        <div className="metric">
          <span className="metric-label">events/sec avg</span>
          <strong className="metric-value mono">
            {fmt((stats?.totalEventsLastHour ?? 0) / 3600, 2)}
          </strong>
        </div>
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

export function AbTestPanel({ stats }: { stats: AbStats | undefined }) {
  const v = stats?.variants;

  const compChart = [
    {
      label: "Comprehension (0-2)",
      A: v?.a.comprehensionAvg ?? null,
      B: v?.b.comprehensionAvg ?? null,
    },
  ];
  const trustChart = [
    {
      label: "Trust (1-5)",
      A: v?.a.trustAvg ?? null,
      B: v?.b.trustAvg ?? null,
    },
  ];

  return (
    <section className="panel span-7">
      <div className="panel-head">
        <h2 className="panel-title">A/B Test · language framing</h2>
        <span className="panel-meta">single-variable: Standard vs ELI5</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <div
          className="metric"
          style={{
            background: "var(--variant-a-dim)",
            borderColor: "rgba(56, 189, 248, 0.32)",
          }}
        >
          <span className="metric-label" style={{ color: "var(--variant-a)" }}>
            Variant A · Standard
          </span>
          <strong className="metric-value small mono">
            {v?.a.sessions ?? 0} sessions
          </strong>
          <span className="metric-sub mono">
            {v?.a.modalOpens ?? 0} modal opens · {v?.a.surveysShown ?? 0} surveys
          </span>
        </div>
        <div
          className="metric"
          style={{
            background: "var(--variant-b-dim)",
            borderColor: "rgba(251, 146, 60, 0.32)",
          }}
        >
          <span className="metric-label" style={{ color: "var(--variant-b)" }}>
            Variant B · ELI5
          </span>
          <strong className="metric-value small mono">
            {v?.b.sessions ?? 0} sessions
          </strong>
          <span className="metric-sub mono">
            {v?.b.modalOpens ?? 0} modal opens · {v?.b.surveysShown ?? 0} surveys
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <RatingChart
          title="Comprehension · 😕 0 / 🙂 1 / 🎯 2"
          data={compChart}
          domain={[0, 2]}
          nA={v?.a.comprehensionN ?? 0}
          nB={v?.b.comprehensionN ?? 0}
        />
        <RatingChart
          title="Trust · 1-5 stars"
          data={trustChart}
          domain={[1, 5]}
          nA={v?.a.trustN ?? 0}
          nB={v?.b.trustN ?? 0}
        />
      </div>

      {stats?.effect &&
      (stats.effect.comprehension != null || stats.effect.trust != null) ? (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(129, 140, 248, 0.12)",
            border: "1px solid rgba(129, 140, 248, 0.3)",
            fontSize: "0.82rem",
            color: "var(--text)",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "var(--accent)" }}>Effect size · B – A:</strong>{" "}
          comprehension{" "}
          <span className="mono">
            {stats.effect.comprehension != null
              ? (stats.effect.comprehension > 0 ? "+" : "") +
                stats.effect.comprehension.toFixed(2)
              : "n/a"}
          </span>
          {" · "}
          trust{" "}
          <span className="mono">
            {stats.effect.trust != null
              ? (stats.effect.trust > 0 ? "+" : "") + stats.effect.trust.toFixed(2)
              : "n/a"}
          </span>
        </div>
      ) : null}
    </section>
  );
}

function RatingChart({
  title,
  data,
  domain,
  nA,
  nB,
}: {
  title: string;
  data: Array<{ label: string; A: number | null; B: number | null }>;
  domain: [number, number];
  nA: number;
  nB: number;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontSize: "0.74rem",
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        <span>{title}</span>
        <span className="mono">
          n=A:{nA} B:{nB}
        </span>
      </div>
      <div style={{ width: "100%", height: 56 }}>
        <ResponsiveContainer>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 0, right: 60, bottom: 0, left: 0 }}
            barGap={4}
          >
            <XAxis
              type="number"
              domain={domain}
              hide
            />
            <YAxis type="category" dataKey="label" hide />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
              formatter={(value: unknown, name: unknown) => [
                typeof value === "number" ? value.toFixed(2) : "—",
                String(name ?? ""),
              ]}
            />
            <Bar
              dataKey="A"
              fill="var(--variant-a)"
              radius={[6, 6, 6, 6]}
              label={{
                position: "right",
                fill: "var(--variant-a)",
                fontSize: 12,
                fontFamily: "inherit",
                formatter: (val: unknown) =>
                  typeof val === "number" ? val.toFixed(2) : "—",
              }}
            />
            <Bar
              dataKey="B"
              fill="var(--variant-b)"
              radius={[6, 6, 6, 6]}
              label={{
                position: "right",
                fill: "var(--variant-b)",
                fontSize: 12,
                fontFamily: "inherit",
                formatter: (val: unknown) =>
                  typeof val === "number" ? val.toFixed(2) : "—",
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ProFunnelPanel({ stats }: { stats: ProFunnelStats | undefined }) {
  const intentRate = stats && stats.views > 0 ? (stats.intent / stats.views) * 100 : null;
  const subRate = stats && stats.intent > 0 ? (stats.subscribed / stats.intent) * 100 : null;
  const churnRate =
    stats && stats.subscribed > 0 ? (stats.canceled / stats.subscribed) * 100 : null;

  const verdictTotal =
    (stats?.verdictMix.buy ?? 0) +
    (stats?.verdictMix.hodl ?? 0) +
    (stats?.verdictMix.sell ?? 0);
  const buyPct = verdictTotal > 0 ? ((stats?.verdictMix.buy ?? 0) / verdictTotal) * 100 : 0;
  const hodlPct = verdictTotal > 0 ? ((stats?.verdictMix.hodl ?? 0) / verdictTotal) * 100 : 0;
  const sellPct = verdictTotal > 0 ? ((stats?.verdictMix.sell ?? 0) / verdictTotal) * 100 : 0;

  return (
    <section className="panel span-5">
      <div className="panel-head">
        <h2 className="panel-title">Pro Funnel</h2>
        <span className="panel-meta">$3/mo · 7-day trial</span>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <FunnelStep label="Pro card views" value={stats?.views ?? 0} pct={null} />
        <FunnelStep
          label="Checkout / intent"
          value={stats?.intent ?? 0}
          pct={intentRate}
          tone="accent"
        />
        <FunnelStep
          label="Subscribed (trial)"
          value={stats?.subscribed ?? 0}
          pct={subRate}
          tone="buy"
        />
        <FunnelStep
          label="Canceled"
          value={stats?.canceled ?? 0}
          pct={churnRate}
          tone="sell"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          paddingTop: 6,
          borderTop: "1px dashed var(--border)",
        }}
      >
        <div className="mono" style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
          A: {stats?.byVariant.a.views ?? 0} v · {stats?.byVariant.a.subscribed ?? 0} sub
        </div>
        <div className="mono" style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
          B: {stats?.byVariant.b.views ?? 0} v · {stats?.byVariant.b.subscribed ?? 0} sub
        </div>
      </div>

      <div style={{ paddingTop: 4 }}>
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
          Verdict mix shown · n={verdictTotal}
        </div>
        <div
          style={{
            display: "flex",
            height: 14,
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
          }}
        >
          <div style={{ width: `${buyPct}%`, background: "var(--buy)" }} />
          <div style={{ width: `${hodlPct}%`, background: "var(--hodl)" }} />
          <div style={{ width: `${sellPct}%`, background: "var(--sell)" }} />
        </div>
        <div
          className="mono"
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.74rem",
            color: "var(--muted)",
            marginTop: 4,
          }}
        >
          <span style={{ color: "var(--buy)" }}>BUY {buyPct.toFixed(0)}%</span>
          <span style={{ color: "var(--hodl)" }}>HODL {hodlPct.toFixed(0)}%</span>
          <span style={{ color: "var(--sell)" }}>SELL {sellPct.toFixed(0)}%</span>
        </div>
      </div>
    </section>
  );
}

function FunnelStep({
  label,
  value,
  pct,
  tone = "default",
}: {
  label: string;
  value: number;
  pct: number | null;
  tone?: "default" | "accent" | "buy" | "sell";
}) {
  const color =
    tone === "buy"
      ? "var(--buy)"
      : tone === "sell"
        ? "var(--sell)"
        : tone === "accent"
          ? "var(--accent)"
          : "var(--text)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "9px 12px",
        borderRadius: 10,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: "0.86rem", color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong className="mono" style={{ fontSize: "1.05rem", color }}>
          {value}
        </strong>
        {pct != null ? (
          <span className="mono" style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
            {pct.toFixed(1)}%
          </span>
        ) : null}
      </span>
    </div>
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
        <h2 className="panel-title">Performance</h2>
        <span className="panel-meta">latency + fallback rate</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <LatencyTile
          label="Context"
          avg={stats?.contextAvgMs ?? null}
          p95={stats?.contextP95Ms ?? null}
        />
        <LatencyTile
          label="AI explanation"
          avg={stats?.aiAvgMs ?? null}
          p95={stats?.aiP95Ms ?? null}
        />
        <LatencyTile
          label="Pro explanation"
          avg={stats?.proAvgMs ?? null}
          p95={stats?.proP95Ms ?? null}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <FallbackTile
          label="Free tier fallback"
          rate={stats?.fallbackRateFreePct ?? null}
        />
        <FallbackTile
          label="Pro tier fallback"
          rate={stats?.fallbackRateProPct ?? null}
        />
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
            Top fallback rate by coin
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
      <span className="metric-sub">deterministic fallback rate</span>
    </div>
  );
}
