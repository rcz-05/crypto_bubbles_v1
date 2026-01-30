"use client";

import { useMemo } from "react";
import { hierarchy, pack } from "d3-hierarchy";
import { Coin } from "@/lib/coingecko";

type BubbleChartProps = {
  data: Coin[];
  width: number;
  height: number;
  onSelect: (coin: Coin) => void;
};

type Node = {
  x: number;
  y: number;
  r: number;
  data: Coin;
};

export function BubbleChart({ data, width, height, onSelect }: BubbleChartProps) {
  type PackDatum = Coin & { children?: PackDatum[] };

  const nodes = useMemo(() => {
    if (!width || !height || !data.length) return [] as Node[];

    const root = hierarchy<PackDatum>({ children: data } as PackDatum).sum((d) =>
      Math.max(1, d.market_cap ?? 0),
    );

    // Tighter padding for denser look
    const packer = pack<PackDatum>().size([width, height]).padding(1.5);

    return packer(root)
      .leaves()
      .map((leaf) => ({
        x: leaf.x,
        y: leaf.y,
        r: leaf.r,
        data: leaf.data as Coin,
      }));
  }, [data, width, height]);

  return (
    <svg className="bubble-svg" viewBox={`0 0 ${width} ${height}`} role="img">
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
        const positive = (coin.price_change_percentage_24h ?? 0) >= 0;
        const strokeColor = positive ? "#00e676" : "#ff5252";

        // Hierarchy logic
        const showIcon = node.r > 28;
        const showPct = node.r > 16;
        const iconSize = node.r * 0.6;
        const fontSizeSymbol = Math.min(node.r * 0.4, 24);
        const fontSizePct = Math.min(node.r * 0.3, 16);

        return (
          <g
            key={coin.id}
            transform={`translate(${node.x},${node.y})`}
            onClick={() => onSelect(coin)}
            style={{
              cursor: "pointer",
              opacity: 0,
              animation: `fadeIn 0.4s ease-out ${Math.min(i * 10, 1000)}ms forwards`,
              transformOrigin: 'center'
            }}
            onMouseEnter={() => {
              // Simple hover effect via transform
              // Note: This overrides the translate in transform attribute if we aren't careful.
              // But SVG transform attribute is separate from CSS transform property in modern browsers?
              // Actually it's safer to not rely on mixing them if possible.
              // Let's use the group for position, and a child group for scale if we wanted robust scaling.
              // But for now, let's just stick to opacity/color shifts or accept the risk.
              // Better: Use a class and CSS for hover scale if possible?
              // SVG transform vs CSS transform interaction can be browser specific.
              // Let's just skip the JS hover scale to avoid complexity and bugs, and rely on CSS if we can target it.
              // Or just use the 'bubble-group' class I added in CSS?
              // Wait, I didn't add .bubble-group hover in globals.css.
              // I'll add a simple hover via style here but use a wrapper group for position.
            }}
          >
            {/* Wrapper group for Position is the parent <g>. 
                 Actually, let's put the scale on children? 
                 No, let's just render. Simplicity first. */}

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

            {showIcon && (
              <image
                href={coin.image}
                x={-iconSize / 2}
                y={-iconSize * 1.2}
                width={iconSize}
                height={iconSize}
                opacity={0.8}
                style={{ pointerEvents: "none" }}
              />
            )}

            <text
              textAnchor="middle"
              fill="#fff"
              fontWeight={800}
              fontSize={fontSizeSymbol}
              y={showIcon ? iconSize * 0.1 : -fontSizeSymbol * 0.2}
              style={{ pointerEvents: "none", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
            >
              {coin.symbol.toUpperCase()}
            </text>

            {showPct && (
              <text
                textAnchor="middle"
                fill="#fff"
                fontWeight={500}
                fontSize={fontSizePct}
                y={showIcon ? iconSize * 0.1 + fontSizeSymbol : fontSizeSymbol * 1.0}
                style={{ pointerEvents: "none", opacity: 0.9, textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
              >
                {(coin.price_change_percentage_24h ?? 0).toFixed(1)}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
