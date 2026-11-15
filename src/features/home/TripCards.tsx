import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { Trip } from '@/lib/types';
import { colors, radius, space, type } from '@/theme';

import { PressableScale } from './PressableScale';
import { collagePhotos, dateLabel, paletteFor, statsLabel } from './tripMeta';

const IMG_TRANSITION = 220;

function Swatches({ palette, size = 14 }: { palette: string[]; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityElementsHidden>
      {palette.map((c, i) => (
        <View
          key={`${c}-${i}`}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: c,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(255,255,255,0.18)',
          }}
        />
      ))}
    </View>
  );
}

function Photo({ uri, style }: { uri?: string; style: object }) {
  return (
    <View style={[style, { backgroundColor: colors.line, overflow: 'hidden' }]}>
      {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={IMG_TRANSITION} />}
    </View>
  );
}

/** Latest trip: one big photo and two stacked, then title, date, stats and palette. */
export function TripHeroCard({ trip, badge, onPress }: { trip: Trip; badge?: string; onPress: () => void }) {
  const [a, b, c] = collagePhotos(trip, 3);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${trip.title}. ${statsLabel(trip)}. Opens replay.`}
      style={styles.hero}
    >
      <View style={styles.collage}>
        <Photo uri={a?.uri} style={{ flex: 2 }} />
        <View style={{ flex: 1, gap: 3 }}>
          <Photo uri={b?.uri ?? a?.uri} style={{ flex: 1 }} />
          <Photo uri={c?.uri ?? b?.uri ?? a?.uri} style={{ flex: 1 }} />
        </View>
        {badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
        <View style={styles.playChip}>
          <Text style={styles.playText}>▶  Replay</Text>
        </View>
      </View>
      <View style={{ padding: space.md, gap: space.sm }}>
        <Text style={[type.title, { fontSize: 26, letterSpacing: -0.4 }]} numberOfLines={2}>
          {trip.title}
        </Text>
        <Text style={type.caption}>{dateLabel(trip)}</Text>
        <View style={styles.footer}>
          <Text style={[type.caption, { color: colors.text, fontVariant: ['tabular-nums'] }]}>{statsLabel(trip)}</Text>
          <Swatches palette={paletteFor(trip)} />
        </View>
      </View>
    </PressableScale>
  );
}

/** Older trips: thumbnail, title, stats. */
export function TripRow({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const [hero] = collagePhotos(trip, 1);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${trip.title}. ${statsLabel(trip)}.`}
      style={styles.row}
    >
      <Photo uri={hero?.uri} style={styles.rowThumb} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={1}>
          {trip.title}
        </Text>
        <Text style={type.caption} numberOfLines={1}>
          {statsLabel(trip)}
        </Text>
      </View>
      <Swatches palette={paletteFor(trip).slice(0, 3)} size={10} />
    </PressableScale>
  );
}

export function EmptyTrips() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyPin}>
        <View style={styles.emptyDot} />
      </View>
      <Text style={[type.heading, { textAlign: 'center' }]}>No days yet</Text>
      <Text style={[type.caption, { textAlign: 'center', maxWidth: 260 }]}>
        Openhouse rebuilds where you went from the photos you already took. Nothing to type.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  collage: { flexDirection: 'row', gap: 3, aspectRatio: 4 / 3 },
  badge: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    backgroundColor: 'rgba(14,17,22,0.72)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  playChip: {
    position: 'absolute',
    right: space.md,
    bottom: space.md,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  playText: { color: colors.bg, fontSize: 14, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    paddingRight: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  rowThumb: { width: 56, height: 56, borderRadius: radius.sm },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  emptyPin: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  emptyDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
});
