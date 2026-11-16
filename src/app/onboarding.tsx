import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { IngestShow } from '@/features/home/IngestShow';
import { ContactsStep } from '@/features/onboarding/ContactsStep';
import { isRealPhone, runDemoBuild } from '@/features/onboarding/demoBuild';
import { DEMO_TRIP_ID } from '@/lib/demo/demoTrip';
import { ensurePhotoPermission, type IngestProgress } from '@/lib/ingest/readLibrary';
import { colors, duration, ease, fonts, space } from '@/theme';
import { Button, Press } from '@/theme/ui';

const SPLASH: number = require('../../assets/brand/splash-sky.png');
const SPLASH_W = 780;
const SPLASH_H = 1290;
/** The art has a phone status bar baked into its top 96px; crop it off. */
const SPLASH_CROP = 96;
/** Sky at the art's bottom edge, continued below it. */
const SKY_BELOW = '#9DBDEB';

/** How long "your day is ready" holds before the replay opens. */
const READY_BEAT_MS = 2200;

type State =
  | { kind: 'splash' }
  | { kind: 'contacts' }
  | { kind: 'running'; progress: IngestProgress; ready?: { title: string; stops: number } };

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function OnboardingScreen() {
  const [state, setState] = useState<State>({ kind: 'splash' });
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  // Step 2: the real photo permission prompt on a phone; a heads-up elsewhere. Always continues.
  const askPhotos = async () => {
    if (!isRealPhone()) {
      Alert.alert('phone not detected', 'open wish you were here on your iphone to connect your photos.', [
        { text: 'OK', onPress: () => setState({ kind: 'contacts' }) },
      ]);
      return;
    }
    try {
      await ensurePhotoPermission();
    } catch (e) {
      console.warn('[onboarding] photo permission', e);
    }
    if (alive.current) setState({ kind: 'contacts' });
  };

  // Step 4: the demo house being built from the cached demo trip.
  const build = async () => {
    setState({ kind: 'running', progress: { phase: 'scanning', found: 0, read: 0, stops: 0, limited: false } });
    const ready = await runDemoBuild(
      (progress) => {
        if (alive.current) setState((s) => (s.kind === 'running' ? { ...s, progress } : s));
      },
      () => alive.current,
    );
    if (!alive.current) return;
    setState((s) => (s.kind === 'running' ? { ...s, ready } : s));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await wait(READY_BEAT_MS);
    if (alive.current) router.replace({ pathname: '/house/[id]', params: { id: DEMO_TRIP_ID } });
  };

  const useDemo = () => router.replace({ pathname: '/trip/[id]', params: { id: DEMO_TRIP_ID } });

  if (state.kind === 'running') {
    return (
      <Animated.View entering={FadeIn.duration(350)} style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <IngestShow progress={state.progress} ready={state.ready} />
      </Animated.View>
    );
  }

  if (state.kind === 'contacts') {
    return <ContactsStep onDone={() => void build()} />;
  }

  return <Splash onStart={() => void askPhotos()} onSample={useDemo} />;
}

// ---------------------------------------------------------------------------
// o1: balloons in the sky, "step back inside."

function Splash({ onStart, onSample }: { onStart: () => void; onSample: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const artH = (width * SPLASH_H) / SPLASH_W;
  const crop = (width * SPLASH_CROP) / SPLASH_W;
  const artBottom = artH - crop;
  const fadeH = 180;

  return (
    <View style={[styles.splash, { backgroundColor: SKY_BELOW }]}>
      <StatusBar style="light" />
      <Image
        source={SPLASH}
        style={{ position: 'absolute', top: -crop, left: 0, width, height: artH }}
        contentFit="cover"
        accessibilityLabel="the words open house in silver balloons, floating in a blue sky with a disco ball, a key, cake and a pumpkin"
      />
      {/* Melt the art's bottom edge into the sky below it. */}
      <Svg
        pointerEvents="none"
        width={width}
        height={height - artBottom + fadeH}
        style={{ position: 'absolute', left: 0, top: artBottom - fadeH }}
      >
        <Defs>
          <LinearGradient id="splashFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={SKY_BELOW} stopOpacity="0" />
            <Stop offset={String(fadeH / (height - artBottom + fadeH))} stopColor={SKY_BELOW} stopOpacity="1" />
            <Stop offset="1" stopColor={colors.skyHaze} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height - artBottom + fadeH} fill="url(#splashFade)" />
      </Svg>

      <View style={[styles.splashBottom, { paddingBottom: insets.bottom + space.lg }]}>
        <Animated.Text
          entering={FadeInDown.duration(duration.slow).delay(200).easing(ease.out)}
          style={styles.splashLine}
          accessibilityRole="header"
        >
          step back inside.
        </Animated.Text>
        <Animated.View entering={FadeInDown.duration(duration.slow).delay(320).easing(ease.out)} style={{ alignItems: 'center', gap: space.md }}>
          <Button label="get started" onPress={onStart} style={styles.splashButton} />
          <Press onPress={onSample} accessibilityRole="button" haptic="selection" hitSlop={10} style={styles.sampleLink}>
            <Text style={styles.sampleText}>
              no photos handy? <Text style={styles.sampleUnderline}>see a sample day</Text>
            </Text>
          </Press>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, overflow: 'hidden' },
  splashBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg },
  splashLine: {
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.2,
    color: colors.onMedia,
    textShadowColor: 'rgba(27,43,68,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  splashButton: { minWidth: 220, paddingHorizontal: space.xl },
  sampleLink: { minHeight: 44, justifyContent: 'center' },
  sampleText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, opacity: 0.72 },
  sampleUnderline: { textDecorationLine: 'underline', fontFamily: fonts.semibold },
});
