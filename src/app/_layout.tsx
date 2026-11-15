import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { DarkTheme, ThemeProvider, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '@/theme';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, { unsavedChangesWarning: false });

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, primary: colors.accent },
};

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={theme}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="trip/[id]" />
            <Stack.Screen name="stop/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="walkin/[id]" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="people" options={{ presentation: 'modal' }} />
            <Stack.Screen name="frame/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="ask/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="demo" options={{ presentation: 'modal' }} />
          </Stack>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ConvexProvider>
  );
}
