// The ingest is the show (docs/BUILD.md §6 item 2): on a soft sky, each stop's photo flies in
// as a print the moment it is clustered, the prints settle into a scrapbook pile, and a
// live counter and progress bar tick along the bottom.

import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IngestProgress, StopPreview } from '@/lib/ingest/readLibrary';
import { colors, ease, fonts, radius, shadow, space, type } from '@/theme';
import { PinIcon } from '@/theme/icons';
import { Print, SkyBackground, Sticker, Wordmark } from '@/theme/ui';

import { plural } from './tripMeta';

const EASE_OUT = ease.out;
const HAPTIC_GAP_MS = 140;
const MAX_PRINTS = 8;

/** Where each print lands, as fractions of the stage, with its tilt. Deterministic for rehearsal. */
const SLOTS = [
  { x: -0.2, y: -0.2, r: -7 },
  { x: 0.22, y: -0.26, r: 6 },
  { x: -0.24, y: 0.18, r: 5 },
  { x: 0.2, y: 0.14, r: -5 },
  { x: 0.0, y: -0.02, r: 2 },
  { x: -0.06, y: 0.32, r: -9 },
  { x: 0.26, y: 0.36, r: 8 },
  { x: -0.28, y: -0.38, r: -3 },
];

function phaseLabel(p: IngestProgress): string {
  switch (p.phase) {
    case 'permission':
      return 'asking for access';
    case 'scanning':
      return 'looking through your camera roll';
    case 'reading':
      return (p.stopList?.length ?? 0) > 0 ? 'putting every photo back where you stood' : 'finding where you were';
    case 'naming':
      return 'naming the places';
    case 'done':
      return 'done';
  }
}

function counterLabel(p: IngestProgress): string {
  const stops = p.stopList?.length ?? p.stops;
  if (p.phase === 'scanning' || p.phase === 'permission') return `found ${plural(p.found, 'photo')}`;
  const parts = [p.found > 0 ? `placed ${Math.max(p.read, 0)} of ${plural(p.found, 'photo')}` : plural(p.read, 'photo')];
  parts.push(`${plural(stops, 'stop')} found`);
  return parts.join(' · ');
}

/** One stop's photo, thrown in from below and settling into its slot. */
function FlyingPrint({ stop, slot, stageW, stageH, printW }: { stop: StopPreview; slot: number; stageW: number; stageH: number; printW: number }) {
  const reduced = useReducedMotion();
  const target = SLOTS[slot % SLOTS.length];
  const t = useSharedValue(reduced ? 1 : 0);
  const o = useSharedValue(0);

  useEffect(() => {
    o.set(withTiming(1, { duration: 200, easing: EASE_OUT }));
    t.set(withSpring(1, { duration: 700, dampingRatio: 0.78, reduceMotion: ReduceMotion.System }));
  }, [o, t]);

  const style = useAnimatedStyle(() => {
    const p = t.get();
    return {
      opacity: o.get(),
      transform: [
        { translateX: target.x * stageW * p },
        { translateY: target.y * stageH * p + (1 - p) * stageH * 0.75 },
        { rotate: `${target.r * p + (1 - p) * -14}deg` },
        { scale: 1.12 - 0.12 * p },
      ],
    };
  });

  return (
    <Animated.View style={[styles.flying, { marginLeft: -printW / 2, marginTop: (-printW * 1.2) / 2 }, style]}>
      <Print uri={stop.heroUri} width={printW} border={7} meta={stop.placeName} />
    </Animated.View>
  );
}

type Props = {
  progress: IngestProgress;
  /** Set when ingest finished; shows the "your day is ready" beat. */
  ready?: { title: string; stops: number } | null;
};

export function IngestShow({ progress, ready }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const seen = useRef(new Set<string>());
  const lastTick = useRef(0);
  const stops = useMemo(() => progress.stopList ?? [], [progress.stopList]);
  const hasStops = stops.length > 0;

  // A light tick per newly found stop, throttled so a burst doesn't buzz.
  useEffect(() => {
    const fresh = stops.filter((s) => !seen.current.has(s.key));
    if (fresh.length === 0) return;
    for (const s of fresh) seen.current.add(s.key);
    const now = Date.now();
    if (now - lastTick.current > HAPTIC_GAP_MS) {
      lastTick.current = now;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [stops]);

  // The pile dims back for the final beat.
  const finale = useSharedValue(0);
  useEffect(() => {
    if (ready) finale.set(withDelay(150, withTiming(1, { duration: 420, easing: EASE_OUT })));
  }, [ready, finale]);
  const pileStyle = useAnimatedStyle(() => ({ opacity: 1 - finale.get() * 0.75, transform: [{ scale: 1 - finale.get() * 0.04 }] }));
  const finaleStyle = useAnimatedStyle(() => ({
    opacity: finale.get(),
    transform: [{ translateY: (1 - finale.get()) * 10 }],
  }));

  // Progress bar: absolute, childless fill, so animating width is cheap.
  const fraction =
    progress.phase === 'done' || ready
      ? 1
      : progress.phase === 'naming'
        ? 0.92
        : progress.phase === 'reading' && progress.found > 0
          ? 0.1 + 0.8 * (progress.read / progress.found)
          : progress.phase === 'scanning'
            ? 0.06
            : 0.02;
  const bar = useSharedValue(0);
  useEffect(() => {
    bar.set(withTiming(fraction, { duration: 400, easing: EASE_OUT }));
  }, [fraction, bar]);
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.get() * 100}%` }));

  // Newest prints on top; only the latest few stay on the pile.
  const pile = stops.slice(-MAX_PRINTS);
  const offset = Math.max(0, stops.length - MAX_PRINTS);
  const stageW = width;
  const stageH = Math.round(height * 0.5);
  const printW = Math.round(Math.min(width * 0.38, 160));

  return (
    <SkyBackground variant="soft">
      <View style={[styles.top, { paddingTop: insets.top + space.xl }]}>
        <Text style={styles.title} accessibilityRole="header">
          {ready ? 'your day is ready' : 'building your day…'}
        </Text>
        <Text style={styles.sub}>{ready ? ready.title : phaseLabel(progress)}</Text>
      </View>

      <Animated.View pointerEvents="none" style={[styles.stage, { height: stageH }, pileStyle]}>
        {pile.map((s, i) => (
          <FlyingPrint key={s.key} stop={s} slot={offset + i} stageW={stageW} stageH={stageH} printW={printW} />
        ))}
        {!hasStops && !ready ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.waiting}>
            <Wordmark variant="chrome" width={Math.min(width - space.xl * 2, 300)} />
            <Text style={styles.waitingText}>your photos never leave this phone to do this</Text>
          </Animated.View>
        ) : null}
      </Animated.View>

      {ready ? (
        <Animated.View pointerEvents="none" style={[styles.finale, { top: insets.top + 180 }, finaleStyle]}>
          <Sticker label={`${plural(ready.stops, 'stop')} · ready to replay`} rotate={-4} />
        </Animated.View>
      ) : null}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.status} accessible accessibilityLiveRegion="polite" accessibilityLabel={counterLabel(progress)}>
          <PinIcon size={16} color={colors.pinkEdge} />
          <Text style={styles.statusText} numberOfLines={1}>
            {ready ? `${plural(ready.stops, 'stop')} · ${plural(progress.found || progress.read, 'photo')}` : counterLabel(progress)}
          </Text>
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fillBar, barStyle]} />
        </View>
        {progress.limited ? <Text style={styles.note}>using only the photos you selected</Text> : null}
      </View>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', paddingHorizontal: space.lg, gap: space.sm },
  title: { ...type.display, fontSize: 40, lineHeight: 42, letterSpacing: -1.8, textAlign: 'center' },
  sub: { ...type.body, color: colors.textMuted, textAlign: 'center' },
  stage: { marginTop: space.xl },
  flying: { position: 'absolute', left: '50%', top: '50%' },
  waiting: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: space.md },
  waitingText: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
  finale: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, gap: space.md, alignItems: 'center' },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.full,
    backgroundColor: colors.bg,
    alignSelf: 'stretch',
    justifyContent: 'center',
    ...shadow.chip,
  },
  statusText: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: -0.2, color: colors.text, fontVariant: ['tabular-nums'] },
  track: { alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)', overflow: 'hidden' },
  fillBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.ink, borderRadius: 4 },
  note: { ...type.caption, color: colors.textMuted },
});
