import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Product } from '@/features/commerce/checkout';
import { Section, TagIcon } from '@/features/commerce/ui';
import { useTrip } from '@/features/replay/useTrip';
import { FriendPicker, ProductCard } from '@/features/shop/ProductCard';
import { colors, duration, ease, radius, space, type } from '@/theme';
import { ArrowIcon } from '@/theme/icons';
import { Press, SheetHeader } from '@/theme/ui';

const PRODUCTS: Product[] = ['postcards', 'zine', 'film', 'print'];

// "make something from this day": every product previewed from the trip, bought through Whop.
export default function ShopScreen() {
  const { id, gift } = useLocalSearchParams<{ id: string; gift?: string }>();
  const trip = useTrip(id);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [giftId, setGiftId] = useState<string | undefined>(gift);
  const giftTo = trip.people.find((p) => p.id === giftId);
  const cardW = width - space.lg * 2;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.lg, gap: space.lg }}
    >
      <SheetHeader eyebrow={trip.title} title="make something from this day" onClose={close} />

      {trip.people.length ? (
        <Section title="send as a gift">
          <FriendPicker people={trip.people} selected={giftId} onSelect={setGiftId} />
          {giftTo ? (
            <Text style={type.caption}>
              {giftTo.name.toLowerCase()} gets it in openhouse the moment whop confirms your payment
            </Text>
          ) : null}
        </Section>
      ) : null}

      {PRODUCTS.map((p, i) => (
        <Animated.View
          key={p}
          entering={reduced ? undefined : FadeInDown.duration(duration.enter).delay(80 + i * 70).easing(ease.out)}
        >
          <ProductCard trip={trip} product={p} width={cardW} giftTo={giftTo} />
        </Animated.View>
      ))}

      <Press
        onPress={() => router.push({ pathname: '/sell/[id]', params: { id: trip.id } })}
        accessibilityRole="button"
        style={styles.sell}
      >
        <TagIcon color={colors.text} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.label}>sell this day as a walkable guide</Text>
          <Text style={type.caption}>set a price, share a link, get paid through whop</Text>
        </View>
        <ArrowIcon color={colors.text} />
      </Press>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.sky,
  },
});
