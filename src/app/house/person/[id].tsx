import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clock } from '@/features/house/model';
import { Standee } from '@/features/house/Standee';
import { getHousePerson, HOUSE_PEOPLE, photosForPerson, photoUri, roomForMoment } from '@/lib/demo/demoHouse';
import { DEMO_TRIP_ID, getDemoTrip } from '@/lib/demo/demoTrip';
import { colors, ease, space, type } from '@/theme';
import { BackIcon, ChatIcon } from '@/theme/icons';
import { Button, Chip, Press, Print, Sticker } from '@/theme/ui';

// "their day" (a3): one person's cutout, a tilted stack of their photos, and a way to
// stand where they stood.

const TILTS = [7, -4, 3];

export default function PersonDayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const person = getHousePerson(id ?? '') ?? HOUSE_PEOPLE[0];
  const trip = getDemoTrip(DEMO_TRIP_ID);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const shots = photosForPerson(trip, person).slice(0, 3);
  const met = trip.moments.find((m) => m.id === person.metAt);
  const metRoom = roomForMoment(person.metAt);
  const stops = new Set(person.trail.map((s) => s.momentId)).size;
  const pairing = trip.pairings.find((p) => p.userB === person.id || p.userA === person.id);

  const cutoutH = Math.min(380, Math.round(width * 0.92));
  const printW = Math.round(width * 0.54);
  const printH = Math.round(printW * 0.78);
  const enter = (i: number) =>
    FadeInRight.duration(420)
      .delay(120 + i * 70)
      .easing(ease.out)
      .reduceMotion(ReduceMotion.System);

  const standWhere = () => router.push({ pathname: '/walkin/[id]', params: { id: person.metAt } });

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }]}>
      <View style={styles.header}>
        <Press onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel="back" hitSlop={12} scaleTo={0.9} style={styles.back}>
          <BackIcon color={colors.text} size={22} />
        </Press>
        <Text style={styles.eyebrow} numberOfLines={1}>
          hackathon · {metRoom?.label ?? 'the house'}
        </Text>
        <View style={styles.back} />
      </View>

      <Text style={styles.title} accessibilityRole="header">
        {person.name}&apos;s day
      </Text>
      <Text style={styles.subtitle}>seen from where {person.pronoun} stood</Text>

      <View style={[styles.stage, { height: cutoutH + 40 }]}>
        {/* the prints, back to front: shots[0] lands last, on top and lowest */}
        {shots
          .map((s, i) => ({ ...s, i }))
          .reverse()
          .map(({ photo, moment, i }) => (
            <Animated.View
              key={photo.id}
              entering={enter(shots.length - 1 - i)}
              style={[styles.print, { top: 12 + (shots.length - 1 - i) * Math.round(printH * 0.42), right: -8 + i * 6 }]}
            >
              <Print
                uri={photoUri(photo)}
                width={printW}
                height={printH}
                rotate={TILTS[i]}
                caption={i === 0 ? moment.caption : undefined}
                meta={i === 0 ? `${clock(photo.takenAt)} · by ${person.handle}` : undefined}
              />
            </Animated.View>
          ))}

        <Animated.View entering={FadeInDown.duration(420).easing(ease.out).reduceMotion(ReduceMotion.System)} style={styles.cutout}>
          <Standee person={person} height={cutoutH} tag={null} />
          <Sticker label={`${person.handle} · ${metRoom?.spot ?? 'in the house'}`} rotate={-6} style={styles.tag} />
        </Animated.View>
      </View>

      <View style={styles.chips}>
        <Chip label={`${person.photoCount} photos`} />
        <Chip label={`${stops} stops`} />
        {pairing ? <Chip label={`met you ${clock(pairing.at)}`} /> : null}
      </View>

      <View style={styles.actions}>
        <Button
          label={`stand where ${person.pronoun} stood`}
          onPress={standWhere}
          style={{ flex: 1 }}
          accessibilityHint={met ? `opens ${met.placeName ?? 'the stop'} in 3d` : undefined}
        />
        <Press
          onPress={() => router.push({ pathname: '/ask/[id]', params: { id: DEMO_TRIP_ID } })}
          accessibilityRole="button"
          accessibilityLabel={`ask about ${person.name}'s day`}
          scaleTo={0.9}
          style={styles.ask}
        >
          <ChatIcon color={colors.text} size={22} />
        </Press>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 },
  back: { width: 44, height: 44, justifyContent: 'center' },
  eyebrow: { ...type.callout, color: colors.textFaint, flexShrink: 1 },
  title: { ...type.display, fontSize: 40, lineHeight: 44, letterSpacing: -1.8, marginTop: space.md },
  subtitle: { ...type.body, color: colors.textFaint, marginTop: 2 },
  stage: { marginTop: space.md, flexShrink: 1 },
  print: { position: 'absolute' },
  cutout: { position: 'absolute', left: -4, bottom: 0, alignItems: 'flex-start' },
  tag: { marginTop: -28, marginLeft: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: 'auto', paddingTop: space.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  ask: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.pink, alignItems: 'center', justifyContent: 'center' },
});
