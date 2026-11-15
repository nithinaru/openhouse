import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { peopleAt } from '@/features/replay/people';
import { useMoment } from '@/features/replay/useTrip';
import { AngleCompare } from '@/features/stop/AngleCompare';
import { HeroPager } from '@/features/stop/HeroPager';
import { ArrowIcon, ClockIcon, CloseIcon, CloudIcon, PinIcon, SunIcon } from '@/features/stop/Icons';
import { EASE_IN_OUT, EASE_OUT } from '@/features/stop/motion';
import { PressScale } from '@/features/stop/PressScale';
import { colors, radius, space, type } from '@/theme';

const GOLD = '#E8B85A';
const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });
const WALK_MS = 560;

export default function StopScreen() {
  const { id, tripId } = useLocalSearchParams<{ id: string; tripId?: string }>();
  const { trip, moment } = useMoment(id, tripId);
  const insets = useSafeAreaInsets();
  const { width, height: screenH } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [page, setPage] = useState(0);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const walk = useSharedValue(0);
  const walking = useRef(false);

  const heroH = Math.round(Math.min(screenH * 0.62, width * 1.25));
  // Enough scale that the photo covers the whole screen, then a bit more: you step through it.
  const walkScale = (screenH / heroH) * 1.25;

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
    },
  });

  // Coming back from Walk in: step back out of the photo.
  useFocusEffect(
    useCallback(() => {
      walking.current = false;
      if (walk.get() > 0) walk.set(withTiming(0, { duration: 380, easing: EASE_OUT }));
    }, [walk]),
  );

  const contentFade = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, walk.get() * 2.5) }));
  const veil = useAnimatedStyle(() => ({ opacity: Math.max(0, (walk.get() - 0.55) / 0.45) }));

  if (!moment) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={type.body}>Stop not found</Text>
        <Pressable onPress={() => router.back()} style={[styles.ghost, { marginTop: space.md }]}>
          <Text style={type.body}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const theirPhotos = trip.theirAngles?.[moment.id] ?? [];
  const friend = theirPhotos.length ? trip.people.find((p) => p.id === theirPhotos[0].userId) : undefined;
  const people = peopleAt(trip, moment.id);
  const photos = moment.photos;
  const current = photos[Math.min(page, photos.length - 1)];
  const top = Math.max(insets.top, space.md) + space.sm;
  const pad = space.lg;
  const contentW = width - pad * 2;

  const goWalk = () => {
    router.push({ pathname: '/walkin/[id]', params: { id: moment.id } });
  };

  const walkIn = () => {
    if (walking.current) return;
    walking.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    walk.set(
      withTiming(1, { duration: reduced ? 200 : WALK_MS, easing: EASE_IN_OUT }, (finished) => {
        if (finished) scheduleOnRN(goWalk);
      }),
    );
  };

  const chips: { key: string; icon: ReactNode; label: string; gold?: boolean }[] = [
    { key: 'time', icon: <ClockIcon color={colors.textMuted} />, label: formatTime(moment.startAt) },
    ...(moment.placeName ? [{ key: 'place', icon: <PinIcon color={colors.textMuted} />, label: moment.placeName }] : []),
    ...(moment.weather
      ? [{ key: 'wx', icon: <CloudIcon color={colors.textMuted} />, label: `${Math.round(moment.weather.tempF)}°F · ${moment.weather.summary}` }]
      : []),
    ...(moment.isGoldenHour ? [{ key: 'gold', icon: <SunIcon color={GOLD} />, label: 'Golden hour', gold: true }] : []),
  ];

  let step = 0;
  const enter = () => (reduced ? undefined : FadeInDown.duration(420).delay(120 + step++ * 70).easing(EASE_OUT));

  return (
    <View style={styles.fill}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        <View>
          <HeroPager
            photos={photos}
            width={width}
            height={heroH}
            scrollY={scrollY}
            walk={walk}
            walkScale={walkScale}
            reduced={reduced}
            dotsTop={top + 7}
            onPageChange={setPage}
          />
          <Animated.View pointerEvents="none" style={[styles.heroText, { width, height: heroH }, contentFade]}>
            <Scrim width={width} height={heroH} />
            <View style={{ position: 'absolute', left: pad, right: pad, bottom: space.lg }}>
              <Text style={styles.kicker}>
                Stop {moment.order + 1} of {trip.moments.length}
              </Text>
              <Text style={styles.place} numberOfLines={2}>
                {moment.placeName ?? 'A stop'}
              </Text>
              {moment.caption ? <Text style={styles.caption}>{moment.caption}</Text> : null}
            </View>
          </Animated.View>
        </View>

        {/* Opaque so the slower-moving hero slides under it. */}
        <Animated.View style={[{ backgroundColor: colors.bg, paddingHorizontal: pad, paddingTop: space.lg, gap: space.lg, minHeight: screenH * 0.5 }, contentFade]}>
          <Animated.View entering={enter()} style={styles.chips}>
            {chips.map((c) => (
              <View key={c.key} style={[styles.chip, c.gold && styles.chipGold]}>
                {c.icon}
                <Text style={[styles.chipText, c.gold && { color: GOLD }]} numberOfLines={1}>
                  {c.label}
                </Text>
              </View>
            ))}
          </Animated.View>

          {moment.narration ? (
            <Animated.Text entering={enter()} style={styles.narration}>
              {moment.narration}
            </Animated.Text>
          ) : null}

          {theirPhotos.length && current ? (
            <Animated.View entering={enter()} style={{ gap: space.sm }}>
              <View>
                <Text style={styles.section}>Their angle</Text>
                <Text style={type.caption}>
                  Drag the line to see it through {friend?.name ?? 'their'}
                  {friend ? "'s" : ''} eyes.
                </Text>
              </View>
              <AngleCompare mine={current} theirs={theirPhotos} friendName={friend?.name ?? 'Them'} width={contentW} reduced={reduced} />
            </Animated.View>
          ) : null}

          {moment.fact ? (
            <Animated.View entering={enter()} style={styles.quote}>
              <Text style={styles.quoteMark}>“</Text>
              <Text style={styles.quoteText}>{moment.fact}</Text>
              <Text style={styles.quoteSource}>Nearby · {moment.placeName ?? 'this stop'}</Text>
            </Animated.View>
          ) : null}

          {people.length ? (
            <Animated.View entering={enter()} style={{ gap: space.sm }}>
              <Text style={styles.section}>Met here</Text>
              <View style={styles.chips}>
                {people.map((person) => (
                  <View key={person.id} style={styles.personChip}>
                    {person.avatarUri ? (
                      <Image source={{ uri: person.avatarUri }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.center]}>
                        <Text style={{ color: colors.text, fontWeight: '700' }}>{person.name[0]}</Text>
                      </View>
                    )}
                    <Text style={styles.personName}>{person.name}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>
      </Animated.ScrollView>

      {/* Floating chrome */}
      <Animated.View style={[styles.closeWrap, { top }, contentFade]}>
        <PressScale
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.close}
          to={0.9}
        >
          <CloseIcon color={colors.text} />
        </PressScale>
      </Animated.View>

      <Animated.View pointerEvents="box-none" style={[styles.bottomBar, { paddingBottom: insets.bottom + space.md }, contentFade]}>
        <BottomFade width={width} />
        <PressScale onPress={walkIn} accessibilityRole="button" accessibilityLabel="Walk in" style={styles.walk}>
          <View>
            <Text style={styles.walkTitle}>Walk in</Text>
            <Text style={styles.walkSub}>Step inside this moment in 3D</Text>
          </View>
          <View style={styles.walkArrow}>
            <ArrowIcon color={colors.accent} />
          </View>
        </PressScale>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, veil]} />
    </View>
  );
}

function Scrim({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <Stop offset="0.22" stopColor="#000" stopOpacity="0" />
          <Stop offset="0.5" stopColor={colors.bg} stopOpacity="0" />
          <Stop offset="1" stopColor={colors.bg} stopOpacity="0.95" />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={height} fill="url(#scrim)" />
    </Svg>
  );
}

function BottomFade({ width }: { width: number }) {
  return (
    <Svg width={width} height={200} style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      <Defs>
        <LinearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.bg} stopOpacity="0" />
          <Stop offset="0.55" stopColor={colors.bg} stopOpacity="0.92" />
          <Stop offset="1" stopColor={colors.bg} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={200} fill="url(#bottomFade)" />
    </Svg>
  );
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  ghost: { backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: space.md, paddingVertical: space.sm },
  heroText: { position: 'absolute', top: 0, left: 0 },
  kicker: { color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 1.2, marginBottom: 6 },
  place: { color: colors.text, fontSize: 34, lineHeight: 38, fontWeight: '700', letterSpacing: -0.5 },
  caption: { color: 'rgba(242,238,230,0.82)', fontSize: 16, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  chipGold: { backgroundColor: 'rgba(232,184,90,0.12)', borderColor: 'rgba(232,184,90,0.45)' },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '500' },
  narration: { color: colors.text, fontSize: 18, lineHeight: 27 },
  section: { color: colors.text, fontSize: 17, fontWeight: '600', marginBottom: 2 },
  quote: {
    paddingLeft: space.md,
    paddingVertical: space.xs,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
  },
  quoteMark: { color: colors.accent, fontFamily: SERIF, fontSize: 56, lineHeight: 56, height: 34, marginBottom: 2 },
  quoteText: { color: colors.text, fontFamily: SERIF, fontStyle: 'italic', fontSize: 21, lineHeight: 30 },
  quoteSource: { color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginTop: space.sm },
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: 4,
    paddingRight: 14,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.line, borderWidth: 1.5, borderColor: colors.accent },
  personName: { color: colors.text, fontSize: 15, fontWeight: '500' },
  closeWrap: { position: 'absolute', right: space.md },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(14,17,22,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.xl },
  walk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingLeft: space.lg,
    paddingRight: 8,
    paddingVertical: 8,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  walkTitle: { color: colors.bg, fontSize: 18, fontWeight: '700' },
  walkSub: { color: 'rgba(14,17,22,0.65)', fontSize: 12, fontWeight: '500', marginTop: 1 },
  walkArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
