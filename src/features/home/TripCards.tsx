import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { Trip } from '@/lib/types';
import { colors, radius, space, type } from '@/theme';
import { PinIcon, PlayIcon } from '@/theme/icons';
import { Press, Stamp } from '@/theme/ui';

import { collagePhotos, dateLabel, paletteFor, statsLabel } from './tripMeta';

const IMG_TRANSITION = 220;

function Swatches({ palette, size = 12 }: { palette: string[]; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }} accessibilityElementsHidden>
      {palette.map((c, i) => (
        <View
          key={`${c}-${i}`}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: c,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.lineStrong,
          }}
        />
      ))}
    </View>
  );
}

function Photo({ uri, style }: { uri?: string; style: object }) {
  return (
    <View style={[style, { backgroundColor: colors.elevated, overflow: 'hidden' }]}>
      {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={IMG_TRANSITION} />}
    </View>
  );
}

/** Latest trip: a contact sheet of three prints, then title, date stamp, stats and palette. */
export function TripHeroCard({ trip, onPress }: { trip: Trip; badge?: string; onPress: () => void }) {
  const [a, b, c] = collagePhotos(trip, 3);
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${trip.title}. ${statsLabel(trip)}. Opens replay.`}
      style={styles.hero}
    >
      <View style={styles.collage}>
        <Photo uri={a?.uri} style={{ flex: 2 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Photo uri={b?.uri ?? a?.uri} style={{ flex: 1 }} />
          <Photo uri={c?.uri ?? b?.uri ?? a?.uri} style={{ flex: 1 }} />
        </View>
        <View style={styles.playChip}>
          <PlayIcon size={12} color={colors.text} />
          <Text style={styles.playText}>Replay</Text>
        </View>
      </View>
      <View style={styles.heroBody}>
        <Stamp>{dateLabel(trip)}</Stamp>
        <Text style={type.title} numberOfLines={2}>
          {trip.title}
        </Text>
        <View style={styles.footer}>
          <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]}>{statsLabel(trip)}</Text>
          <Swatches palette={paletteFor(trip)} />
        </View>
      </View>
    </Press>
  );
}

/** Older trips: thumbnail, title, stats. */
export function TripRow({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const [hero] = collagePhotos(trip, 1);
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${trip.title}. ${statsLabel(trip)}.`}
      style={styles.row}
    >
      <Photo uri={hero?.uri} style={styles.rowThumb} />
      <View style={{ flex: 1, gap: space.xs }}>
        <Text style={type.label} numberOfLines={1}>
          {trip.title}
        </Text>
        <Text style={type.caption} numberOfLines={1}>
          {statsLabel(trip)}
        </Text>
      </View>
      <Swatches palette={paletteFor(trip).slice(0, 3)} size={10} />
    </Press>
  );
}

export function EmptyTrips() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyPin}>
        <PinIcon size={20} color={colors.textMuted} />
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
  collage: { flexDirection: 'row', gap: 2, aspectRatio: 4 / 3 },
  playChip: {
    position: 'absolute',
    left: space.md,
    bottom: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.scrim,
  },
  playText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  heroBody: { paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.md, gap: space.xs },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    paddingRight: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  rowThumb: { width: 56, height: 56, borderRadius: radius.sm },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  emptyPin: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
});
