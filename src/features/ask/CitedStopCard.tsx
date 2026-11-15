import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { Moment } from '@/lib/types';
import { colors, radius, shadow, space, type } from '@/theme';
import { ChevronRightIcon } from '@/theme/icons';
import { Press, Stamp } from '@/theme/ui';

import { formatTime } from './localAnswer';

/** A stop the answer cites: hero photo, place, time. Tap opens the stop. */
export function CitedStopCard({ moment, onPress }: { moment: Moment; onPress: () => void }) {
  const hero = moment.photos.find((p) => p.id === moment.heroPhotoId) ?? moment.photos[0];
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`open ${moment.placeName ?? 'stop'}, ${formatTime(moment.startAt)}`}
      style={styles.card}
    >
      {hero ? (
        <Image source={{ uri: hero.uri }} style={styles.photo} contentFit="cover" transition={200} />
      ) : (
        <View style={[styles.photo, { backgroundColor: colors.line }]} />
      )}
      <View style={styles.meta}>
        <Text style={styles.place} numberOfLines={1}>
          {moment.placeName ?? 'stop'}
        </Text>
        <Stamp>
          {formatTime(moment.startAt)}
          {moment.weather ? ` · ${Math.round(moment.weather.tempF)}°f` : ''}
          {moment.isGoldenHour ? ' · golden hour' : ''}
        </Stamp>
      </View>
      <ChevronRightIcon color={colors.textMuted} />
    </Press>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    paddingRight: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    ...shadow.chip,
  },
  photo: { width: 64, height: 64, borderRadius: radius.sm, transform: [{ rotate: '-3deg' }], borderWidth: 3, borderColor: colors.bg },
  meta: { flex: 1, gap: space.xs },
  place: { ...type.heading, fontSize: 18, lineHeight: 22 },
});
