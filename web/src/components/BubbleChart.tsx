"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { hierarchy, pack } from "d3-hierarchy";
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
  targetX: number;
  targetY: number;
};

/* ------------------------------------------------------------------ */
/*  Physics tuning                                                     */
/* ------------------------------------------------------------------ */
const SPRING = 0.006;           // spring stiffness for return-to-target
const DAMPING = 0.93;           // velocity decay — slightly bouncy
const DRIFT = 0.04;             // ambient jitter
const COLLISION_STRENGTH = 0.6; // push-apart force on overlap
const WALL_PADDING = 2;
const BUBBLE_GAP = 5;
const CURSOR_RADIUS = 60;       // repulsion zone around pointer (px)
const CURSOR_FORCE = 1.2;       // max repulsion strength — gentle enough to click
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
  const n = 10;
  const wobble = r * 0.12;
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
  type PackDatum = Coin & { children?: PackDatum[] };

  const layoutNodes = useMemo(() => {
    if (!width || !height || !data.length) return [] as LayoutNode[];

    const root = hierarchy<PackDatum>({ children: data } as PackDatum).sum((d) => {
      if (timeFrame === "market_cap") {
        return Math.max(1, d.market_cap ?? 0);
      }
      const change = Math.abs(getChangeForTimeFrame(d as Coin, timeFrame));
      return Math.max(0.1, change);
    });

    const packer = pack<PackDatum>().size([width, height]).padding(5);

    return packer(root)
      .leaves()
      .map((leaf) => ({
        x: leaf.x,
        y: leaf.y,
        r: leaf.r,
        data: leaf.data as Coin,
      }));
  }, [data, width, height, timeFrame]);

  /* ---- refs ---- */
  const bodiesRef = useRef<PhysicsBody[]>([]);
  const gRefs = useRef<(SVGGElement | null)[]>([]);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const seedsRef = useRef<number[]>([]);
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const popRef = useRef<number[]>([]);        // timestamp of last click per bubble
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number>(0);
  const mountedRef = useRef(true);

  /* ---- sync bodies + seeds ---- */
  useEffect(() => {
    const prev = bodiesRef.current;
    const prevMap = new Map<string, PhysicsBody>();
    if (prev.length > 0) {
      prev.forEach((b, i) => prevMap.set(`idx-${i}`, b));
    }
    bodiesRef.current = layoutNodes.map((node, i) => {
      const existing = prevMap.get(`idx-${i}`);
      if (existing && Math.abs(existing.targetX - node.x) < node.r * 3) {
        existing.targetX = node.x;
        existing.targetY = node.y;
        existing.r = node.r;
        return existing;
      }
      return {
        x: node.x, y: node.y,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        r: node.r, targetX: node.x, targetY: node.y,
      };
    });
    seedsRef.current = layoutNodes.map((n) => hashSeed(n.data.id));
    popRef.current = new Array(layoutNodes.length).fill(0);
  }, [layoutNodes]);

  /* ---- scroll momentum ---- */
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const dy = window.scrollY - lastY;
      lastY = window.scrollY;
      for (const body of bodiesRef.current) {
        body.vy += dy * 0.12;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      for (const body of bodies) {
        // spring back to target
        body.vx += (body.targetX - body.x) * SPRING;
        body.vy += (body.targetY - body.y) * SPRING;

        // ambient drift
        body.vx += (Math.random() - 0.5) * DRIFT;
        body.vy += (Math.random() - 0.5) * DRIFT;

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

        body.vx *= DAMPING;
        body.vy *= DAMPING;
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
          const pathEl = pathRefs.current[i];
          if (pathEl && seeds[i] !== undefined) {
            pathEl.setAttribute("d", blobPath(body.r, seeds[i], t));
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

  /* ---- click with pop ---- */
  const handleBubbleClick = useCallback(
    (coin: Coin, index: number) => {
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
      style={{ touchAction: "pan-y" }}
    >
      <defs>
        <linearGradient id="org-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22664D" />
          <stop offset="100%" stopColor="#1B4D3E" />
        </linearGradient>
        <linearGradient id="org-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C93030" />
          <stop offset="100%" stopColor="#B22222" />
        </linearGradient>
      </defs>

      {layoutNodes.map((node, i) => {
        const coin = node.data;
        const change = getChangeForTimeFrame(coin, timeFrame);
        const positive = change >= 0;
        const clipId = `clip-${coin.id}`;
        const seed = hashSeed(coin.id);

        const isHighRisk =
          (coin.market_cap_rank != null && coin.market_cap_rank > 25) ||
          Math.abs(change) > 15;

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
            onClick={() => handleBubbleClick(coin, i)}
            className="bubble-node"
            style={{ cursor: "pointer" }}
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
              stroke={positive ? "rgba(52,211,153,0.28)" : "rgba(248,113,113,0.28)"}
              strokeWidth={2}
            />

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
                  fontWeight={700}
                  fontSize={fontSizeSymbol}
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
                  fill="rgba(255,255,255,0.82)"
                  fontWeight={600}
                  fontSize={fontSizePct}
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
