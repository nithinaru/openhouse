import {
  InterTight_400Regular,
  InterTight_500Medium,
  InterTight_600SemiBold,
  InterTight_700Bold,
  useFonts,
} from '@expo-google-fonts/inter-tight';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '@/theme';

// Hold the native splash until Inter Tight is ready, so nothing flashes in the system font.
void SplashScreen.preventAutoHideAsync().catch(() => {});

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, { unsavedChangesWarning: false });

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, primary: colors.accent },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <ConvexProvider client={convex}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={theme}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="trip/[id]" />
            <Stack.Screen name="stop/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="walkin/[id]" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="people" options={{ presentation: 'modal' }} />
            <Stack.Screen name="contacts" options={{ presentation: 'modal' }} />
            <Stack.Screen name="frame/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="ask/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="demo" options={{ presentation: 'modal' }} />
            <Stack.Screen name="shop/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="sell/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="listing/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="plus" options={{ presentation: 'modal' }} />
            <Stack.Screen name="gift/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="gift/inbox" options={{ presentation: 'modal' }} />
            <Stack.Screen name="house/[id]" />
            <Stack.Screen name="house/person/[id]" />
          </Stack>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ConvexProvider>
  );
}
