import '@/polyfills';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useColors } from '@/theme';

export default function RootLayout() {
  const c = useColors();
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.ink,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
        }}
      />
    </>
  );
}
