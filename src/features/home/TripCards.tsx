import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { Person, Trip } from '@/lib/types';
import { colors, fonts, radius, shadow, space, type } from '@/theme';
import { PinIcon, PlusIcon } from '@/theme/icons';
import { Cutout, MediaShade, Press, Sticker } from '@/theme/ui';

import { collagePhotos, shortDate, statsLabel } from './tripMeta';

const IMG_TRANSITION = 220;

/** A day as a big photo card: hero print full-bleed, lowercase title on the photo. */
export function TripCard({
  trip,
  width,
  height,
  meta,
  onPress,
}: {
  trip: Trip;
  width: number;
  height: number;
  /** Line under the title; defaults to the date and stop count. */
  meta?: string;
  onPress: () => void;
}) {
  const [hero] = collagePhotos(trip, 1);
  const line = meta ?? `${shortDate(trip)} · ${statsLabel(trip, true)}`;
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${trip.title}. ${statsLabel(trip)}. opens replay`}
      style={[styles.card, { width, height }]}
    >
      {hero ? <Image source={{ uri: hero.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={IMG_TRANSITION} /> : null}
      <MediaShade from={0.38} strength={0.78} />
      <View style={styles.cardText}>
        <Text style={styles.cardTitle} numberOfLines={3}>
          {trip.title}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {line}
        </Text>
      </View>
    </Press>
  );
}

/** Kept for older imports: the full-width version of the card. */
export function TripHeroCard({ trip, onPress }: { trip: Trip; badge?: string; onPress: () => void }) {
  return <TripCard trip={trip} width={320} height={400} onPress={onPress} />;
}

/** Compact row: thumbnail print, title, stats. */
export function TripRow({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const [hero] = collagePhotos(trip, 1);
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${trip.title}. ${statsLabel(trip)}.`} style={styles.row}>
      <View style={styles.rowThumb}>
        {hero ? <Image source={{ uri: hero.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={IMG_TRANSITION} /> : null}
      </View>
      <View style={{ flex: 1, gap: space.xxs }}>
        <Text style={type.heading} numberOfLines={1}>
          {trip.title}
        </Text>
        <Text style={type.caption} numberOfLines={1}>
          {statsLabel(trip)}
        </Text>
      </View>
    </Press>
  );
}

const TILT = [-5, 3, -2, 4];

/** "who's inside": the people from your days as an overlapping row of standees. */
export function WhoStrip({ people, onAdd }: { people: Person[]; onAdd: () => void }) {
  const shown = people.slice(0, 3);
  return (
    <View style={styles.strip}>
      {shown.map((p, i) => (
        <Cutout
          key={p.id}
          uri={p.avatarUri}
          name={p.name}
          width={118}
          height={150}
          rotate={TILT[i % TILT.length]}
          tag={p.name}
          tagRotate={i % 2 ? 4 : -5}
          style={{
            marginLeft: i === 0 ? 0 : -22,
            marginTop: i % 2 ? 14 : 0,
            zIndex: 3 - i,
          }}
        />
      ))}
      <Sticker
        label="+ add a friend"
        tone="paper"
        rotate={-3}
        onPress={onAdd}
        accessibilityLabel="add a friend"
        style={{ marginLeft: shown.length ? space.md : 0, alignSelf: 'center' }}
      />
    </View>
  );
}

/** Dashed "+ add today" card: opens the ingest flow. */
export function AddTodayCard({ onPress, first }: { onPress: () => void; first?: boolean }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel="add today from your photos" style={styles.add} haptic="medium">
      <View style={styles.addIcon}>
        <PlusIcon size={16} color={colors.accentInk} />
      </View>
      <Text style={styles.addText} numberOfLines={2}>
        <Text style={styles.addStrong}>{first ? 'read my photos ' : 'add today '}</Text>
        <Text style={styles.addMuted}>your camera roll already remembers it</Text>
      </Text>
    </Press>
  );
}

export function EmptyTrips() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyPin}>
        <PinIcon size={20} color={colors.textMuted} />
      </View>
      <Text style={[type.heading, { textAlign: 'center' }]}>no days yet</Text>
      <Text style={[type.caption, { textAlign: 'center', maxWidth: 260 }]}>
        openhouse rebuilds where you went from the photos you already took. nothing to type.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  cardText: {
    position: 'absolute',
    left: space.md + 4,
    right: space.md,
    bottom: space.md + 4,
    gap: space.xs,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 30,
    letterSpacing: -1.2,
    color: colors.onMedia,
    textTransform: 'lowercase',
  },
  cardMeta: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.88)',
    textTransform: 'lowercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    paddingRight: space.md,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  rowThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: space.xs,
    paddingHorizontal: 20,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 76,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.ink,
    backgroundColor: colors.bg,
  },
  addIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.chip,
  },
  addText: { flex: 1 },
  addStrong: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: -0.4,
    color: colors.text,
  },
  addMuted: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  emptyPin: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
});
