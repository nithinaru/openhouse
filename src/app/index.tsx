import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyTrips, TripHeroCard, TripRow } from '@/features/home/TripCards';
import { useBackendStatus } from '@/lib/data/useBackendStatus';
import { isDemoTripId, useTrips } from '@/lib/data/trips';
import { colors, duration, ease, fonts, space, type } from '@/theme';
import { PeopleIcon } from '@/theme/icons';
import { Button, IconButton } from '@/theme/ui';

const openTrip = (id: string) => router.push({ pathname: '/trip/[id]', params: { id } });

export default function HomeScreen() {
  // Own trips (live + this session's ingest) first, the demo trip (live seed, else cached) last.
  const { data: trips, refresh } = useTrips();
  const hasIngested = trips.some((t) => !isDemoTripId(t.id));

  // The ingest store isn't reactive; re-read whenever Home comes back into view.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const [hero, ...rest] = trips;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.brand}>
          {/* Hidden rehearsal switch: long-press the wordmark for the demo panel. */}
          <Text
            style={styles.wordmark}
            onLongPress={() => router.push('/demo')}
            suppressHighlighting
            accessibilityRole="header"
          >
            Openhouse
          </Text>
          <BackendDot />
        </View>
        <IconButton icon={<PeopleIcon color={colors.text} />} label="People" onPress={() => router.push('/people')} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {hero ? (
          <Animated.View entering={FadeInDown.duration(duration.enter).easing(ease.out).withInitialValues({ transform: [{ translateY: 12 }] })}>
            <Text style={styles.section}>{hasIngested ? 'Latest' : 'Sample day'}</Text>
            <TripHeroCard trip={hero} onPress={() => openTrip(hero.id)} />
          </Animated.View>
        ) : (
          <EmptyTrips />
        )}

        {rest.length > 0 && (
          <View>
            <Text style={styles.section}>Earlier</Text>
            <View style={{ gap: space.sm }}>
              {rest.map((t) => (
                <TripRow key={t.id} trip={t} onPress={() => openTrip(t.id)} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.ctaBar}>
        {!hasIngested && <Text style={[type.caption, { textAlign: 'center' }]}>Your camera roll already remembers the day</Text>}
        <Button
          label={hasIngested ? 'Read new photos' : 'Read my photos'}
          onPress={() => router.push('/onboarding')}
          style={{ marginBottom: space.sm }}
        />
      </SafeAreaView>
    </SafeAreaView>
  );
}

/** Tiny backend light beside the wordmark: amber when Convex answers, faint otherwise. */
function BackendDot() {
  const state = useBackendStatus();
  return (
    <View
      accessible
      accessibilityLabel={state === 'live' ? 'Connected to live backend' : 'Offline demo data'}
      style={[styles.dot, { backgroundColor: state === 'live' ? colors.accent : colors.textFaint }]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  wordmark: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, color: colors.text, letterSpacing: -0.3 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  scroll: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: 160, gap: space.lg },
  section: { ...type.caption, marginBottom: space.sm },
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    gap: space.sm,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
