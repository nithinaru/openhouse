// Shared bits for the hardcoded "next whop integrations" demo screens (src/app/whop/*).
// Static data only: nothing here talks to Whop or Convex.

import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { getHousePerson, HOUSE_PEOPLE, photoUri } from '@/lib/demo/demoHouse';
import { demoTrip } from '@/lib/demo/demoTrip';
import { colors, fonts, radius } from '@/theme';

export const WHOP_ORANGE = '#FA4616';

/** The replay hero: kickoff hall crop from the demo trip. */
export const REPLAY_PHOTO = photoUri(demoTrip.moments[1]?.photos[0] ?? { id: 'm2-p0', uri: '' });
export const FLOOR_PHOTO = photoUri(demoTrip.moments[2]?.photos[0] ?? { id: 'm3-p0', uri: '' });

/** Round avatar cropped from the top of a cutout standee; falls back to an initial. */
export function Avatar({ id, name, size = 36, style }: { id?: string; name: string; size?: number; style?: StyleProp<ViewStyle> }) {
  const person = id ? getHousePerson(id) : undefined;
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {person ? (
        <Image source={person.cutout} style={{ width: size, height: size * 1.6 }} contentFit="cover" contentPosition="top" />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{name.slice(0, 1).toLowerCase()}</Text>
      )}
    </View>
  );
}

/** A small whop wordmark chip. */
export function WhopMark({ label = 'whop', style }: { label?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.mark, style]}>
      <View style={styles.markDot} />
      <Text style={styles.markText}>{label}</Text>
    </View>
  );
}

export const PEOPLE = HOUSE_PEOPLE;

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: colors.skyHaze,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  initial: { fontFamily: fonts.bold, color: colors.text, marginTop: '22%' },
  mark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.ink,
    alignSelf: 'flex-start',
  },
  markDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: WHOP_ORANGE },
  markText: { fontFamily: fonts.bold, fontSize: 12, color: colors.accentInk, textTransform: 'lowercase' },
});
