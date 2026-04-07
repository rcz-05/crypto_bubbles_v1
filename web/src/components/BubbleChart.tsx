"use client";

import { useMemo } from "react";
import { hierarchy, pack } from "d3-hierarchy";
import { Coin, TimeFrame, getChangeForTimeFrame } from "@/lib/coingecko";

type BubbleChartProps = {
  data: Coin[];
  width: number;
  height: number;
  timeFrame: TimeFrame;
  onSelect: (coin: Coin) => void;
};

type Node = {
  x: number;
  y: number;
  r: number;
  data: Coin;
};

export function BubbleChart({ data, width, height, timeFrame, onSelect }: BubbleChartProps) {
  type PackDatum = Coin & { children?: PackDatum[] };

  const nodes = useMemo(() => {
    if (!width || !height || !data.length) return [] as Node[];

    const root = hierarchy<PackDatum>({ children: data } as PackDatum).sum((d) => {
      if (timeFrame === "market_cap") {
        return Math.max(1, d.market_cap ?? 0);
      }
      // Size by absolute % change in selected window — makes fast movers visible
      const change = Math.abs(getChangeForTimeFrame(d as Coin, timeFrame));
      return Math.max(0.1, change);
    });

    const packer = pack<PackDatum>().size([width, height]).padding(1.5);

    return packer(root)
      .leaves()
      .map((leaf) => ({
        x: leaf.x,
        y: leaf.y,
        r: leaf.r,
        data: leaf.data as Coin,
      }));
  }, [data, width, height, timeFrame]);

  return (
    <svg
      className="bubble-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Crypto market bubble chart"
    >
      <defs>
        <radialGradient id="grad-pos" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#00e676" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#00b853" stopOpacity="0.1" />
        </radialGradient>
        <radialGradient id="grad-neg" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ff5252" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#d32f2f" stopOpacity="0.1" />
        </radialGradient>
        <filter id="glow-pos" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="shadow-inner">
          <feComposite operator="in" in2="SourceGraphic" />
        </filter>
      </defs>

      {nodes.map((node, i) => {
        const coin = node.data;
        const change = getChangeForTimeFrame(coin, timeFrame);
        const positive = change >= 0;
        const strokeColor = positive ? "#00e676" : "#ff5252";
        const clipId = `clip-${coin.id}`;

        // Risk tier: coins outside top-25 or with extreme moves get a visual warning
        const isHighRisk =
          (coin.market_cap_rank != null && coin.market_cap_rank > 25) ||
          Math.abs(change) > 15;

        // Tiered visibility: hide labels entirely for very small bubbles
        const showSymbol = node.r > 10;
        const showIcon = node.r > 32;
        const showPct = node.r > 22;
        const iconSize = Math.min(node.r * 0.5, 28);
        const fontSizeSymbol = Math.min(node.r * 0.38, 22);
        const fontSizePct = Math.min(node.r * 0.26, 14);

        return (
          <g
            key={coin.id}
            transform={`translate(${node.x},${node.y})`}
            onClick={() => onSelect(coin)}
            className="bubble-node"
            style={{
              cursor: "pointer",
              opacity: 0,
              animation: `fadeIn 0.4s ease-out ${Math.min(i * 10, 1000)}ms forwards`,
              transformOrigin: "center",
            }}
          >
            <title>
              {coin.name}: {change.toFixed(2)}% ({timeFrame}){isHighRisk ? " — higher risk" : ""}
            </title>

            <clipPath id={clipId}>
              <circle r={node.r * 0.92} />
            </clipPath>

            {isHighRisk && node.r > 12 && (
              <circle
                r={node.r + 3}
                fill="none"
                stroke="#ff9800"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                strokeOpacity={0.6}
              />
            )}

            <circle
              r={node.r}
              fill={positive ? "rgba(0, 230, 118, 0.15)" : "rgba(255, 82, 82, 0.15)"}
              stroke={strokeColor}
              strokeWidth={1.5}
              strokeOpacity={0.6}
            />

            <circle
              r={node.r * 0.9}
              fill={positive ? "url(#grad-pos)" : "url(#grad-neg)"}
              opacity={0.6}
            />

            <g clipPath={`url(#${clipId})`}>
              {showIcon && (
                <image
                  href={coin.image}
                  x={-iconSize / 2}
                  y={-node.r * 0.55}
                  width={iconSize}
                  height={iconSize}
                  opacity={0.8}
                  style={{ pointerEvents: "none" }}
                />
              )}

              {showSymbol && (
                <text
                  textAnchor="middle"
                  fill="#fff"
                  fontWeight={800}
                  fontSize={fontSizeSymbol}
                  y={showIcon ? fontSizeSymbol * 0.35 : showPct ? -fontSizePct * 0.3 : fontSizeSymbol * 0.35}
                  style={{ pointerEvents: "none", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
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
                  style={{
                    pointerEvents: "none",
                    opacity: 0.85,
                    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
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
