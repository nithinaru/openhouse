import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/features/home/PressableScale';
import type { Moment } from '@/lib/types';
import { colors, radius, space } from '@/theme';

import { formatTime } from './localAnswer';

/** A stop the answer cites: hero photo, place, time. Tap opens the stop. */
export function CitedStopCard({ moment, onPress }: { moment: Moment; onPress: () => void }) {
  const hero = moment.photos.find((p) => p.id === moment.heroPhotoId) ?? moment.photos[0];
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${moment.placeName ?? 'stop'}, ${formatTime(moment.startAt)}`}
      style={styles.card}
    >
      {hero ? (
        <Image source={{ uri: hero.uri }} style={styles.photo} contentFit="cover" transition={200} />
      ) : (
        <View style={[styles.photo, { backgroundColor: colors.line }]} />
      )}
      <View style={styles.meta}>
        <Text style={styles.place} numberOfLines={1}>
          {moment.placeName ?? 'Stop'}
        </Text>
        <Text style={styles.time}>
          {formatTime(moment.startAt)}
          {moment.weather ? ` · ${Math.round(moment.weather.tempF)}°F` : ''}
          {moment.isGoldenHour ? ' · golden hour' : ''}
        </Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    paddingRight: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  photo: { width: 64, height: 64, borderRadius: radius.sm },
  meta: { flex: 1, gap: 2 },
  place: { fontSize: 16, fontWeight: '600', color: colors.text },
  time: { fontSize: 13, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  chev: { fontSize: 24, color: colors.textMuted, marginTop: -2 },
});
