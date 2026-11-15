import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { IngestShow } from '@/features/home/IngestShow';
import { collagePhotos } from '@/features/home/tripMeta';
import { uploadTrip } from '@/lib/data/sync';
import { DEMO_TRIP_ID, getDemoTrip } from '@/lib/demo/demoTrip';
import { notifyTripReady } from '@/lib/ingest/notify';
import { IngestError, ingestRecent, type IngestProgress } from '@/lib/ingest/readLibrary';
import { setTrip } from '@/lib/ingest/store';
import { colors, duration, ease, fonts, radius, space, type } from '@/theme';
import { BackIcon } from '@/theme/icons';
import { Button, IconButton, Print, Press, Sticker } from '@/theme/ui';

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
  | { kind: 'ask' }
  | { kind: 'running'; progress: IngestProgress; ready?: { title: string; stops: number } }
  | { kind: 'failed'; message: string };

function failureMessage(e: unknown): string {
  if (e instanceof IngestError) {
    if (e.code === 'denied') return 'openhouse needs photo access to find your stops. you can allow it in settings.';
    if (e.code === 'no-geotagged') return 'none of your recent photos have a location.';
  }
  return 'something went wrong reading your photos.';
}

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
        <StatusBar style="dark" />
        <IngestShow progress={state.progress} ready={state.ready} />
      </Animated.View>
    );
  }

  if (state.kind === 'splash') {
    return <Splash onStart={() => setState({ kind: 'ask' })} onSample={useDemo} />;
  }

  return (
    <AskPhotos
      error={state.kind === 'failed' ? state.message : undefined}
      onAllow={start}
      onSample={useDemo}
      onBack={() => setState({ kind: 'splash' })}
    />
  );
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

// ---------------------------------------------------------------------------
// o5: fanned prints, "let us see the day", allow photos.

function AskPhotos({
  error,
  onAllow,
  onSample,
  onBack,
}: {
  error?: string;
  onAllow: () => void;
  onSample: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [a, b, c] = collagePhotos(getDemoTrip(DEMO_TRIP_ID), 3);
  const printW = Math.round(Math.min(width * 0.5, 210));

  return (
    <View style={[styles.ask, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }]}>
      <StatusBar style="dark" />
      <View style={styles.askTop}>
        <IconButton icon={<BackIcon color={colors.text} />} label="back" onPress={onBack} style={styles.plainButton} />
        <Press onPress={onSample} accessibilityRole="button" accessibilityLabel="skip, see a sample day" haptic="selection" hitSlop={10}>
          <Text style={styles.skip}>skip</Text>
        </Press>
      </View>

      <Animated.View entering={FadeInDown.duration(duration.enter).easing(ease.out)} style={styles.askHead}>
        <Text style={styles.askTitle} accessibilityRole="header">
          {'let us see\nthe day'}
        </Text>
        <Text style={styles.askSub}>where you stood, which way you faced, who was there. nothing to type.</Text>
      </Animated.View>

      <View style={styles.fan} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Print uri={a?.uri} width={printW} rotate={-11} style={{ position: 'absolute', transform: [{ translateX: -printW * 0.42 }, { rotate: '-11deg' }] }} />
        <Print uri={c?.uri} width={printW} rotate={9} style={{ position: 'absolute', transform: [{ translateX: printW * 0.42 }, { translateY: 10 }, { rotate: '9deg' }] }} />
        <Print uri={b?.uri} width={printW * 1.08} rotate={-2} style={{ position: 'absolute', transform: [{ translateY: 18 }, { rotate: '-2deg' }] }} />
        <Sticker
          label="only from your camera roll"
          tone="paper"
          rotate={-5}
          style={[styles.fanSticker, { top: '50%', marginTop: -printW * 0.6 - 30, left: space.lg }]}
        />
        <Sticker label="your day, rebuilt" rotate={-4} style={[styles.fanSticker, { top: '50%', marginTop: printW * 0.6 + 4, right: space.lg }]} />
      </View>

      <View style={styles.askActions}>
        {error ? (
          <Animated.View entering={FadeIn.duration(duration.fast)} style={styles.error}>
            <Text style={type.callout}>{error}</Text>
          </Animated.View>
        ) : null}
        <Button label={error ? 'try again' : 'allow photos'} onPress={onAllow} />
        {error ? (
          <Button variant="quiet" label="see a sample day" onPress={onSample} />
        ) : (
          <Text style={styles.fine}>openhouse reads when and where each photo was taken</Text>
        )}
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
  ask: { flex: 1, backgroundColor: colors.bg },
  askTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md },
  plainButton: { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0 },
  skip: { ...type.callout, color: colors.textFaint, paddingHorizontal: space.sm },
  askHead: { alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.sm },
  askTitle: { ...type.display, fontSize: 40, lineHeight: 42, letterSpacing: -1.8, textAlign: 'center' },
  askSub: { ...type.body, color: colors.textMuted, textAlign: 'center', maxWidth: 320 },
  fan: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: space.lg },
  fanSticker: { position: 'absolute' },
  askActions: { paddingHorizontal: space.lg, gap: space.sm },
  fine: { ...type.caption, color: colors.textFaint, textAlign: 'center', marginTop: space.xs },
  error: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, marginBottom: space.xs },
});
