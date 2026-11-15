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

import { useEntitlements } from '@/features/commerce/membership';
import { GiftIcon } from '@/features/commerce/ui';
import { peopleAt } from '@/features/replay/people';
import { useMoment } from '@/features/replay/useTrip';
import { AngleCompare } from '@/features/stop/AngleCompare';
import { HeroPager } from '@/features/stop/HeroPager';
import type { Person, Photo } from '@/lib/types';
import { colors, ease, radius, shadow, space, type } from '@/theme';
import { ArrowIcon, ChatIcon, CloudIcon, SunIcon } from '@/theme/icons';
import { Button, Chip, CloseButton, Cutout, formatClock, Press, Print, Sticker } from '@/theme/ui';

const EASE_OUT = ease.out;
const EASE_IN_OUT = ease.inOut;
const WALK_MS = 560;
const SHEET_OVERLAP = 28;

export default function StopScreen() {
  const { id, tripId } = useLocalSearchParams<{ id: string; tripId?: string }>();
  const { trip, moment } = useMoment(id, tripId);
  const insets = useSafeAreaInsets();
  const { width, height: screenH } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [page, setPage] = useState(0);
  const { plus } = useEntitlements(tripId ?? trip.id);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const walk = useSharedValue(0);
  const walking = useRef(false);

  const heroH = Math.round(Math.min(screenH * 0.5, width * 1.08));
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
        <Text style={type.body}>stop not found</Text>
        <Button variant="secondary" label="close" onPress={() => router.back()} style={{ marginTop: space.md }} />
      </View>
    );
  }

  const theirPhotos = trip.theirAngles?.[moment.id] ?? [];
  const friend = theirPhotos.length ? trip.people.find((p) => p.id === theirPhotos[0].userId) : undefined;
  const people = peopleAt(trip, moment.id);
  // A friend who shared this stop (their angle, or paired here) can be sent something from it.
  const giftFriend = friend ?? people[0];
  const photos = moment.photos;
  const current = photos[Math.min(page, photos.length - 1)];
  const top = Math.max(insets.top, space.md) + space.sm;
  const pad = space.lg;
  const contentW = width - pad * 2;

  const goWalk = () => {
    router.push({ pathname: '/walkin/[id]', params: { id: moment.id } });
  };

  const walkIn = () => {
    if (!plus) {
      router.push({ pathname: '/plus', params: { from: 'walkin', tripId: tripId ?? trip.id } });
      return;
    }
    if (walking.current) return;
    walking.current = true;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    walk.set(
      withTiming(1, { duration: reduced ? 200 : WALK_MS, easing: EASE_IN_OUT }, (finished) => {
        if (finished) scheduleOnRN(goWalk);
      }),
    );
  };

  const ask = () => router.push({ pathname: '/ask/[id]', params: { id: tripId ?? trip.id } });

  const chips: { key: string; icon?: ReactNode; label: string; gold?: boolean }[] = [
    { key: 'photos', label: `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}` },
    ...(people.length ? [{ key: 'people', label: `${people.length} ${people.length === 1 ? 'person' : 'people'}` }] : []),
    ...(moment.weather
      ? [{ key: 'wx', icon: <CloudIcon color={colors.textMuted} />, label: `${Math.round(moment.weather.tempF)}°f · ${moment.weather.summary}` }]
      : []),
    ...(moment.isGoldenHour ? [{ key: 'gold', icon: <SunIcon color={colors.text} />, label: 'golden hour', gold: true }] : []),
  ];

  let step = 0;
  const enter = () => (reduced ? undefined : FadeInDown.duration(420).delay(120 + step++ * 70).easing(EASE_OUT));

  // The scene: the first person met here as a standee, with the prints from where they stood.
  const lead = friend ?? people[0];
  const scenePhotos: Photo[] = (lead && friend && friend.id === lead.id ? theirPhotos : photos.filter((p) => p.id !== current?.id)).slice(0, 3);

  return (
    <View style={styles.fill}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 132 }}
      >
        <HeroPager
          photos={photos}
          width={width}
          height={heroH}
          scrollY={scrollY}
          walk={walk}
          walkScale={walkScale}
          reduced={reduced}
          dotsTop={top + 9}
          onPageChange={setPage}
        />

        {/* Paper sheet; opaque so the slower-moving hero slides under it. */}
        <Animated.View style={[styles.sheet, { minHeight: screenH * 0.5 }, contentFade]}>
          <Animated.View entering={enter()} style={{ gap: space.xs }}>
            <Text style={type.caption}>
              {formatClock(moment.startAt)} · stop {moment.order + 1} of {trip.moments.length}
            </Text>
            <Text style={styles.place} accessibilityRole="header" numberOfLines={3}>
              {moment.placeName ?? 'a stop'}
            </Text>
            {moment.caption ? <Text style={styles.caption}>{moment.caption}</Text> : null}
          </Animated.View>

          <Animated.View entering={enter()} style={styles.chips}>
            {chips.map((c) => (
              <Chip key={c.key} icon={c.icon} label={c.label} tone={c.gold ? 'accent' : 'default'} />
            ))}
          </Animated.View>

          {lead ? (
            <Animated.View entering={enter()} style={{ gap: space.md }}>
              <View>
                <Text style={styles.section}>{lead.name}&apos;s side</Text>
                <Text style={type.caption}>seen from where {lead.name.toLowerCase()} stood</Text>
              </View>
              <Scene person={lead} photos={scenePhotos} width={contentW} at={formatClock(moment.startAt)} />
              {people.length > 1 ? (
                <View style={styles.more}>
                  {people
                    .filter((p) => p.id !== lead.id)
                    .map((p, i) => (
                      <Cutout key={p.id} uri={p.avatarUri} name={p.name} width={84} height={104} rotate={i % 2 ? 4 : -4} tag={p.name} />
                    ))}
                </View>
              ) : null}
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
                <Text style={styles.section}>their angle</Text>
                <Text style={type.caption}>
                  drag the line to see it through {friend ? `${friend.name.toLowerCase()}'s` : 'their'} eyes
                </Text>
              </View>
              <AngleCompare mine={current} theirs={theirPhotos} friendName={friend?.name ?? 'them'} width={contentW} reduced={reduced} />
            </Animated.View>
          ) : null}

          {giftFriend ? (
            <Animated.View entering={enter()}>
              <Button
                variant="secondary"
                label={`gift ${giftFriend.name.toLowerCase()} this`}
                onPress={() =>
                  router.push({ pathname: '/gift/[id]', params: { id: moment.id, tripId: tripId ?? trip.id, to: giftFriend.id } })
                }
                accessibilityHint="sends them a postcard, print or film of this stop"
                trailing={<GiftIcon color={colors.text} />}
              />
            </Animated.View>
          ) : null}

          {moment.fact ? (
            <Animated.View entering={enter()} style={styles.quote}>
              <Text style={styles.quoteText}>{moment.fact}</Text>
              <Text style={styles.quoteSource}>nearby {moment.placeName ?? 'this stop'}</Text>
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
        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <Button
              label={plus ? 'walk in' : 'walk in · plus'}
              onPress={walkIn}
              accessibilityHint="step inside this moment in 3d"
              trailing={<ArrowIcon color={colors.accentInk} />}
            />
          </View>
          <Press onPress={ask} accessibilityRole="button" accessibilityLabel="ask about this day" scaleTo={0.92} style={styles.askButton}>
            <ChatIcon size={22} color={colors.text} />
          </Press>
        </View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.sky }, veil]} />
    </View>
  );
}

/** A standee on the left, a tilted stack of their prints on the right, a sticker tag below. */
function Scene({ person, photos, width, at }: { person: Person; photos: Photo[]; width: number; at: string }) {
  const cutW = Math.round(width * 0.46);
  const cutH = Math.round(cutW * 1.5);
  const printW = Math.round(width * 0.58);
  const printH = Math.round(printW * 1.04);
  const [front, ...back] = photos.slice(0, 3);
  const left = width - printW;
  return (
    <View style={{ width, height: Math.max(cutH + 24, printH + cutH * 0.3 + 12) }}>
      {/* Back prints peek out behind the standee; the front print overlaps it, like a3. */}
      {back
        .slice()
        .reverse()
        .map((p, i, arr) => (
          <Print
            key={p.id}
            uri={p.uri}
            width={printW}
            height={printH}
            rotate={i % 2 ? -4 : 6}
            style={{ position: 'absolute', left, top: (arr.length - 1 - i) * 24 }}
          />
        ))}
      <Cutout
        uri={person.avatarUri}
        name={person.name}
        width={cutW}
        height={cutH}
        rotate={-3}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
      {front ? (
        <Print
          uri={front.uri}
          width={printW}
          height={printH}
          rotate={4}
          caption={`${person.name}'s angle`}
          meta={`${at} · by @${person.name.toLowerCase()}`}
          style={{ position: 'absolute', left, top: cutH * 0.3 }}
        />
      ) : null}
      <Sticker label={`@${person.name.toLowerCase()} · ${at}`} rotate={-6} style={{ position: 'absolute', left: -4, top: cutH - 22 }} />
    </View>
  );
}

function BottomFade({ width }: { width: number }) {
  return (
    <Svg width={width} height={200} style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      <Defs>
        <LinearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.bg} stopOpacity="0" />
          <Stop offset="0.55" stopColor={colors.bg} stopOpacity="0.94" />
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
  sheet: {
    marginTop: -SHEET_OVERLAP,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.lg,
  },
  place: { ...type.display, fontSize: 40, lineHeight: 42, letterSpacing: -1.8 },
  caption: { ...type.body, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  narration: { ...type.story },
  section: { ...type.heading, fontSize: 22, lineHeight: 26, marginBottom: space.xxs },
  more: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md },
  quote: { padding: space.md, borderRadius: radius.lg, backgroundColor: colors.skyHaze },
  quoteText: { ...type.story, fontSize: 19, lineHeight: 26 },
  quoteSource: { ...type.caption, marginTop: space.sm },
  closeWrap: { position: 'absolute', right: space.md },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.xl },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  askButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.chip,
  },
});
