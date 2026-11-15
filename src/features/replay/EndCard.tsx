import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { useEntitlements } from '@/features/commerce/membership';
import { colors, ease, fonts, radius, shadow, space, type } from '@/theme';
import { Button, Sticker } from '@/theme/ui';

import type { TripStats } from './stats';

type Props = {
  title: string;
  date: string;
  stats: TripStats;
  palette: string[];
  bottomInset: number;
  onFrame: () => void;
  onWalkIn?: () => void;
  onAgain: () => void;
  /** Defaults to opening the Ask sheet for the current trip route. */
  onAsk?: () => void;
};

// Closing card after the last stop: the day in numbers, its colors, what next.
export function EndCard({ title, date, stats, palette, bottomInset, onFrame, onWalkIn, onAgain, onAsk }: Props) {
  const { id: tripId } = useLocalSearchParams<{ id?: string }>();
  const ask =
    onAsk ?? (tripId ? () => router.push({ pathname: '/ask/[id]', params: { id: tripId } }) : undefined);
  // Walk in is an Openhouse+ perk: soft lock opens the paywall instead.
  const { plus } = useEntitlements(tripId);
  const walkIn =
    onWalkIn && !plus ? () => router.push({ pathname: '/plus', params: { from: 'walkin', tripId: tripId ?? '' } }) : onWalkIn;
  const makeSomething = tripId ? () => router.push({ pathname: '/shop/[id]', params: { id: tripId } }) : undefined;
  const openDrop = tripId ? () => router.push({ pathname: '/drop/[id]', params: { id: tripId } }) : undefined;
  const cells = [
    { value: stats.distanceLabel, label: 'walked' },
    { value: String(stats.stops), label: stats.stops === 1 ? 'stop' : 'stops' },
    { value: String(stats.people), label: stats.people === 1 ? 'person' : 'people' },
    { value: String(stats.photos), label: 'photos' },
  ];

  return (
    <Animated.View
      entering={FadeInDown.duration(560).easing(ease.out)}
      exiting={FadeOut.duration(220)}
      style={[styles.card, { paddingBottom: bottomInset + space.sm }]}
    >
      <Sticker label={date} small rotate={-3} />
      <Text style={[type.title, { marginTop: space.md }]} numberOfLines={2}>
        {title}
      </Text>

      <View style={styles.stats}>
        {cells.map((c, i) => (
          <Animated.View key={c.label} entering={FadeIn.duration(400).delay(220 + i * 70)} style={styles.cell}>
            <Text style={styles.value}>{c.value}</Text>
            <Text style={type.caption}>{c.label}</Text>
          </Animated.View>
        ))}
      </View>

      {palette.length ? (
        <Animated.View entering={FadeIn.duration(500).delay(520)} style={styles.palette}>
          {palette.map((c, i) => (
            <View key={`${c}-${i}`} style={[styles.swatch, { backgroundColor: c }]} />
          ))}
        </Animated.View>
      ) : null}

      <View style={styles.actions}>
        <Button label="frame it" onPress={onFrame} style={{ flex: 1 }} />
        {walkIn ? <Button variant="secondary" label={plus ? 'walk in' : 'walk in · plus'} onPress={walkIn} style={{ flex: 1 }} /> : null}
      </View>
      {makeSomething ? (
        <Button variant="secondary" label="make something" onPress={makeSomething} style={{ marginTop: space.sm }} />
      ) : null}
      {openDrop ? <Button variant="quiet" label="the drop →" onPress={openDrop} /> : null}
      <View style={styles.quiet}>
        {ask ? <Button variant="quiet" label="ask about this day" onPress={ask} /> : null}
        <Button variant="quiet" label="watch again" onPress={onAgain} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    ...shadow.float,
  },
  stats: { flexDirection: 'row', marginTop: space.lg },
  cell: { flex: 1, gap: space.xxs },
  value: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 34, letterSpacing: -1.2, color: colors.text, fontVariant: ['tabular-nums'], textTransform: 'lowercase' },
  palette: { flexDirection: 'row', height: 10, marginTop: space.lg, borderRadius: radius.full, overflow: 'hidden' },
  swatch: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  quiet: { flexDirection: 'row', justifyContent: 'center', marginTop: space.xs },
});
