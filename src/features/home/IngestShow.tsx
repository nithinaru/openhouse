// The ingest is the show (docs/BUILD.md §6 item 2): a dark map where each stop drops in as it is
// clustered, the camera eases to fit the stops so far, and a live counter ticks up.

import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Animated, {
  Easing,
  FadeIn,
  FadeInRight,
  LinearTransition,
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
import { colors, radius, space } from '@/theme';

import { plural } from './tripMeta';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const PIN = 46;
const HAPTIC_GAP_MS = 140;
// A wide opening view (continental US); the first stop flies the camera in from here.
const OPENING_REGION = { latitude: 37.5, longitude: -98.5, latitudeDelta: 40, longitudeDelta: 40 };

function phaseLabel(p: IngestProgress): string {
  switch (p.phase) {
    case 'permission':
      return 'Asking for access';
    case 'scanning':
      return 'Looking through your camera roll';
    case 'reading':
      return (p.stopList?.length ?? 0) > 0 ? 'Retracing your day' : 'Finding where you were';
    case 'naming':
      return 'Naming the places';
    case 'done':
      return 'Done';
  }
}

function counterLabel(p: IngestProgress): string {
  const photos = p.phase === 'scanning' ? p.found : Math.max(p.read, 0);
  const parts = [plural(photos, 'photo')];
  const stops = p.stopList?.length ?? p.stops;
  if (p.phase !== 'scanning' && p.phase !== 'permission') parts.push(plural(stops, 'stop'));
  if (p.places) parts.push(plural(p.places, 'place'));
  return parts.join(' · ');
}

/** A photo bubble on a stem that drops onto the map when it mounts. */
function StopPin({ stop, index }: { stop: StopPreview; index: number }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(reduced ? 0 : -28);
  const s = useSharedValue(reduced ? 1 : 0.86);
  const o = useSharedValue(0);
  const [tracking, setTracking] = useState(true);
  const freezeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Track view changes while something is changing, then freeze the marker snapshot so
  // 15 markers don't re-render every frame.
  const trackFor = (ms: number) => {
    setTracking(true);
    clearTimeout(freezeTimer.current);
    freezeTimer.current = setTimeout(() => setTracking(false), ms);
  };

  useEffect(() => {
    o.set(withTiming(1, { duration: 180, easing: EASE_OUT }));
    y.set(withSpring(0, { duration: 420, dampingRatio: 0.62, reduceMotion: ReduceMotion.System }));
    s.set(withSpring(1, { duration: 420, dampingRatio: 0.62, reduceMotion: ReduceMotion.System }));
    freezeTimer.current = setTimeout(() => setTracking(false), 900);
    return () => clearTimeout(freezeTimer.current);
  }, [o, s, y]);

  const style = useAnimatedStyle(() => ({
    opacity: o.get(),
    transform: [{ translateY: y.get() }, { scale: s.get() }],
  }));

  return (
    <Marker
      identifier={stop.key}
      coordinate={{ latitude: stop.lat, longitude: stop.lng }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracking}
      zIndex={index}
    >
      <Animated.View style={[styles.pinWrap, style]}>
        <View style={styles.bubble}>
          {stop.heroUri ? (
            <Image source={{ uri: stop.heroUri }} style={styles.bubbleImg} contentFit="cover" onLoad={() => trackFor(500)} />
          ) : (
            <View style={[styles.bubbleImg, { backgroundColor: colors.line }]} />
          )}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{index + 1}</Text>
          </View>
        </View>
        <View style={styles.stem} />
        <View style={styles.foot} />
      </Animated.View>
    </Marker>
  );
}

type Props = {
  progress: IngestProgress;
  /** Set when ingest finished; shows the "Your day is ready" beat. */
  ready?: { title: string; stops: number } | null;
};

export function IngestShow({ progress, ready }: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const seen = useRef(new Set<string>());
  const lastTick = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const stops = useMemo(() => progress.stopList ?? [], [progress.stopList]);

  // Diff stop keys: each new stop gets a haptic tick and the camera re-fits.
  useEffect(() => {
    if (!mapReady || stops.length === 0) return;
    const fresh = stops.filter((s) => !seen.current.has(s.key));
    if (fresh.length === 0) return;
    for (const s of fresh) seen.current.add(s.key);

    const now = Date.now();
    if (now - lastTick.current > HAPTIC_GAP_MS) {
      lastTick.current = now;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const coords = stops.map((s) => ({ latitude: s.lat, longitude: s.lng }));
    const lats = coords.map((c) => c.latitude);
    const lngs = coords.map((c) => c.longitude);
    const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
    if (coords.length === 1 || span < 0.004) {
      const center = {
        latitude: (Math.max(...lats) + Math.min(...lats)) / 2,
        longitude: (Math.max(...lngs) + Math.min(...lngs)) / 2,
      };
      // First stop: a long fly-in from the opening view. Later: a short ease.
      const first = seen.current.size === fresh.length;
      mapRef.current?.animateCamera(
        { center, altitude: 2600, zoom: 15, pitch: 0, heading: 0 },
        { duration: first ? 1600 : 700 },
      );
    } else {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: insets.top + 170, bottom: insets.bottom + 200, left: 70, right: 70 },
        animated: true,
      });
    }
  }, [stops, mapReady, insets.top, insets.bottom]);

  // Scrim: heavy while nothing is on the map, gone while stops land, back for the final beat.
  const scrim = useSharedValue(0.55);
  const finale = useSharedValue(0);
  const hasStops = stops.length > 0;
  useEffect(() => {
    const target = ready ? 0.72 : hasStops ? 0 : 0.55;
    scrim.set(withTiming(target, { duration: ready ? 420 : 600, easing: EASE_OUT }));
    if (ready) finale.set(withDelay(150, withTiming(1, { duration: 420, easing: EASE_OUT })));
  }, [ready, hasStops, scrim, finale]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.get() }));
  const finaleStyle = useAnimatedStyle(() => ({
    opacity: finale.get(),
    transform: [{ scale: 0.96 + finale.get() * 0.04 }],
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

  const film = [...stops].reverse().slice(0, 10);

  return (
    <View style={styles.fill}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={OPENING_REGION}
        onMapReady={() => setMapReady(true)}
        userInterfaceStyle="dark"
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsPointsOfInterests={false}
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
      >
        {stops.map((s, i) => (
          <StopPin key={s.key} stop={s} index={i} />
        ))}
      </MapView>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />

      {/* Top: phase + live counter + progress */}
      <View pointerEvents="none" style={[styles.top, { paddingTop: insets.top + space.md }]}>
        <Text style={styles.phase}>{ready ? 'Done' : phaseLabel(progress)}</Text>
        <Text style={styles.counter} accessibilityLiveRegion="polite">
          {counterLabel(progress)}
        </Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fillBar, barStyle]} />
        </View>
        {progress.limited && <Text style={styles.note}>Using only the photos you selected.</Text>}
      </View>

      {/* Bottom: film strip of stops as they're found, newest first */}
      {!ready && film.length > 0 && (
        <View pointerEvents="none" style={[styles.bottom, { paddingBottom: insets.bottom + space.md }]}>
          <ScrollView horizontal scrollEnabled={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.md }}>
            {film.map((s) => (
              <Animated.View
                key={s.key}
                entering={FadeInRight.duration(320).easing(EASE_OUT)}
                layout={LinearTransition.duration(260).easing(EASE_OUT)}
                style={styles.card}
              >
                {s.heroUri && <Image source={{ uri: s.heroUri }} style={styles.cardImg} contentFit="cover" transition={200} />}
                <View style={styles.cardLabel}>
                  <Text style={styles.cardText} numberOfLines={1}>
                    {s.placeName ?? plural(s.photoCount, 'photo')}
                  </Text>
                </View>
              </Animated.View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Waiting state before the first stop lands */}
      {!hasStops && !ready && (
        <Animated.View entering={FadeIn.duration(300)} pointerEvents="none" style={styles.center}>
          <View style={styles.seekDot} />
          <Text style={styles.waiting}>Your photos never leave this phone to do this.</Text>
        </Animated.View>
      )}

      {/* Final beat */}
      {ready && (
        <Animated.View pointerEvents="none" style={[styles.center, finaleStyle]}>
          <Text style={styles.readyKicker}>{plural(ready.stops, 'stop')} · ready to replay</Text>
          <Text style={styles.readyTitle}>Your day is ready</Text>
          <Text style={styles.readySub}>{ready.title}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  scrim: { backgroundColor: colors.bg },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.lg, gap: 6 },
  phase: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },
  counter: { color: colors.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  track: { height: 3, borderRadius: 2, backgroundColor: 'rgba(242,238,230,0.12)', marginTop: space.sm, overflow: 'hidden' },
  fillBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accent, borderRadius: 2 },
  note: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  card: {
    width: 92,
    height: 116,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(242,238,230,0.2)',
  },
  cardImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  cardLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(14,17,22,0.62)',
  },
  cardText: { color: colors.text, fontSize: 11, fontWeight: '600' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm },
  seekDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent, marginBottom: space.sm },
  waiting: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  readyKicker: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  readyTitle: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.8, textAlign: 'center' },
  readySub: { color: colors.textMuted, fontSize: 17, textAlign: 'center' },
  pinWrap: { alignItems: 'center' },
  bubble: {
    width: PIN,
    height: PIN,
    borderRadius: PIN / 2,
    borderWidth: 2.5,
    borderColor: colors.text,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  bubbleImg: { width: PIN - 5, height: PIN - 5, borderRadius: (PIN - 5) / 2 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.bg, fontSize: 10, fontWeight: '800' },
  stem: { width: 2, height: 10, backgroundColor: colors.text },
  foot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginTop: -1 },
});
