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

// Physics tuning — gentle drift with tight packing
const SPRING = 0.004;
const DAMPING = 0.95;
const DRIFT = 0.06;
const COLLISION_STRENGTH = 0.5;
const WALL_PADDING = 2;

function resolveCollisions(bodies: PhysicsBody[]) {
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = a.r + b.r + 1;

      if (dist < minDist && dist > 0.01) {
        const overlap = (minDist - dist) * 0.5 * COLLISION_STRENGTH;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;

        const dvx = (b.vx - a.vx) * 0.12;
        const dvy = (b.vy - a.vy) * 0.12;
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
    body.vx = Math.abs(body.vx) * 0.25;
  }
  if (body.x + body.r > w - pad) {
    body.x = w - body.r - pad;
    body.vx = -Math.abs(body.vx) * 0.25;
  }
  if (body.y - body.r < pad) {
    body.y = body.r + pad;
    body.vy = Math.abs(body.vy) * 0.25;
  }
  if (body.y + body.r > h - pad) {
    body.y = h - body.r - pad;
    body.vy = -Math.abs(body.vy) * 0.25;
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

    const packer = pack<PackDatum>().size([width, height]).padding(1);

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
        x: node.x,
        y: node.y,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        r: node.r,
        targetX: node.x,
        targetY: node.y,
      };
    });
  }, [layoutNodes]);

  // Animation loop
  useEffect(() => {
    mountedRef.current = true;

    function tick() {
      if (!mountedRef.current) return;
      const bodies = bodiesRef.current;

      for (const body of bodies) {
        body.vx += (body.targetX - body.x) * SPRING;
        body.vy += (body.targetY - body.y) * SPRING;
        body.vx += (Math.random() - 0.5) * DRIFT;
        body.vy += (Math.random() - 0.5) * DRIFT;
        body.vx *= DAMPING;
        body.vy *= DAMPING;
        body.x += body.vx;
        body.y += body.vy;
        containInBounds(body, width, height);
      }

      resolveCollisions(bodies);

      for (let i = 0; i < bodies.length; i++) {
        const el = gRefs.current[i];
        if (el) {
          el.setAttribute(
            "transform",
            `translate(${bodies[i].x.toFixed(1)},${bodies[i].y.toFixed(1)})`,
          );
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
        {/* Flat 2D soft gradients — very subtle top-to-bottom tint for organic feel */}
        <linearGradient id="flat-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
        <linearGradient id="flat-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#f43f5e" />
        </linearGradient>
      </defs>

      {layoutNodes.map((node, i) => {
        const coin = node.data;
        const change = getChangeForTimeFrame(coin, timeFrame);
        const positive = change >= 0;
        const clipId = `clip-${coin.id}`;

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
            onClick={() => onSelect(coin)}
            className="bubble-node"
            style={{ cursor: "pointer" }}
          >
            <title>
              {coin.name}: {change.toFixed(2)}% ({timeFrame})
              {isHighRisk ? " — higher risk" : ""}
            </title>

            <clipPath id={clipId}>
              <circle r={node.r - 1} />
            </clipPath>

            {/* Flat 2D circle with soft border */}
            <circle
              r={node.r}
              fill={positive ? "url(#flat-green)" : "url(#flat-red)"}
              stroke={positive ? "rgba(134,239,172,0.3)" : "rgba(253,164,175,0.3)"}
              strokeWidth={1.5}
            />

            <g clipPath={`url(#${clipId})`}>
              {showIcon && (
                <image
                  href={coin.image}
                  x={-iconSize / 2}
                  y={-node.r * 0.48}
                  width={iconSize}
                  height={iconSize}
                  opacity={0.92}
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
                      ? fontSizeSymbol * 0.4
                      : showPct
                        ? -fontSizePct * 0.25
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
                  fill="#fff"
                  fontWeight={600}
                  fontSize={fontSizePct}
                  y={
                    showIcon
                      ? fontSizeSymbol * 0.4 + fontSizePct * 1.25
                      : fontSizePct * 1.15
                  }
                  style={{
                    pointerEvents: "none",
                    opacity: 0.88,
                  }}
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
