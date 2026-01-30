import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Vibration
} from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { generateClient } from 'aws-amplify/data';
import BubbleChart from '../components/BubbleChart';
import useMarketStore from '../store/marketStore';
import type { Schema } from '../amplify/data/resource';

const client = generateClient<Schema>();

export default function HomeScreen() {
  const { coins, loading, error, fetchData } = useMarketStore();
  const [query, setQuery] = useState('');
  const fadeIn = useRef(new Animated.Value(0)).current;
  const lastShake = useRef(0);

  const filteredCoins = useMemo(() => {
    if (!query.trim()) return coins;
    const lower = query.trim().toLowerCase();
    return coins.filter(
      (coin) =>
        coin.symbol.toLowerCase().includes(lower) ||
        (coin.name && coin.name.toLowerCase().includes(lower))
    );
  }, [coins, query]);

  const handleRefresh = useCallback(
    async (viaShake = false) => {
      await fetchData();
      if (viaShake) {
        Vibration.vibrate(80);
      }
    },
    [fetchData]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (coins.length) {
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true
      }).start();
    }
  }, [coins.length, fadeIn]);

  useEffect(() => {
    Accelerometer.setUpdateInterval(200);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (magnitude > 1.5) {
        const now = Date.now();
        if (now - lastShake.current > 1200) {
          lastShake.current = now;
          handleRefresh(true);
        }
      }
    });
    return () => subscription?.remove();
  }, [handleRefresh]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <HeaderTabs />

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search cryptocurrency"
          placeholderTextColor="#9ca3af"
          style={styles.search}
        />

        {loading && coins.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color="#4ade80" />
            <Text style={styles.muted}>Loading market data...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.error}>Failed to load data.</Text>
            <Text style={styles.muted}>{error}</Text>
          </View>
        ) : (
          <Animated.View style={{ flex: 1, opacity: fadeIn }}>
            <BubbleChart
              data={filteredCoins}
              onLongPress={async (coin) => {
                try {
                  await client.models.FavoriteCoin.create({
                    symbol: coin.symbol,
                    name: coin.name ?? coin.id,
                    addedAt: new Date().toISOString()
                  });
                  Alert.alert('Saved', `${coin.symbol.toUpperCase()} added to favorites`);
                } catch (err) {
                  console.warn('Failed to save favorite (is Amplify configured?)', err);
                  Alert.alert('Offline', 'Connect Amplify to enable saving favorites.');
                }
              }}
            />
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

function HeaderTabs() {
  const tabs = ['Hour', 'Day', 'Week', 'Month', 'Year', 'Market Cap & Day'];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabsContainer}
    >
      {tabs.map((label, idx) => (
        <View key={label} style={[styles.tab, idx === 3 && styles.tabActive]}>
          <Text style={[styles.tabText, idx === 3 && styles.tabTextActive]}>{label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1a1a1a'
  },
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 12
  },
  search: {
    backgroundColor: '#0f172a',
    color: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#111827'
  },
  tabsContainer: {
    gap: 8,
    paddingVertical: 4
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220'
  },
  tabActive: {
    backgroundColor: '#111827',
    borderColor: '#4ade80'
  },
  tabText: {
    color: '#94a3b8',
    fontWeight: '500'
  },
  tabTextActive: {
    color: '#e5e7eb'
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  muted: {
    color: '#9ca3af'
  },
  error: {
    color: '#f87171',
    fontWeight: '600'
  }
});
