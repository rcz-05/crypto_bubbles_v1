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

// --- Physics constants ---
const SPRING = 0.003;
const DAMPING = 0.96;
const DRIFT = 0.08;
const COLLISION_STRENGTH = 0.4;
const WALL_PADDING = 4;

function resolveCollisions(bodies: PhysicsBody[]) {
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = a.r + b.r + 1.5;

      if (dist < minDist && dist > 0) {
        const overlap = (minDist - dist) * 0.5 * COLLISION_STRENGTH;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;

        // Transfer a small amount of velocity
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
  if (body.x - body.r < WALL_PADDING) {
    body.x = body.r + WALL_PADDING;
    body.vx = Math.abs(body.vx) * 0.3;
  }
  if (body.x + body.r > w - WALL_PADDING) {
    body.x = w - body.r - WALL_PADDING;
    body.vx = -Math.abs(body.vx) * 0.3;
  }
  if (body.y - body.r < WALL_PADDING) {
    body.y = body.r + WALL_PADDING;
    body.vy = Math.abs(body.vy) * 0.3;
  }
  if (body.y + body.r > h - WALL_PADDING) {
    body.y = h - body.r - WALL_PADDING;
    body.vy = -Math.abs(body.vy) * 0.3;
  }
}

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

    const packer = pack<PackDatum>().size([width, height]).padding(2);

    return packer(root)
      .leaves()
      .map((leaf) => ({
        x: leaf.x,
        y: leaf.y,
        r: leaf.r,
        data: leaf.data as Coin,
      }));
  }, [data, width, height, timeFrame]);

  const bodiesRef = useRef<PhysicsBody[]>([]);
  const gRefs = useRef<(SVGGElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const mountedRef = useRef(true);

  // Sync physics bodies when layout changes
  useEffect(() => {
    const prev = bodiesRef.current;
    const prevMap = new Map<string, PhysicsBody>();
    const prevLayoutLen = prev.length;

    // Index previous bodies by coin id if they exist at same index
    if (prevLayoutLen > 0) {
      // We'll try to match by position heuristic
      prev.forEach((b, i) => {
        prevMap.set(`idx-${i}`, b);
      });
    }

    bodiesRef.current = layoutNodes.map((node, i) => {
      const existing = prevMap.get(`idx-${i}`);
      if (existing && Math.abs(existing.targetX - node.x) < node.r * 3) {
        // Keep current animated position but update target
        existing.targetX = node.x;
        existing.targetY = node.y;
        existing.r = node.r;
        return existing;
      }
      return {
        x: node.x,
        y: node.y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: node.r,
        targetX: node.x,
        targetY: node.y,
      };
    });
  }, [layoutNodes]);

  // Animation loop — updates DOM directly, no React re-renders
  useEffect(() => {
    mountedRef.current = true;

    function tick() {
      if (!mountedRef.current) return;
      const bodies = bodiesRef.current;

      for (const body of bodies) {
        // Spring toward layout target
        body.vx += (body.targetX - body.x) * SPRING;
        body.vy += (body.targetY - body.y) * SPRING;

        // Random drift
        body.vx += (Math.random() - 0.5) * DRIFT;
        body.vy += (Math.random() - 0.5) * DRIFT;

        // Damping
        body.vx *= DAMPING;
        body.vy *= DAMPING;

        body.x += body.vx;
        body.y += body.vy;

        containInBounds(body, width, height);
      }

      resolveCollisions(bodies);

      // Write transforms directly to DOM
      for (let i = 0; i < bodies.length; i++) {
        const el = gRefs.current[i];
        if (el) {
          el.setAttribute("transform", `translate(${bodies[i].x.toFixed(1)},${bodies[i].y.toFixed(1)})`);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [width, height]);

  const setGRef = useCallback(
    (index: number) => (el: SVGGElement | null) => {
      gRefs.current[index] = el;
    },
    [],
  );

  if (!width || !height) return null;

  return (
    <svg
      className="bubble-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Crypto market bubble chart"
    >
      <defs>
        {/* Modern green gradient — solid, saturated */}
        <radialGradient id="fill-pos" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </radialGradient>
        <radialGradient id="fill-neg" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#e11d48" />
        </radialGradient>

        {/* Highlight for depth — a subtle bright spot */}
        <radialGradient id="highlight" cx="35%" cy="25%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>

        {/* Soft drop shadow */}
        <filter id="bubble-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.3" />
        </filter>

        {/* Risk glow */}
        <filter id="risk-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#f59e0b" floodOpacity="0.4" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {layoutNodes.map((node, i) => {
        const coin = node.data;
        const change = getChangeForTimeFrame(coin, timeFrame);
        const positive = change >= 0;
        const clipId = `clip-${coin.id}`;

        const isHighRisk =
          (coin.market_cap_rank != null && coin.market_cap_rank > 25) ||
          Math.abs(change) > 15;

        const showSymbol = node.r > 10;
        const showIcon = node.r > 32;
        const showPct = node.r > 22;
        const iconSize = Math.min(node.r * 0.5, 28);
        const fontSizeSymbol = Math.min(node.r * 0.38, 22);
        const fontSizePct = Math.min(node.r * 0.26, 14);

        return (
          <g
            key={coin.id}
            ref={setGRef(i)}
            transform={`translate(${node.x},${node.y})`}
            onClick={() => onSelect(coin)}
            className="bubble-node"
            style={{ cursor: "pointer" }}
            filter={isHighRisk && node.r > 14 ? "url(#risk-glow)" : undefined}
          >
            <title>
              {coin.name}: {change.toFixed(2)}% ({timeFrame}){isHighRisk ? " — higher risk" : ""}
            </title>

            <clipPath id={clipId}>
              <circle r={node.r - 1} />
            </clipPath>

            {/* Main filled bubble */}
            <circle
              r={node.r}
              fill={positive ? "url(#fill-pos)" : "url(#fill-neg)"}
              filter="url(#bubble-shadow)"
            />

            {/* Highlight for subtle 3D depth */}
            <circle r={node.r} fill="url(#highlight)" />

            {/* Thin border ring */}
            <circle
              r={node.r - 0.5}
              fill="none"
              stroke={positive ? "#6ee7b7" : "#fda4af"}
              strokeWidth={1}
              strokeOpacity={0.3}
            />

            <g clipPath={`url(#${clipId})`}>
              {showIcon && (
                <image
                  href={coin.image}
                  x={-iconSize / 2}
                  y={-node.r * 0.52}
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
                  y={showIcon ? fontSizeSymbol * 0.35 : showPct ? -fontSizePct * 0.3 : fontSizeSymbol * 0.35}
                  style={{ pointerEvents: "none" }}
                >
                  {coin.symbol.toUpperCase()}
                </text>
              )}

              {showPct && (
                <text
                  textAnchor="middle"
                  fill="#fff"
                  fontWeight={500}
                  fontSize={fontSizePct}
                  y={showIcon ? fontSizeSymbol * 0.35 + fontSizePct * 1.2 : fontSizePct * 1.1}
                  style={{ pointerEvents: "none", opacity: 0.9 }}
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
