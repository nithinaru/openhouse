import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCents } from '@/features/commerce/checkout';
import { PLUS_PERKS, PLUS_PRICE_CENTS, startMembershipCheckout, useEntitlements, waitForPlus } from '@/features/commerce/membership';
import { Confirmed, PurchaseStatus, Sticker } from '@/features/commerce/ui';
import { usePurchase } from '@/features/commerce/usePurchase';
import { POSTER_VARIANTS, Poster } from '@/features/poster/Poster';
import { useTrip } from '@/features/replay/useTrip';
import { colors, duration, ease, radius, shadow, space, type } from '@/theme';
import { Button, SheetHeader } from '@/theme/ui';

const HEADLINE: Record<string, string> = {
  styles: 'frame it in every style',
  walkin: 'walk in as often as you like',
  default: 'get more out of every day',
};

// Openhouse+ paywall. Opened by the soft locks (poster styles, Walk in) with ?from= and ?tripId=.
export default function PlusScreen() {
  const { from, tripId } = useLocalSearchParams<{ from?: string; tripId?: string }>();
  const trip = useTrip(tripId);
  const ent = useEntitlements();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const purchase = usePurchase<true>();

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const done = purchase.state.phase === 'done' || ent.member;
  const posterW = Math.min(96, (width - space.lg * 2 - space.md * 2) / 3);

  const join = () =>
    purchase.buy(
      () => startMembershipCheckout(),
      async (_c, signal) => ((await waitForPlus({ signal })) ? true : null),
    );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.lg, gap: space.lg }}
    >
      <SheetHeader
        eyebrow="plus"
        title={HEADLINE[from ?? 'default'] ?? HEADLINE.default}
        onClose={close}
        onTitleLongPress={() => purchase.preview(true)}
      />

      {/* Show, don't tell: the styles plus unlocks, drawn from this trip. */}
      <View style={styles.wall}>
        {POSTER_VARIANTS.map((v, i) => (
          <Animated.View
            key={v.id}
            entering={reduced ? undefined : FadeInDown.duration(duration.enter).delay(80 + i * 80).easing(ease.out)}
            style={[styles.print, shadow.print, { transform: [{ rotate: `${(i - 1) * 4}deg` }, { translateY: i === 1 ? -8 : 0 }] }]}
          >
            <Poster trip={trip} width={posterW} variant={v.id} />
          </Animated.View>
        ))}
        <Sticker label="all three with plus" tilt={-6} style={styles.wallSticker} />
      </View>

      <View style={{ gap: space.sm }}>
        {PLUS_PERKS.map((p) => (
          <View key={p.id} style={[styles.perk, p.id === from ? styles.perkFocus : null]}>
            <View style={styles.check} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.label}>{p.title}</Text>
              <Text style={type.caption}>{p.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      {done ? (
        <Animated.View entering={FadeIn.duration(duration.base)} style={{ gap: space.md }}>
          <Confirmed
            palette={[colors.sky, colors.pink, colors.text, colors.skyDeep]}
            detail="plus · $5 a month · billed by whop"
            next={[
              { label: 'every poster style is open', detail: 'night map and field notes are on the frame screen' },
              { label: 'walk in anywhere', detail: 'no limit on 3d stops' },
              { label: 'your first month in review', detail: 'lands on the 1st, narrated' },
            ]}
          />
          <Button label="back to it" onPress={close} />
        </Animated.View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Text style={[type.heading, { textAlign: 'center' }]}>
            {formatCents(PLUS_PRICE_CENTS)} a month
          </Text>
          <Text style={[type.caption, { textAlign: 'center' }]}>cancel anytime from your whop account</Text>
          <Button label={`start plus · ${formatCents(PLUS_PRICE_CENTS)}/mo`} onPress={join} loading={purchase.busy} />
          <PurchaseStatus purchase={purchase} />
          <Button variant="quiet" label="not now" onPress={close} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wall: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.sky,
  },
  print: { padding: 4, backgroundColor: colors.bg, borderRadius: 2 },
  wallSticker: { position: 'absolute', bottom: space.sm, right: space.md },
  perk: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface },
  perkFocus: { backgroundColor: colors.skyHaze },
  check: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.pinkEdge },
});
