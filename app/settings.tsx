import { Linking, SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.muted}>
          This page is a placeholder for assignment settings (theme, currency, data source).
        </Text>
        <Text style={styles.link} onPress={() => Linking.openURL('https://www.coingecko.com')}>
          Data courtesy of CoinGecko
        </Text>
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
    gap: 10
  },
  title: {
    color: '#e5e7eb',
    fontSize: 22,
    fontWeight: '700'
  },
  muted: {
    color: '#9ca3af'
  },
  link: {
    color: '#4ade80',
    fontWeight: '600'
  }
});
