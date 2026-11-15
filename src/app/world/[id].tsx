// "build this room in 3d": sends the stop's photos to World Labs (Marble) and waits for the
// world, then opens Walk in with its splat. In demo mode (no WORLDLABS_API_KEY on the Convex
// deployment, or the backend can't take the build) it says so in a quiet label.

import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMoment } from '@/features/replay/useTrip';
import { buildWorld, MAX_WORLD_PHOTOS, worldPhotoUrls, type World, type WorldMode } from '@/features/worlds/api';
import { stageFor, type Stage } from '@/features/worlds/stages';
import { useWorld } from '@/features/worlds/useWorld';
import type { Photo } from '@/lib/types';
import { colors, ease, radius, shadow, space, type } from '@/theme';
import { Button, CloseButton, SkyBackground } from '@/theme/ui';

const POLL_MS = 3000;
const OPEN_DELAY_MS = 900;
const STEPS: { key: Stage['key']; label: string }[] = [
  { key: 'send', label: 'send' },
  { key: 'reconstruct', label: 'reconstruct' },
  { key: 'paint', label: 'paint' },
  { key: 'ready', label: 'ready' },
];

export default function WorldBuildScreen() {
  const { id, tripId } = useLocalSearchParams<{ id: string; tripId?: string }>();
  const { moment } = useMoment(id, tripId);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  const [epoch, setEpoch] = useState(0);
  const [sending, setSending] = useState(false);
  const [buildMode, setBuildMode] = useState<WorldMode | undefined>();
  const [buildLocal, setBuildLocal] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [now, setNow] = useState(() => Date.now());
  const started = useRef(false);
  const opened = useRef(false);

  const { world, loaded } = useWorld(id, POLL_MS, epoch);

  const photos = useMemo(() => (moment?.photos ?? []).slice(0, MAX_WORLD_PHOTOS), [moment]);
  const sentCount = moment ? worldPhotoUrls(moment).length || photos.length : 0;

  const start = useCallback(async () => {
    if (!moment) return;
    setError(undefined);
    setSending(true);
    const r = await buildWorld(moment);
    setSending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setBuildMode(r.mode);
    setBuildLocal(r.local);
    setEpoch((e) => e + 1);
  }, [moment]);

  // First visit: reuse a ready or in-flight world, otherwise start one. A failed world waits
  // for "try again" so a live key is never charged twice by accident.
  useEffect(() => {
    if (!loaded || started.current || !moment) return;
    started.current = true;
    // Deferred a tick: start() sets state.
    if (!world) setTimeout(() => void start(), 0);
  }, [loaded, world, moment, start]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const current: World | null = sending ? null : world;
  const stage = error ? ({ key: 'failed', label: "couldn't build this room", progress: 0 } as Stage) : stageFor(current, sentCount, sending, now);
  const mode = world?.mode ?? buildMode;
  const local = world?.local ?? buildLocal;

  const open = useCallback(() => {
    if (!world?.splatUrl && !world?.viewerUrl) return;
    router.replace({
      pathname: '/walkin/[id]',
      params: {
        id,
        ...(tripId ? { tripId } : {}),
        ...(world.splatUrl ? { splat: world.splatUrl } : {}),
        badge: world.mode === 'demo' ? 'demo' : 'worldlabs',
      },
    });
  }, [id, tripId, world]);

  // Ready: hold on "ready" for a beat, then walk in.
  useEffect(() => {
    if (world?.status !== 'ready' || opened.current) return;
    opened.current = true;
    const t = setTimeout(open, OPEN_DELAY_MS);
    return () => clearTimeout(t);
  }, [world?.status, open]);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(stage.progress, { duration: reduced ? 0 : 700, easing: ease.out }));
  }, [stage.progress, progress, reduced]);
  const barStyle = useAnimatedStyle(() => ({ width: `${Math.round(progress.get() * 100)}%` }));

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const pad = space.lg;
  const gridW = width - pad * 2;
  const failed = stage.key === 'failed';

  return (
    <SkyBackground>
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <CloseButton tone="media" onPress={close} />
      </View>

      <View style={[styles.body, { paddingHorizontal: pad }]}>
        <Animated.View entering={reduced ? undefined : FadeInDown.duration(420).easing(ease.out)} style={{ gap: space.xs }}>
          <Text style={type.caption}>world labs · marble</Text>
          <Text style={type.title} numberOfLines={2}>
            building {moment?.placeName ?? 'this room'}
          </Text>
          <Text style={[type.callout, { color: colors.textMuted }]}>your photos, stitched into a room you can walk into</Text>
        </Animated.View>

        <Tiles photos={photos} width={gridW} progress={progress} reduced={reduced} />

        <View style={{ gap: space.sm }}>
          <View style={styles.stageRow}>
            <Text style={type.label} accessibilityLiveRegion="polite">
              {stage.label}
            </Text>
            {!failed ? <Text style={type.stamp}>{Math.round(stage.progress * 100)}%</Text> : null}
          </View>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, barStyle]} />
          </View>
          <View style={styles.steps}>
            {STEPS.map((s) => {
              const at = STEPS.findIndex((x) => x.key === stage.key);
              const i = STEPS.findIndex((x) => x.key === s.key);
              const done = !failed && i < at;
              const now_ = !failed && i === at;
              return (
                <View key={s.key} style={styles.step}>
                  <View style={[styles.dot, done && styles.dotDone, now_ && styles.dotNow]} />
                  <Text style={[type.stamp, now_ && { color: colors.text }]}>{s.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {failed ? (
          <Animated.View entering={reduced ? undefined : FadeIn.duration(260)} style={{ gap: space.sm }}>
            {error ? (
              <Text style={type.caption} numberOfLines={3}>
                {error}
              </Text>
            ) : null}
            <Button label="try again" onPress={start} loading={sending} />
            <Button
              variant="secondary"
              label="walk in with the photo"
              onPress={() => router.replace({ pathname: '/walkin/[id]', params: { id, ...(tripId ? { tripId } : {}) } })}
            />
          </Animated.View>
        ) : null}
      </View>

      {mode === 'demo' ? (
        <Text style={[type.caption, styles.demo, { bottom: insets.bottom + space.md }]}>
          demo world · add a world labs key for real generation{local ? ' · offline' : ''}
        </Text>
      ) : null}
    </SkyBackground>
  );
}

/** The stop's photos fly in scattered, settle into a grid, and close their gaps as the world forms. */
function Tiles({ photos, width, progress, reduced }: { photos: Photo[]; width: number; progress: SharedValue<number>; reduced: boolean }) {
  const cols = photos.length <= 4 ? 2 : 4;
  const rows = Math.max(1, Math.ceil(photos.length / cols));
  const tile = Math.floor(width / cols);
  return (
    <View style={{ width, height: tile * rows, alignSelf: 'center' }}>
      {photos.map((p, i) => (
        <Tile key={p.id} photo={p} index={i} cols={cols} tile={tile} progress={progress} reduced={reduced} />
      ))}
    </View>
  );
}

function Tile({
  photo,
  index,
  cols,
  tile,
  progress,
  reduced,
}: {
  photo: Photo;
  index: number;
  cols: number;
  tile: number;
  progress: SharedValue<number>;
  reduced: boolean;
}) {
  const col = index % cols;
  const row = Math.floor(index / cols);
  // Deterministic scatter per tile.
  const rot = ((index * 37) % 15) - 7;
  const dx = (((index * 53) % 9) - 4) * 6;
  const dy = (((index * 29) % 7) - 3) * 6;
  const settle = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (!reduced) settle.set(withTiming(1, { duration: 900 + index * 90, easing: ease.out }));
  }, [settle, index, reduced]);

  const style = useAnimatedStyle(() => {
    const s = settle.get();
    const p = progress.get();
    // gap shrinks from 8 to 0 as the world forms
    const gap = 8 * (1 - p);
    return {
      transform: [
        { translateX: dx * (1 - s) },
        { translateY: dy * (1 - s) + 24 * (1 - s) },
        { rotate: `${rot * (1 - s) + rot * 0.15 * (1 - p)}deg` },
        { scale: 0.92 + 0.08 * s },
      ],
      padding: gap / 2,
      opacity: s,
    };
  });

  return (
    <Animated.View style={[{ position: 'absolute', left: col * tile, top: row * tile, width: tile, height: tile }, style]}>
      <View style={styles.tileInner}>
        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.md, flexDirection: 'row' },
  body: { flex: 1, justifyContent: 'center', gap: space.xl },
  stageRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  track: { height: 4, borderRadius: radius.full, backgroundColor: colors.veil, overflow: 'hidden' },
  fill: { height: 4, borderRadius: radius.full, backgroundColor: colors.ink },
  steps: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.veil },
  dotDone: { backgroundColor: colors.ink },
  dotNow: { backgroundColor: colors.pinkEdge },
  tileInner: { flex: 1, borderRadius: radius.xs, overflow: 'hidden', backgroundColor: colors.surface, ...shadow.chip },
  demo: { position: 'absolute', left: space.lg, right: space.lg, textAlign: 'center' },
});
