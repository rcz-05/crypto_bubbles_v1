"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Coin, TimeFrame, getChangeForTimeFrame } from "@/lib/coingecko";

type BubbleChartProps = {
  data: Coin[];
  width: number;
  height: number;
  timeFrame: TimeFrame;
  onSelect: (coin: Coin) => void;
};

type LayoutNode = {
  x: number;
  y: number;
  r: number;
  data: Coin;
};

type PhysicsBody = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  targetR: number;
  targetX: number;
  targetY: number;
  coinId: string;
  /** 0 = red, 1 = green — lerped for smooth color transitions */
  colorT: number;
  targetColorT: number;
};

/* ------------------------------------------------------------------ */
/*  Physics tuning                                                     */
/* ------------------------------------------------------------------ */
const COLLISION_STRENGTH = 0.5;
const WALL_PADDING = 4;
const BUBBLE_GAP = 2;
const CURSOR_RADIUS = 20;
const CURSOR_FORCE = 0.15;
const DRIFT_SPEED = 0.18;       // how fast bubbles float (px/frame)
const DRIFT_BLEND = 0.015;      // how quickly velocity aligns to drift direction
const DEG = 180 / Math.PI;

/* ------------------------------------------------------------------ */
/*  Organic blob geometry                                              */
/* ------------------------------------------------------------------ */

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

/**
 * Organic blob path centered at (0,0).
 * `time` drives continuous morphing — three overlapping sine waves
 * at different speeds make the outline breathe and flow.
 */
function blobPath(r: number, seed: number, time: number): string {
  const n = 12;
  const wobble = r * 0.055;
  const pts: [number, number][] = [];

  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n;
    const offset =
      Math.sin(seed * 9.1 + i * 4.3 + time * 0.9) * wobble * 0.7 +
      Math.cos(seed * 3.7 + i * 7.1 + time * 0.65) * wobble * 0.5 +
      Math.sin(seed * 1.3 + i * 11.9 + time * 0.4) * wobble * 0.3;
    const rr = r + offset;
    pts.push([Math.cos(angle) * rr, Math.sin(angle) * rr]);
  }

  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${cp1x.toFixed(1)},${cp1y.toFixed(1)},${cp2x.toFixed(1)},${cp2y.toFixed(1)},${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + "Z";
}

/* ------------------------------------------------------------------ */
/*  Physics helpers                                                    */
/* ------------------------------------------------------------------ */

function resolveCollisions(bodies: PhysicsBody[]) {
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = a.r + b.r + BUBBLE_GAP;

      if (dist < minDist && dist > 0.01) {
        const overlap = (minDist - dist) * 0.5 * COLLISION_STRENGTH;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;

        const dvx = (b.vx - a.vx) * 0.15;
        const dvy = (b.vy - a.vy) * 0.15;
        a.vx += dvx;
        a.vy += dvy;
        b.vx -= dvx;
        b.vy -= dvy;
      }
    }
  }
}

function containInBounds(body: PhysicsBody, w: number, h: number) {
  const pad = WALL_PADDING;
  if (body.x - body.r < pad) {
    body.x = body.r + pad;
    body.vx = Math.abs(body.vx) * 0.3;
  }
  if (body.x + body.r > w - pad) {
    body.x = w - body.r - pad;
    body.vx = -Math.abs(body.vx) * 0.3;
  }
  if (body.y - body.r < pad) {
    body.y = body.r + pad;
    body.vy = Math.abs(body.vy) * 0.3;
  }
  if (body.y + body.r > h - pad) {
    body.y = h - body.r - pad;
    body.vy = -Math.abs(body.vy) * 0.3;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function BubbleChart({ data, width, height, timeFrame, onSelect }: BubbleChartProps) {
  const layoutNodes = useMemo(() => {
    if (!width || !height || !data.length) return [] as LayoutNode[];

    // Rank-based sizing: sort coins by magnitude, then map rank to radius.
    // This guarantees a smooth, consistent size distribution regardless of
    // whether the timeframe has 0.1% moves or 200% moves.
    const items = data.map((coin) => {
      const magnitude =
        timeFrame === "market_cap"
          ? Math.pow(coin.market_cap ?? 0, 0.42)
          : Math.abs(getChangeForTimeFrame(coin, timeFrame));
      return { coin, magnitude };
    });

    // Sort descending by magnitude, assign rank 0..n-1
    const sorted = [...items].sort((a, b) => b.magnitude - a.magnitude);
    const rankMap = new Map<string, number>();
    sorted.forEach((item, i) => rankMap.set(item.coin.id, i));

    const n = items.length;
    // When we render 25 bubbles on mobile (post-pagination), there's ~4× more
    // canvas per bubble, so we scale up. On the full board (100), we still
    // grow modestly so the size hierarchy reads more clearly.
    const sparse = n <= 30;
    const medium = n <= 60;
    const minR = sparse ? 30 : medium ? 26 : 22;
    const minDim = Math.min(width, height);
    const maxR = sparse ? minDim * 0.108 : medium ? minDim * 0.092 : minDim * 0.078;

    // Random placement using deterministic hash — no grid pattern
    return items.map((v) => {
      // rank 0 = biggest mover → largest bubble, rank n-1 = smallest → smallest bubble
      const rank = rankMap.get(v.coin.id) ?? n - 1;
      const t = n > 1 ? 1 - rank / (n - 1) : 0.5; // 1 for top, 0 for bottom
      const r = minR + t * (maxR - minR);
      const seed = hashSeed(v.coin.id);
      // Multiple hash-derived pseudo-random values for x, y
      const hx = ((Math.sin(seed * 7.13) + 1) / 2);       // 0-1
      const hy = ((Math.cos(seed * 11.47) + 1) / 2);      // 0-1
      const pad = r + 8;
      return {
        x: pad + hx * (width - pad * 2),
        y: pad + hy * (height - pad * 2),
        r,
        data: v.coin,
      };
    });
  }, [data, width, height, timeFrame]);

  /* ---- medal rankings: top 3 gainers + top 3 losers ---- */
  const medalMap = useMemo(() => {
    const map = new Map<string, "gold" | "silver" | "bronze">();
    if (timeFrame === "market_cap") return map;

    const withChange = data.map((coin) => ({
      id: coin.id,
      change: getChangeForTimeFrame(coin, timeFrame),
    }));

    // Top 3 gainers (highest positive change)
    const gainers = [...withChange].filter((c) => c.change > 0).sort((a, b) => b.change - a.change);
    const medals: ("gold" | "silver" | "bronze")[] = ["gold", "silver", "bronze"];
    for (let i = 0; i < 3 && i < gainers.length; i++) {
      map.set(gainers[i].id, medals[i]);
    }

    // Top 3 losers (most negative change)
    const losers = [...withChange].filter((c) => c.change < 0).sort((a, b) => a.change - b.change);
    for (let i = 0; i < 3 && i < losers.length; i++) {
      map.set(losers[i].id, medals[i]);
    }

    return map;
  }, [data, timeFrame]);

  /* ---- high-risk set: top 10% volatility among coins ranked outside top 100 ---- */
  const highRiskSet = useMemo(() => {
    const set = new Set<string>();
    if (timeFrame === "market_cap") return set;

    const changes = data.map((coin) => Math.abs(getChangeForTimeFrame(coin, timeFrame)));
    const sorted = [...changes].sort((a, b) => a - b);
    const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? Infinity;

    for (const coin of data) {
      const absChange = Math.abs(getChangeForTimeFrame(coin, timeFrame));
      if (
        absChange >= p90 &&
        coin.market_cap_rank != null &&
        coin.market_cap_rank > 100
      ) {
        set.add(coin.id);
      }
    }
    return set;
  }, [data, timeFrame]);

  /* ---- refs ---- */
  const bodiesRef = useRef<PhysicsBody[]>([]);
  const gRefs = useRef<(SVGGElement | null)[]>([]);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const riskPathRefs = useRef<(SVGPathElement | null)[]>([]);
  const seedsRef = useRef<number[]>([]);
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const popRef = useRef<number[]>([]);        // timestamp of last click per bubble
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number>(0);
  const mountedRef = useRef(true);

  /* ---- sync bodies + seeds ---- */
  useEffect(() => {
    const prevMap = new Map<string, PhysicsBody>();
    for (const b of bodiesRef.current) {
      prevMap.set(b.coinId, b);
    }
    bodiesRef.current = layoutNodes.map((node) => {
      const change = getChangeForTimeFrame(node.data, timeFrame);
      const colorTarget = change >= 0 ? 1 : 0;
      const existing = prevMap.get(node.data.id);
      if (existing) {
        existing.targetX = node.x;
        existing.targetY = node.y;
        existing.targetR = node.r;
        existing.targetColorT = colorTarget;
        return existing;
      }
      return {
        x: node.x, y: node.y,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        r: node.r, targetR: node.r,
        targetX: node.x, targetY: node.y,
        coinId: node.data.id,
        colorT: colorTarget, targetColorT: colorTarget,
      };
    });
    seedsRef.current = layoutNodes.map((n) => hashSeed(n.data.id));
    popRef.current = new Array(layoutNodes.length).fill(0);
  }, [layoutNodes, timeFrame]);

  /* scroll momentum removed — it caused bubbles to clump together */

  /* ---- animation loop ---- */
  useEffect(() => {
    mountedRef.current = true;
    let frame = 0;

    function tick() {
      if (!mountedRef.current) return;
      const bodies = bodiesRef.current;
      const seeds = seedsRef.current;
      const cursor = cursorRef.current;
      const now = performance.now();
      const t = now / 1000;

      /* --- physics step --- */
      for (let b = 0; b < bodies.length; b++) {
        const body = bodies[b];
        const seed = seeds[b] || b;

        // Each bubble has a slowly rotating drift direction driven by
        // overlapping sine waves. We compute a TARGET velocity and blend
        // toward it — velocity is inherently bounded, can never accumulate.
        const angle =
          Math.sin(t * 0.13 + seed * 1.7) * Math.PI +
          Math.cos(t * 0.09 + seed * 2.3) * 0.5;
        const personalSpeed = DRIFT_SPEED + ((seed & 0xff) / 255) * 0.06;
        const targetVx = Math.cos(angle) * personalSpeed;
        const targetVy = Math.sin(angle) * personalSpeed;

        body.vx += (targetVx - body.vx) * DRIFT_BLEND;
        body.vy += (targetVy - body.vy) * DRIFT_BLEND;

        // cursor repulsion
        if (cursor) {
          const dx = body.x - cursor.x;
          const dy = body.y - cursor.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const zone = body.r + CURSOR_RADIUS;
          if (dist < zone && dist > 0.1) {
            const strength = (1 - dist / zone) * CURSOR_FORCE;
            body.vx += (dx / dist) * strength;
            body.vy += (dy / dist) * strength;
          }
        }

        // Smooth radius transition when timeframe changes
        body.r += (body.targetR - body.r) * 0.06;

        // Smooth color transition (0=red, 1=green)
        body.colorT += (body.targetColorT - body.colorT) * 0.06;

        body.x += body.vx;
        body.y += body.vy;
        containInBounds(body, width, height);
      }
      resolveCollisions(bodies);

      /* --- render --- */
      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        const el = gRefs.current[i];
        if (!el) continue;

        // squash & stretch based on velocity
        const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
        const stretch = Math.min(speed * 0.018, 0.1);

        // pop spring (click feedback)
        const popElapsed = (now - (popRef.current[i] || 0)) / 1000;
        const popScale = popRef.current[i]
          ? 1 + 0.12 * Math.exp(-popElapsed * 8) * Math.cos(popElapsed * 18)
          : 1;

        if (stretch > 0.004) {
          const angle = Math.atan2(body.vy, body.vx) * DEG;
          const sx = ((1 + stretch) * popScale).toFixed(3);
          const sy = ((1 / (1 + stretch)) * popScale).toFixed(3);
          el.setAttribute(
            "transform",
            `translate(${body.x.toFixed(1)},${body.y.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${sx},${sy}) rotate(${(-angle).toFixed(1)})`,
          );
        } else {
          const s = popScale.toFixed(3);
          el.setAttribute(
            "transform",
            popScale !== 1
              ? `translate(${body.x.toFixed(1)},${body.y.toFixed(1)}) scale(${s})`
              : `translate(${body.x.toFixed(1)},${body.y.toFixed(1)})`,
          );
        }

        // blob morph every 2 frames
        if (frame % 2 === 0) {
          const d = seeds[i] !== undefined ? blobPath(body.r, seeds[i], t) : null;
          if (d) {
            const pathEl = pathRefs.current[i];
            if (pathEl) pathEl.setAttribute("d", d);
            const riskEl = riskPathRefs.current[i];
            if (riskEl) riskEl.setAttribute("d", d);
          }
        }

        // smooth color transition
        if (frame % 4 === 0) {
          const pathEl = pathRefs.current[i];
          if (pathEl) {
            const ct = body.colorT;
            if (ct > 0.99) {
              pathEl.setAttribute("fill", "url(#org-green)");
            } else if (ct < 0.01) {
              pathEl.setAttribute("fill", "url(#org-red)");
            } else {
              // interpolate between red (#FF746C) and green (#6bc96b)
              const r = Math.round(0xFF + (0x6b - 0xFF) * ct);
              const g = Math.round(0x74 + (0xc9 - 0x74) * ct);
              const b2 = Math.round(0x6C + (0x6b - 0x6C) * ct);
              pathEl.setAttribute("fill", `rgb(${r},${g},${b2})`);
            }
          }
        }
      }

      frame++;
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [width, height]);

  /* ---- pointer tracking (mouse + touch) ---- */
  const toSVG = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      cursorRef.current = {
        x: (clientX - rect.left) * (width / rect.width),
        y: (clientY - rect.top) * (height / rect.height),
      };
    },
    [width, height],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => toSVG(e.clientX, e.clientY),
    [toSVG],
  );
  const handlePointerLeave = useCallback(() => {
    cursorRef.current = null;
  }, []);

  /* ---- pointer-down/up tracker for drag-vs-click detection ---- */
  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  const CLICK_DRAG_THRESHOLD_PX = 6;

  const handlePointerDownCapture = useCallback((e: React.PointerEvent) => {
    pointerDownRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
    };
  }, []);

  /* ---- click with pop, gated by drag threshold ---- */
  const handleBubbleClick = useCallback(
    (coin: Coin, index: number, e: React.MouseEvent) => {
      const down = pointerDownRef.current;
      pointerDownRef.current = null;
      if (down) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD_PX) {
          // Treat as drag, not a click — bail without opening modal
          return;
        }
      }
      popRef.current[index] = performance.now();
      onSelect(coin);
    },
    [onSelect],
  );

  /* ---- ref setters ---- */
  const setGRef = useCallback(
    (index: number) => (el: SVGGElement | null) => {
      gRefs.current[index] = el;
    },
    [],
  );
  const setRiskPathRef = useCallback(
    (index: number) => (el: SVGPathElement | null) => {
      riskPathRefs.current[index] = el;
    },
    [],
  );
  const setPathRef = useCallback(
    (index: number) => (el: SVGPathElement | null) => {
      pathRefs.current[index] = el;
    },
    [],
  );

  if (!width || !height) return null;

  return (
    <svg
      ref={svgRef}
      className="bubble-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Crypto market bubble chart"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDownCapture={handlePointerDownCapture}
      style={{ touchAction: "pan-y" }}
    >
      <defs>
        <linearGradient id="org-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6bc96b" />
          <stop offset="100%" stopColor="#5bb85b" />
        </linearGradient>
        <linearGradient id="org-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF746C" />
          <stop offset="100%" stopColor="#e8635b" />
        </linearGradient>
      </defs>

      {layoutNodes.map((node, i) => {
        const coin = node.data;
        const change = getChangeForTimeFrame(coin, timeFrame);
        const positive = change >= 0;
        const clipId = `clip-${coin.id}`;
        const seed = hashSeed(coin.id);

        const isHighRisk = highRiskSet.has(coin.id);

        // Medal outline for top 3 gainers / losers
        const medal = medalMap.get(coin.id);
        const medalStroke = medal === "gold"
          ? "#ffd700"
          : medal === "silver"
            ? "#e0e0e0"
            : medal === "bronze"
              ? "#e8a04e"
              : null;
        const medalWidth = medal === "gold" ? 5 : medal === "silver" ? 4.5 : medal === "bronze" ? 4 : 0;

        const showSymbol = node.r > 8;
        const showIcon = node.r > 30;
        const showPct = node.r > 20;
        const iconSize = Math.min(node.r * 0.48, 26);
        const fontSizeSymbol = Math.min(node.r * 0.36, 20);
        const fontSizePct = Math.min(node.r * 0.25, 13);

        return (
          <g
            key={coin.id}
            ref={setGRef(i)}
            transform={`translate(${node.x},${node.y})`}
            className="bubble-node"
          >
            <title>
              {coin.name}: {change.toFixed(2)}% ({timeFrame})
              {isHighRisk ? " — higher risk" : ""}
            </title>

            <clipPath id={clipId}>
              <circle r={node.r * 0.85} />
            </clipPath>

            <path
              ref={setPathRef(i)}
              d={blobPath(node.r, seed, 0)}
              fill={positive ? "url(#org-green)" : "url(#org-red)"}
              stroke={medalStroke ?? (positive ? "#2d8a2d" : "#b03a33")}
              strokeWidth={medalStroke ? medalWidth : 2.5}
              className="bubble-hit"
              onClick={(e) => handleBubbleClick(coin, i, e)}
            />

            {isHighRisk && !medal && (
              <path
                ref={setRiskPathRef(i)}
                d={blobPath(node.r, seed, 0)}
                fill="none"
                stroke="#ffab40"
                strokeWidth={3.5}
                strokeDasharray="8 4"
                style={{ pointerEvents: "none" }}
              />
            )}

            <g clipPath={`url(#${clipId})`}>
              {showIcon && (
                <image
                  href={coin.image}
                  x={-iconSize / 2}
                  y={-node.r * 0.44}
                  width={iconSize}
                  height={iconSize}
                  opacity={0.9}
                  style={{ pointerEvents: "none" }}
                />
              )}

              {showSymbol && (
                <text
                  textAnchor="middle"
                  fill="#fff"
                  stroke="#000"
                  strokeWidth={node.r > 20 ? 2.5 : 1.5}
                  paintOrder="stroke"
                  fontWeight={600}
                  fontSize={fontSizeSymbol}
                  fontFamily="var(--font-bubble), Fredoka, sans-serif"
                  y={
                    showIcon
                      ? fontSizeSymbol * 0.45
                      : showPct
                        ? -fontSizePct * 0.2
                        : fontSizeSymbol * 0.38
                  }
                  style={{ pointerEvents: "none" }}
                >
                  {coin.symbol.toUpperCase()}
                </text>
              )}

              {showPct && (
                <text
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.9)"
                  stroke="#000"
                  strokeWidth={node.r > 20 ? 2 : 1}
                  paintOrder="stroke"
                  fontWeight={500}
                  fontSize={fontSizePct}
                  fontFamily="var(--font-bubble), Fredoka, sans-serif"
                  y={
                    showIcon
                      ? fontSizeSymbol * 0.45 + fontSizePct * 1.3
                      : fontSizePct * 1.15
                  }
                  style={{ pointerEvents: "none" }}
                >
                  {change.toFixed(1)}%
                </text>
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
