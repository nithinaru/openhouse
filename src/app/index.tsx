import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GiftBanner } from '@/features/commerce/GiftBanner';
import { useSellerListings } from '@/features/commerce/listings';
import { BagIcon, TagIcon } from '@/features/commerce/ui';
import { AddTodayCard, EmptyTrips, TripCard, WhoStrip } from '@/features/home/TripCards';
import { useDemoFlags } from '@/features/demo/demoFlags';
import { EarningsCard } from '@/features/sell/EarningsCard';
import { DEMO_MY_NAME } from '@/features/people/pair';
import { useBackendStatus } from '@/lib/data/useBackendStatus';
import { isDemoTripId, useTrips } from '@/lib/data/trips';
import type { Person } from '@/lib/types';
import { colors, duration, ease, fonts, space, type } from '@/theme';
import { ArrowIcon } from '@/theme/icons';
import { AppDock } from '@/features/dock/Dock';
import { Chip, Press, Sticker, Wordmark } from '@/theme/ui';

import { shortDate, statsLabel } from '@/features/home/tripMeta';

const openTrip = (id: string) => router.push({ pathname: '/trip/[id]', params: { id } });
const PAD = 20;
const GAP = 12;

export default function HomeScreen() {
  // Own trips (live + this session's ingest) first, the demo trip (live seed, else cached) last.
  const { data: trips, refresh } = useTrips();
  const hasIngested = trips.some((t) => !isDemoTripId(t.id));
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // The ingest store isn't reactive; re-read whenever Home comes back into view.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const people = useMemo(() => {
    const seen = new Map<string, Person>();
    for (const t of trips) for (const p of t.people) if (!seen.has(p.id)) seen.set(p.id, p);
    return [...seen.values()];
  }, [trips]);

  const cardW = Math.round(Math.min(width * 0.62, 300));
  const cardH = Math.round(cardW * 1.36);
  const latest = trips[0];
  // Seller dashboard: earnings tick up live while guides sell (listings:forSeller, polled).
  const seller = useSellerListings(latest?.id);
  const { ownsHoodie } = useDemoFlags();

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.sm,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brand}>
            {/* Hidden rehearsal switch: long-press the wordmark for the demo panel. */}
            <Wordmark size={30} onLongPress={() => router.push('/demo')} />
            <BackendDot />
          </View>
          <Press
            onPress={() => router.push('/people')}
            accessibilityRole="button"
            accessibilityLabel="people"
            scaleTo={0.9}
            hitSlop={6}
            style={styles.me}
          >
            <Text style={styles.meText}>{DEMO_MY_NAME.slice(0, 1).toLowerCase()}</Text>
          </Press>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            your days
          </Text>
          <Sticker label="nothing to type" rotate={5} style={{ marginTop: space.sm }} />
        </View>

        <View style={{ paddingHorizontal: PAD, paddingBottom: space.md }}>
          <GiftBanner />
        </View>

        {latest ? (
          <Animated.View
            entering={FadeInDown.duration(duration.enter)
              .easing(ease.out)
              .withInitialValues({ transform: [{ translateY: 12 }] })}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={cardW + GAP}
              decelerationRate="fast"
              disableIntervalMomentum
              contentContainerStyle={{ paddingHorizontal: PAD, gap: GAP }}
            >
              {trips.map((t) => (
                <TripCard
                  key={t.id}
                  trip={t}
                  width={cardW}
                  height={cardH}
                  meta={
                    isDemoTripId(t.id) && !hasIngested ? `sample day · ${statsLabel(t, true)}` : `${shortDate(t)} · ${statsLabel(t, true)}`
                  }
                  onPress={() => openTrip(t.id)}
                />
              ))}
            </ScrollView>
            {/* Whop: make something from the latest day, or sell it as a walkable guide. */}
            <View style={styles.commerce}>
              <Chip
                label="make something"
                icon={<BagIcon size={16} color={colors.text} />}
                onPress={() => router.push({ pathname: '/shop/[id]', params: { id: latest.id } })}
              />
              <Chip
                label="sell this day"
                icon={<TagIcon size={16} color={colors.text} />}
                onPress={() => router.push({ pathname: '/sell/[id]', params: { id: latest.id } })}
              />
            </View>
            {ownsHoodie ? (
              <View style={[styles.commerce, { marginTop: space.sm }]}>
                <Chip label="owners chat · 3 new" onPress={() => router.push('/whop/chat')} />
              </View>
            ) : null}
            {seller.listings.length ? (
              <Press
                onPress={() => router.push({ pathname: '/sell/[id]', params: { id: latest.id } })}
                accessibilityRole="button"
                style={{ paddingHorizontal: PAD, marginTop: space.md }}
              >
                <EarningsCard seller={seller} compact />
              </Press>
            ) : null}
          </Animated.View>
        ) : (
          <EmptyTrips />
        )}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              who&apos;s inside
            </Text>
            <Press
              onPress={() => router.push('/people')}
              accessibilityRole="button"
              accessibilityLabel={`${people.length} ${people.length === 1 ? 'person' : 'people'}, open people`}
              haptic="selection"
              hitSlop={10}
              style={styles.sectionLink}
            >
              <Text style={styles.sectionLinkText}>
                {people.length} {people.length === 1 ? 'person' : 'people'}
              </Text>
              <ArrowIcon size={16} color={colors.textMuted} />
            </Press>
          </View>
          <WhoStrip people={people} onAdd={() => router.push('/people')} />
        </View>

        <View style={[styles.section, { paddingHorizontal: PAD }]}>
          <AddTodayCard first={!hasIngested} onPress={() => router.push('/onboarding')} />
        </View>
      </ScrollView>

      <View pointerEvents="box-none" style={[styles.dock, { bottom: insets.bottom + space.sm }]}>
        <AppDock active="home" tripId={latest?.id} />
      </View>
    </View>
  );
}

/** Tiny backend light beside the wordmark: green when Convex answers, faint otherwise. */
function BackendDot() {
  const state = useBackendStatus();
  return (
    <View
      accessible
      accessibilityLabel={state === 'live' ? 'connected to live backend' : 'offline demo data'}
      style={[
        styles.dot,
        {
          backgroundColor: state === 'live' ? colors.success : colors.textFaint,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    paddingTop: space.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  me: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meText: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  title: { ...type.display, fontSize: 44, lineHeight: 46, letterSpacing: -2 },
  section: { marginTop: space.xl },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    marginBottom: space.md,
  },
  sectionTitle: {
    ...type.title,
    fontSize: 26,
    lineHeight: 28,
    letterSpacing: -0.9,
  },
  sectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 32,
  },
  sectionLinkText: { ...type.callout, color: colors.textMuted },
  dock: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  commerce: { flexDirection: 'row', gap: space.sm, paddingHorizontal: PAD, marginTop: space.md },
});
