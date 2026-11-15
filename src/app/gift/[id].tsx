import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCents, priceCents, type Product } from '@/features/commerce/checkout';
import { Section, Sticker } from '@/features/commerce/ui';
import { useMoment } from '@/features/replay/useTrip';
import { ProductCard } from '@/features/shop/ProductCard';
import { colors, space, type } from '@/theme';
import { Button, Chip, SheetHeader } from '@/theme/ui';

const GIFTABLE: Product[] = ['postcards', 'print', 'film'];

// "gift rohan this": one stop shared with a friend, sent to them as something real.
// Route id = the stop (moment) id; params: tripId, to (person id).
export default function GiftScreen() {
  const { id, tripId, to } = useLocalSearchParams<{ id: string; tripId?: string; to?: string }>();
  const { trip, moment } = useMoment(id, tripId);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [product, setProduct] = useState<Product>('postcards');

  const friend =
    trip.people.find((p) => p.id === to) ??
    trip.people.find((p) => trip.theirAngles?.[id ?? '']?.some((ph) => ph.userId === p.id)) ??
    trip.people[0];
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!friend || !moment) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.lg, paddingTop: insets.top + space.lg, gap: space.md }}>
        <SheetHeader title="gift this" onClose={close} />
        <Text style={type.body}>pair with a friend at this stop to send them something from it</Text>
        <Button variant="secondary" label="pair with a friend" onPress={() => router.push('/people')} />
      </View>
    );
  }

  const name = friend.name.toLowerCase();
  const place = (moment.placeName ?? 'this stop').toLowerCase();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.lg, gap: space.lg }}
    >
      <SheetHeader eyebrow={place} title={`gift ${name} this`} onClose={close} />
      <Sticker label={`you + ${name} were both here`} tilt={-3} />

      <Section title="what to send">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {GIFTABLE.map((p) => (
            <Chip
              key={p}
              label={`${p === 'postcards' ? 'postcards' : p} · ${formatCents(priceCents(p))}`}
              tone={p === product ? 'accent' : 'default'}
              onPress={() => setProduct(p)}
            />
          ))}
        </View>
      </Section>

      <ProductCard key={product} trip={trip} product={product} width={width - space.lg * 2} giftTo={friend} moment={moment} />

      <Text style={[type.caption, { textAlign: 'center' }]}>
        {name} sees “you sent them a {product === 'postcards' ? 'postcard pack' : product} of {place}” on their home screen
      </Text>
    </ScrollView>
  );
}
