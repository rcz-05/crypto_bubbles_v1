import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';

type Favorite = Schema['FavoriteCoin']['type'];

const client = generateClient<Schema>();

export default function FavoritesScreen() {
  const [items, setItems] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await client.models.FavoriteCoin.list();
        setItems(data);
      } catch (err) {
        setError('Connect Amplify to list favorites.');
        console.warn('Favorites fetch failed', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Saved Coins</Text>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#4ade80" />
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : items.length === 0 ? (
          <Text style={styles.muted}>No favorites yet. Long-press a bubble to save it.</Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.symbol}>{item.symbol.toUpperCase()}</Text>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.date}>
                  {new Date(item.addedAt || '').toLocaleDateString() || '—'}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1a1a1a'
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 12
  },
  title: {
    color: '#e5e7eb',
    fontSize: 22,
    fontWeight: '700'
  },
  muted: {
    color: '#9ca3af'
  },
  error: {
    color: '#f87171'
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10
  },
  symbol: {
    color: '#e5e7eb',
    fontWeight: '700',
    fontSize: 18
  },
  name: {
    color: '#cbd5e1',
    flex: 1,
    marginLeft: 12
  },
  date: {
    color: '#94a3b8',
    fontSize: 12
  },
  separator: {
    height: 1,
    backgroundColor: '#111827'
  }
});
