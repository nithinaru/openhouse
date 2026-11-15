import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { colors, ease, radius, space, type } from '@/theme';
import { ArrowIcon, CloudIcon, SunIcon } from '@/theme/icons';
import { Button, Chip, CloseButton, formatClock, Stamp } from '@/theme/ui';

const EASE_OUT = ease.out;
const EASE_IN_OUT = ease.inOut;
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
        <Button variant="secondary" label="Close" onPress={() => router.back()} style={{ marginTop: space.md }} />
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
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    walk.set(
      withTiming(1, { duration: reduced ? 200 : WALK_MS, easing: EASE_IN_OUT }, (finished) => {
        if (finished) scheduleOnRN(goWalk);
      }),
    );
  };

  const chips: { key: string; icon: ReactNode; label: string; gold?: boolean }[] = [
    ...(moment.weather
      ? [{ key: 'wx', icon: <CloudIcon color={colors.textMuted} />, label: `${Math.round(moment.weather.tempF)}°F · ${moment.weather.summary}` }]
      : []),
    ...(moment.isGoldenHour ? [{ key: 'gold', icon: <SunIcon color={colors.accent} />, label: 'Golden hour', gold: true }] : []),
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
              <Stamp style={styles.kicker}>
                {formatClock(moment.startAt)} · Stop {moment.order + 1} of {trip.moments.length}
              </Stamp>
              <Text style={styles.place} numberOfLines={2}>
                {moment.placeName ?? 'A stop'}
              </Text>
              {moment.caption ? <Text style={styles.caption}>{moment.caption}</Text> : null}
            </View>
          </Animated.View>
        </View>

        {/* Opaque so the slower-moving hero slides under it. */}
        <Animated.View style={[{ backgroundColor: colors.bg, paddingHorizontal: pad, paddingTop: space.lg, gap: space.lg, minHeight: screenH * 0.5 }, contentFade]}>
          {chips.length ? (
            <Animated.View entering={enter()} style={styles.chips}>
              {chips.map((c) => (
                <Chip key={c.key} icon={c.icon} label={c.label} tone={c.gold ? 'accent' : 'default'} />
              ))}
            </Animated.View>
          ) : null}

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
              <Text style={styles.quoteText}>{moment.fact}</Text>
              <Text style={styles.quoteSource}>Nearby {moment.placeName ?? 'this stop'}</Text>
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
                        <Text style={type.label}>{person.name[0]}</Text>
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
        <CloseButton tone="media" onPress={() => router.back()} />
      </Animated.View>

      <Animated.View pointerEvents="box-none" style={[styles.bottomBar, { paddingBottom: insets.bottom + space.md }, contentFade]}>
        <BottomFade width={width} />
        <Button
          label="Walk in"
          onPress={walkIn}
          accessibilityHint="Step inside this moment in 3D"
          trailing={<ArrowIcon color={colors.accentInk} />}
        />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink }, veil]} />
    </View>
  );
}

function Scrim({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.ink} stopOpacity="0.4" />
          <Stop offset="0.22" stopColor={colors.ink} stopOpacity="0" />
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

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  heroText: { position: 'absolute', top: 0, left: 0 },
  kicker: { marginBottom: space.sm },
  place: { ...type.display },
  caption: { ...type.callout, color: colors.text, opacity: 0.86, marginTop: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  narration: { ...type.story },
  section: { ...type.heading, fontSize: 17, lineHeight: 22, marginBottom: space.xxs },
  quote: {
    paddingLeft: space.md,
    paddingVertical: space.xs,
    borderLeftWidth: 1,
    borderLeftColor: colors.accent,
  },
  quoteText: { ...type.story, fontSize: 19, lineHeight: 28 },
  quoteSource: { ...type.caption, marginTop: space.sm },
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.xs,
    paddingRight: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.elevated },
  personName: { ...type.callout },
  closeWrap: { position: 'absolute', right: space.md },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.xl },
});
