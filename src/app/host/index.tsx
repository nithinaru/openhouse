import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HOST_NAME, HOST_USER_ID, requestPayout, useHostStats, type Payout } from '@/features/host/api';
import { LiveFeed, money, PayoutCard, PoweredByWhop, SellThrough, StatTile } from '@/features/host/parts';
import { duration, ease, space, type, colors } from '@/theme';
import { CloseButton, haptic, SkyBackground, Sticker } from '@/theme/ui';

// Openhouse for hosts: what an organizer like YC sees while the drop sells. Every number is a
// Whop object read through Convex (host:stats, polled every 3 s). Long-press the title to
// inject a rehearsal sale.
export default function HostScreen() {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { stats, inject, markPaidOut } = useHostStats(HOST_USER_ID);
  const [paying, setPaying] = useState(false);
  const [last, setLast] = useState<Payout | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const preview = stats.source === 'preview';

  const payout = async () => {
    setPaying(true);
    setError(null);
    const res = await requestPayout(HOST_USER_ID, stats.feeBalanceCents);
    setPaying(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    haptic('medium');
    markPaidOut(res.value);
    setLast(res.value);
  };

  const enter = (i: number) => (reduced ? FadeIn.duration(duration.base) : FadeInDown.duration(duration.enter).delay(40 + i * 60).easing(ease.out));

  return (
    <SkyBackground variant="fade">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.lg, gap: space.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Sticker label={`host · ${HOST_NAME}`} small rotate={-4} />
          <CloseButton onPress={close} />
        </View>

        <Animated.View entering={enter(0)}>
          <Pressable
            onLongPress={() => {
              haptic('selection');
              inject();
            }}
            delayLongPress={600}
            accessible={false}
          >
            <Text style={type.display} accessibilityRole="header">
              openhouse for hosts
            </Text>
          </Pressable>
          <Text style={[type.callout, { color: colors.textMuted, marginTop: space.xs }]}>
            yc hackathon day · the drop, live{preview ? ' · preview numbers' : ''}
          </Text>
        </Animated.View>

        <Animated.View entering={enter(1)} style={styles.tiles}>
          <StatTile label="gross revenue" value={stats.grossCents} format={money} big />
          <StatTile label="orders" value={stats.orders} />
          <StatTile label="openhouse+ members" value={stats.members} />
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <SellThrough editions={stats.drop.editions} />
        </Animated.View>

        <Animated.View entering={enter(3)}>
          <LiveFeed recent={stats.recent} live={!preview} />
        </Animated.View>

        <Animated.View entering={enter(4)}>
          <PayoutCard balanceCents={stats.feeBalanceCents} busy={paying} last={last} error={error} onPayout={() => void payout()} />
        </Animated.View>

        <PoweredByWhop />
      </ScrollView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
