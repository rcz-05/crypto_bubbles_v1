import 'react-native-get-random-values';
import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Amplify } from 'aws-amplify';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

const configureAmplify = () => {
  try {
    // The real file is produced by `amplify push`. This placeholder keeps the app stable in dev.
    // Replace with your generated amplify_outputs.json when you wire Amplify.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const outputs = require('../amplify_outputs.json');
    Amplify.configure(outputs);
  } catch (error) {
    console.warn('Amplify outputs missing. Generate amplify_outputs.json to enable cloud features.');
  }
};

export default function RootLayout() {
  useEffect(() => {
    configureAmplify();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#4ade80',
          tabBarInactiveTintColor: '#9ca3af',
          tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1f2937' }
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Bubbles' }} />
        <Tabs.Screen name="favorites" options={{ title: 'Favorites' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      </Tabs>
    </View>
  );
}
