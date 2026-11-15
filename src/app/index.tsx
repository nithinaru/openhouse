import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/features/home/PressableScale';
import { EmptyTrips, TripHeroCard, TripRow } from '@/features/home/TripCards';
import { demoTrip } from '@/lib/demo/demoTrip';
import { getAllTrips } from '@/lib/ingest/store';
import type { Trip } from '@/lib/types';
import { colors, radius, space, type } from '@/theme';

// Ingested trips (this session) first, the cached demo trip after them.
function loadTrips(): { trips: Trip[]; hasIngested: boolean } {
  const ingested = getAllTrips();
  return { trips: [...ingested, demoTrip], hasIngested: ingested.length > 0 };
}

const openTrip = (id: string) => router.push({ pathname: '/trip/[id]', params: { id } });

export default function HomeScreen() {
  const [{ trips, hasIngested }, setData] = useState(loadTrips);

  // The ingest store isn't reactive; re-read whenever Home comes back into view.
  useFocusEffect(
    useCallback(() => {
      setData(loadTrips());
    }, []),
  );

  const [hero, ...rest] = trips;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>Openhouse</Text>
        <PressableScale
          onPress={() => router.push('/people')}
          accessibilityRole="button"
          accessibilityLabel="People"
          hitSlop={8}
          scaleTo={0.94}
          style={styles.peopleChip}
        >
          <View style={styles.peopleDot} />
          <Text style={styles.peopleText}>People</Text>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {hero ? (
          <Animated.View entering={FadeInDown.duration(320).withInitialValues({ transform: [{ translateY: 12 }] })}>
            <Text style={styles.section}>{hasIngested ? 'Latest' : 'Sample day'}</Text>
            <TripHeroCard
              trip={hero}
              badge={hasIngested ? undefined : 'Demo'}
              onPress={() => openTrip(hero.id)}
            />
          </Animated.View>
        ) : (
          <EmptyTrips />
        )}

        {rest.length > 0 && (
          <View style={{ gap: space.sm }}>
            <Text style={styles.section}>Earlier</Text>
            {rest.map((t) => (
              <TripRow key={t.id} trip={t} onPress={() => openTrip(t.id)} />
            ))}
          </View>
        )}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.ctaBar}>
        {!hasIngested && (
          <Text style={[type.caption, { textAlign: 'center' }]}>Your camera roll already remembers the day.</Text>
        )}
        <PressableScale
          onPress={() => router.push('/onboarding')}
          accessibilityRole="button"
          scaleTo={0.96}
          haptic="medium"
          style={styles.cta}
        >
          <Text style={styles.ctaText}>{hasIngested ? 'Read new photos' : 'Read my photos'}</Text>
        </PressableScale>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  wordmark: { ...type.title, letterSpacing: -0.6 },
  peopleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  peopleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  peopleText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  scroll: { padding: space.md, paddingBottom: 140, gap: space.lg },
  section: { ...type.caption, fontWeight: '600', marginBottom: space.sm, marginLeft: 2 },
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    gap: space.sm,
    backgroundColor: 'rgba(14,17,22,0.94)',
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  ctaText: { color: colors.bg, fontSize: 17, fontWeight: '700' },
});
