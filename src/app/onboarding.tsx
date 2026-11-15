import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IngestShow } from '@/features/home/IngestShow';
import { PressableScale } from '@/features/home/PressableScale';
import { DEMO_TRIP_ID } from '@/lib/demo/demoTrip';
import { notifyTripReady } from '@/lib/ingest/notify';
import { IngestError, ingestRecent, type IngestProgress } from '@/lib/ingest/readLibrary';
import { setTrip } from '@/lib/ingest/store';
import { colors, radius, space, type } from '@/theme';

/** How long "Your day is ready" holds before the replay opens. */
const READY_BEAT_MS = 2200;

type State =
  | { kind: 'idle' }
  | { kind: 'running'; progress: IngestProgress; ready?: { title: string; stops: number } }
  | { kind: 'failed'; message: string };

function failureMessage(e: unknown): string {
  if (e instanceof IngestError) {
    if (e.code === 'denied') return 'Openhouse needs photo access to find your stops. You can allow it in Settings.';
    if (e.code === 'no-geotagged') return 'None of your recent photos have a location.';
  }
  return 'Something went wrong reading your photos.';
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function OnboardingScreen() {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const start = async () => {
    setState({ kind: 'running', progress: { phase: 'permission', found: 0, read: 0, stops: 0, limited: false } });
    try {
      const trip = await ingestRecent((progress) => {
        if (alive.current) setState((s) => (s.kind === 'running' ? { ...s, progress } : s));
      });
      setTrip(trip);
      if (!alive.current) return;

      setState((s) => (s.kind === 'running' ? { ...s, ready: { title: trip.title, stops: trip.moments.length } } : s));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // The beat and the notification (which may show a one-time permission prompt) run together.
      await Promise.all([wait(READY_BEAT_MS), notifyTripReady(trip)]);
      if (alive.current) router.replace({ pathname: '/trip/[id]', params: { id: trip.id } });
    } catch (e) {
      console.warn('[onboarding] ingest failed', e);
      if (alive.current) setState({ kind: 'failed', message: failureMessage(e) });
    }
  };

  const useDemo = () => router.replace({ pathname: '/trip/[id]', params: { id: DEMO_TRIP_ID } });

  if (state.kind === 'running') {
    return (
      <Animated.View entering={FadeIn.duration(350)} style={{ flex: 1 }}>
        <IngestShow progress={state.progress} ready={state.ready} />
      </Animated.View>
    );
  }

  const failed = state.kind === 'failed';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.body}>
        <Animated.View entering={FadeInDown.duration(380)} style={{ gap: space.md }}>
          <Text style={styles.kicker}>Openhouse</Text>
          <Text style={styles.headline}>Your camera roll already remembers the day.</Text>
          <Text style={[type.body, { color: colors.textMuted, lineHeight: 23 }]}>
            Where you stood, which way you faced, who was there. Openhouse reads the photos you already took
            and plays the day back. Nothing to type.
          </Text>
        </Animated.View>
        {failed && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.error}>
            <Text style={[type.body, { color: colors.text }]}>{state.message}</Text>
          </Animated.View>
        )}
      </View>

      <View style={{ padding: space.lg, gap: space.sm }}>
        <PressableScale accessibilityRole="button" onPress={start} scaleTo={0.96} haptic="medium" style={styles.cta}>
          <Text style={styles.ctaText}>{failed ? 'Try again' : 'Let Openhouse read your photos'}</Text>
        </PressableScale>
        <PressableScale accessibilityRole="button" onPress={useDemo} haptic="none" style={styles.secondary}>
          <Text style={[type.body, { color: colors.accent }]}>{failed ? 'Use demo trip' : 'See a sample day'}</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', padding: space.lg, gap: space.lg },
  kicker: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  headline: { ...type.title, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  error: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: colors.bg, fontSize: 17, fontWeight: '700' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
