import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { colors, ease, fonts, radius, space, type } from '@/theme';
import { Button, Stamp } from '@/theme/ui';

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
      <Stamp>{date}</Stamp>
      <Text style={[type.title, { marginTop: space.xs }]} numberOfLines={2}>
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
        <Button label="Frame it" onPress={onFrame} style={{ flex: 1 }} />
        {onWalkIn ? <Button variant="secondary" label="Walk in" onPress={onWalkIn} style={{ flex: 1 }} /> : null}
      </View>
      <View style={styles.quiet}>
        {ask ? <Button variant="quiet" label="Ask about this day" onPress={ask} /> : null}
        <Button variant="quiet" label="Watch again" onPress={onAgain} />
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
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  stats: { flexDirection: 'row', marginTop: space.lg },
  cell: { flex: 1, gap: space.xxs },
  value: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 32, color: colors.text, fontVariant: ['tabular-nums'] },
  palette: { flexDirection: 'row', height: 12, marginTop: space.lg, borderRadius: radius.xs, overflow: 'hidden' },
  swatch: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  quiet: { flexDirection: 'row', justifyContent: 'center', marginTop: space.xs },
});
