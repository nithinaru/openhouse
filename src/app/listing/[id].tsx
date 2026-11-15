import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCents, type Result } from '@/features/commerce/checkout';
import { getListing, hasListingAccess, startListingCheckout, waitForAccess, type Listing } from '@/features/commerce/listings';
import { ComingOnline, PurchaseStatus, Sticker } from '@/features/commerce/ui';
import { usePurchase } from '@/features/commerce/usePurchase';
import { OrderConfirmed } from '@/features/poster/OrderConfirmed';
import { colors, duration, radius, space, type } from '@/theme';
import { ArrowIcon } from '@/theme/icons';
import { Button, SheetHeader } from '@/theme/ui';

// A shared guide link (openhouse://listing/<id>): preview, buy through Whop, then the replay unlocks.
// Access only ever comes from listings:hasAccess.
export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [listing, setListing] = useState<Result<Listing> | null>(null);
  const [owned, setOwned] = useState<string | null>(null);
  const purchase = usePurchase<string>();

  useEffect(() => {
    if (!id) return;
    let alive = true;
    void getListing(id).then((r) => alive && setListing(r));
    void hasListingAccess(id).then((a) => alive && a?.access && setOwned(a.tripId ?? ''));
    return () => {
      alive = false;
    };
  }, [id]);

  const unlockedTrip = purchase.state.phase === 'done' ? purchase.state.value : owned;
  const l = listing?.ok ? listing.value : null;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const watch = () => {
    const tripId = unlockedTrip && unlockedTrip !== 'unlocked' ? unlockedTrip : l?.tripId;
    if (tripId) router.replace({ pathname: '/trip/[id]', params: { id: tripId } });
  };

  const buy = () =>
    id &&
    purchase.buy(
      () => startListingCheckout(id),
      (_c, signal) => waitForAccess(id, { signal }),
    );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.lg, gap: space.lg }}
    >
      <SheetHeader eyebrow={l ? `a walkable day by ${l.sellerName.toLowerCase()}` : 'walkable guide'} title={l?.title ?? 'a day to walk'} onClose={close} />

      {!listing ? (
        <ActivityIndicator color={colors.text} style={{ marginTop: space.xl }} />
      ) : !listing.ok ? (
        listing.reason === 'soon' ? (
          <ComingOnline what="guides" />
        ) : (
          <Text style={[type.body, { textAlign: 'center' }]}>{listing.message}</Text>
        )
      ) : l ? (
        <>
          <View style={styles.photos}>
            {(l.previewUrls.length ? l.previewUrls : [null]).slice(0, 4).map((u, i) =>
              u ? (
                <Image key={u} source={{ uri: u }} style={styles.photo} contentFit="cover" blurRadius={unlockedTrip ? 0 : 18} transition={300} />
              ) : (
                <View key={i} style={styles.photo} />
              ),
            )}
            <Sticker label={formatCents(l.priceCents)} tilt={6} style={styles.sticker} />
          </View>
          <Text style={type.body}>
            {l.stops} stops, the narrated replay, and the route to walk it yourself
          </Text>

          {unlockedTrip !== null ? (
            <Animated.View entering={FadeIn.duration(duration.base)} style={{ gap: space.md }}>
              <OrderConfirmed palette={[colors.sky, colors.pink, colors.text]} detail="unlocked · yours to keep" />
              <Button label="watch the replay" onPress={watch} trailing={<ArrowIcon color={colors.accentInk} />} />
            </Animated.View>
          ) : (
            <Button label={`unlock · ${formatCents(l.priceCents)}`} onPress={buy} loading={purchase.busy} />
          )}
          <PurchaseStatus purchase={purchase} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  photos: { flexDirection: 'row', height: 180, gap: 2, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  photo: { flex: 1, backgroundColor: colors.elevated },
  sticker: { position: 'absolute', top: space.md, right: space.md },
});
