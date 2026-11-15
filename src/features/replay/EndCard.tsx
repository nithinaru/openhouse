import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { colors, radius, space } from '@/theme';

import { EASE_OUT, SERIF } from './film';
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
};

// Closing card after the last stop: the day in numbers, its colors, what next.
export function EndCard({ title, date, stats, palette, bottomInset, onFrame, onWalkIn, onAgain }: Props) {
  const cells = [
    { value: stats.distanceLabel, label: 'walked' },
    { value: String(stats.stops), label: stats.stops === 1 ? 'stop' : 'stops' },
    { value: String(stats.people), label: stats.people === 1 ? 'person' : 'people' },
    { value: String(stats.photos), label: 'photos' },
  ];

  return (
    <Animated.View
      entering={FadeInDown.duration(560).easing(EASE_OUT)}
      exiting={FadeOut.duration(220)}
      style={[styles.card, { paddingBottom: bottomInset + space.md }]}
    >
      <Text style={styles.date}>{date}</Text>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>

      <View style={styles.stats}>
        {cells.map((c, i) => (
          <Animated.View key={c.label} entering={FadeIn.duration(400).delay(220 + i * 70)} style={styles.cell}>
            <Text style={styles.value}>{c.value}</Text>
            <Text style={styles.label}>{c.label}</Text>
          </Animated.View>
        ))}
      </View>

      {palette.length ? (
        <Animated.View entering={FadeIn.duration(500).delay(520)} style={styles.palette}>
          {palette.map((c, i) => (
            <View
              key={`${c}-${i}`}
              style={[
                styles.swatch,
                { backgroundColor: c },
                i === 0 && { borderTopLeftRadius: radius.sm, borderBottomLeftRadius: radius.sm },
                i === palette.length - 1 && { borderTopRightRadius: radius.sm, borderBottomRightRadius: radius.sm },
              ]}
            />
          ))}
        </Animated.View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={onFrame}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>Frame it</Text>
        </Pressable>
        {onWalkIn ? (
          <Pressable
            onPress={onWalkIn}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Walk in</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable onPress={onAgain} hitSlop={12} accessibilityRole="button" style={styles.again}>
        <Text style={styles.againText}>Watch again</Text>
      </Pressable>
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
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  date: { fontSize: 13, color: colors.textMuted },
  title: { fontFamily: SERIF, fontSize: 30, lineHeight: 36, color: colors.text, marginTop: space.xs },
  stats: { flexDirection: 'row', marginTop: space.lg },
  cell: { flex: 1 },
  value: { fontFamily: SERIF, fontSize: 26, color: colors.text, fontVariant: ['tabular-nums'] },
  label: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  palette: { flexDirection: 'row', height: 18, marginTop: space.lg },
  swatch: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  primary: {
    flex: 1,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 17, fontWeight: '700', color: '#1A1408' },
  secondary: {
    flex: 1,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: 'rgba(242,238,230,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 17, fontWeight: '600', color: colors.text },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  again: { alignSelf: 'center', paddingVertical: space.md },
  againText: { fontSize: 15, color: colors.textMuted, fontWeight: '600' },
});
