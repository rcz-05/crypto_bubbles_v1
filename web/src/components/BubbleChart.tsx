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
  const nodes = useMemo(() => {
    if (!width || !height || !data.length) return [] as Node[];

    const root = hierarchy<{ children: Coin[] }>({ children: data }).sum((d) =>
      "market_cap" in d ? Math.max(1, d.market_cap) : 0,
    );

    const packer = pack<{ children: Coin[] }>().size([width, height]).padding(3);

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
      {nodes.map((node) => {
        const coin = node.data;
        const positive = (coin.price_change_percentage_24h ?? 0) >= 0;
        const fill = positive ? "#00b853" : "#d32f2f";
        const fontSize = Math.max(12, Math.min(32, node.r / 2.2));
        const pctSize = Math.max(10, fontSize * 0.65);
        return (
          <g
            key={coin.id}
            transform={`translate(${node.x},${node.y})`}
            onClick={() => onSelect(coin)}
            style={{ cursor: "pointer" }}
          >
            <circle
              r={node.r}
              fill={fill}
              fillOpacity={0.82}
              stroke={positive ? "#1fd679" : "#ff6b6b"}
              strokeWidth={1.5}
              filter="drop-shadow(0 8px 18px rgba(0,0,0,0.45))"
            />
            <text
              textAnchor="middle"
              fill="#fff"
              fontWeight={700}
              fontSize={fontSize}
              dominantBaseline="middle"
              pointerEvents="none"
            >
              {coin.symbol.toUpperCase()}
            </text>
            <text
              textAnchor="middle"
              fill="#f2f2f2"
              fontWeight={600}
              fontSize={pctSize}
              y={fontSize * 0.9}
              pointerEvents="none"
            >
              {(coin.price_change_percentage_24h ?? 0).toFixed(1)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
