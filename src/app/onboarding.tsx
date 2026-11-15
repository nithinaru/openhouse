import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IngestShow } from '@/features/home/IngestShow';
import { uploadTrip } from '@/lib/data/sync';
import { DEMO_TRIP_ID } from '@/lib/demo/demoTrip';
import { notifyTripReady } from '@/lib/ingest/notify';
import { IngestError, ingestRecent, type IngestProgress } from '@/lib/ingest/readLibrary';
import { setTrip } from '@/lib/ingest/store';
import { colors, duration, ease, radius, space, type } from '@/theme';
import { Button } from '@/theme/ui';

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
      // Best-effort Convex upload in the background; never delays the "ready" beat.
      void uploadTrip(trip, (p) => {
        if (__DEV__ && (p.stage === 'done' || p.stage === 'skipped' || p.stage === 'failed')) {
          console.log('[onboarding] upload', p.stage, p.remoteTripId ?? p.reason ?? '');
        }
      });
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
        <Animated.View entering={FadeInDown.duration(duration.enter).easing(ease.out)} style={{ gap: space.md }}>
          <Text style={styles.kicker}>Openhouse</Text>
          <Text style={type.display}>Your camera roll already remembers the day</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>
            Where you stood, which way you faced, who was there. Openhouse reads the photos you already took
            and plays the day back. Nothing to type.
          </Text>
        </Animated.View>
        {failed && (
          <Animated.View entering={FadeIn.duration(duration.fast)} style={styles.error}>
            <Text style={type.callout}>{state.message}</Text>
          </Animated.View>
        )}
      </View>

      <View style={styles.actions}>
        <Button label={failed ? 'Try again' : 'Let Openhouse read your photos'} onPress={start} />
        <Button variant="quiet" label={failed ? 'Use the demo trip' : 'See a sample day'} onPress={useDemo} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: space.lg, gap: space.lg },
  kicker: { ...type.caption, color: colors.textMuted },
  error: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  actions: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.xs },
});
