import React, { useMemo } from 'react';
import { Alert, Dimensions } from 'react-native';
import Svg, { Circle, G, Text } from 'react-native-svg';
import { hierarchy, pack } from 'd3-hierarchy';
import type { Coin } from '../services/coingecko';

type Props = {
  data: Coin[];
  onLongPress?: (coin: Coin) => void;
  onPress?: (coin: Coin) => void;
};

export default function BubbleChart({ data, onLongPress, onPress }: Props) {
  const { width, height } = Dimensions.get('window');
  const diameter = Math.min(width, height * 0.9);
  const handlePress = onPress
    ? onPress
    : (coin: Coin) =>
        Alert.alert(
          coin.name ?? coin.symbol.toUpperCase(),
          `$${coin.current_price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
        );

  const nodes = useMemo(() => {
    const root = hierarchy<{ children: Coin[] }>({ children: data }).sum((d: any) => d.market_cap);
    return pack<{ children: Coin[] }>()
      .size([diameter, diameter])
      .padding(6)(root)
      .leaves();
  }, [data, diameter]);

  return (
    <Svg width={width} height={height * 0.75} viewBox={`0 0 ${diameter} ${diameter}`}>
      {nodes.map((node) => {
        const coin = node.data as unknown as Coin;
        const fill = (coin.price_change_percentage_24h ?? 0) >= 0 ? '#00b853' : '#d32f2f';
        const fontSize = Math.max(12, Math.min(22, node.r / 2.8));

        return (
          <G
            key={coin.id}
            x={node.x}
            y={node.y}
            onPress={() => handlePress(coin)}
            onLongPress={() => onLongPress?.(coin)}
          >
            <Circle r={node.r} fill={fill} opacity={0.9} stroke="#111827" strokeWidth={2} />
            <Text
              fill="#fff"
              fontSize={fontSize}
              fontWeight="bold"
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {coin.symbol.toUpperCase()}
            </Text>
          </G>
        );
      })}
    </Svg>
  );
}
