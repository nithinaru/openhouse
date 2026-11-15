import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCents, type Unavailable } from '@/features/commerce/checkout';
import { PLATFORM_FEE, createListing, useSellerListings } from '@/features/commerce/listings';
import { ComingOnline, Section, Sticker } from '@/features/commerce/ui';
import { collagePhotos, plural } from '@/features/home/tripMeta';
import { useTrip } from '@/features/replay/useTrip';
import { EarningsCard } from '@/features/sell/EarningsCard';
import { PriceSlider } from '@/features/sell/PriceSlider';
import { RouteMini, orderedStops } from '@/features/shop/previews';
import { colors, duration, ease, fonts, radius, space, type } from '@/theme';
import { Button, SheetHeader } from '@/theme/ui';

// Sell this day: publish the trip as a paid walkable guide on Whop, share the link, watch it earn.
export default function SellScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const seller = useSellerListings(id);

  const [title, setTitle] = useState(`${trip.title.toLowerCase()}, walkable`);
  const [price, setPrice] = useState(5);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<{ listingId: string; shareUrl: string } | null>(null);
  const [problem, setProblem] = useState<{ reason: Unavailable; message: string } | null>(null);

  const stops = orderedStops(trip);
  const photos = collagePhotos(trip, 4);
  const keep = Math.round(price * 100 * (1 - PLATFORM_FEE));
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const publish = async () => {
    setPublishing(true);
    setProblem(null);
    const res = await createListing({ tripId: trip.id, title: title || trip.title, priceCents: price * 100 });
    setPublishing(false);
    if (!res.ok) {
      setProblem({ reason: res.reason, message: res.message });
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPublished(res.value);
    seller.refresh();
  };

  const share = (url: string) => void Share.share({ message: `walk my day: ${title} ${url}`, url });

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.lg, gap: space.lg }}
      >
        <SheetHeader eyebrow={trip.title} title="sell this day" onClose={close} />
        <Text style={type.caption}>
          publish your route as a walkable guide. buyers get the replay and can walk it themselves. whop handles the payment and pays you out
        </Text>

        {/* What buyers get */}
        <View style={styles.preview}>
          <View style={styles.photos}>
            {photos.map((p) => (
              <Image key={p.id} source={{ uri: p.uri }} style={styles.photo} contentFit="cover" transition={200} />
            ))}
          </View>
          <Sticker label={`$${price}`} tilt={6} style={styles.priceSticker} />
          <View style={{ padding: space.md, gap: space.sm }}>
            <Text style={type.heading} numberOfLines={2}>
              {title || trip.title}
            </Text>
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <RouteMini trip={trip} width={96} height={56} />
              <View style={{ flex: 1, gap: 2 }}>
                {[
                  `${plural(stops.length, 'stop')}, in order, with times`,
                  'the narrated replay',
                  'directions from stop to stop',
                ].map((l) => (
                  <Text key={l} style={type.caption}>
                    · {l}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        {published ? (
          <Animated.View entering={reduced ? FadeIn : FadeInDown.duration(duration.enter).easing(ease.out)} style={{ gap: space.md }}>
            <View style={styles.live}>
              <Sticker label="live on whop" tilt={-4} />
              <Text style={type.body}>anyone with the link can buy it for ${price}</Text>
              <Text style={styles.link} numberOfLines={1} selectable>
                {published.shareUrl}
              </Text>
              <Button label="share the link" onPress={() => share(published.shareUrl)} />
            </View>
          </Animated.View>
        ) : (
          <>
            <Section title="title">
              <TextInput
                value={title}
                onChangeText={setTitle}
                maxLength={60}
                style={styles.input}
                placeholder={trip.title}
                placeholderTextColor={colors.textFaint}
                returnKeyType="done"
                autoCapitalize="none"
              />
            </Section>

            <Section title="price" right={<Text style={styles.bigPrice}>${price}</Text>}>
              <PriceSlider value={price} onChange={setPrice} />
              <Text style={type.caption}>you keep {formatCents(keep)} a sale after the 10% openhouse fee</Text>
            </Section>

            {problem?.reason === 'soon' ? (
              <ComingOnline what="selling guides" />
            ) : problem ? (
              <Text style={[type.caption, { textAlign: 'center' }]}>{problem.message}</Text>
            ) : null}
            <Button label={`publish · $${price}`} onPress={publish} loading={publishing} />
          </>
        )}

        <EarningsCard seller={seller} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  preview: { borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden' },
  photos: { flexDirection: 'row', height: 110, gap: 2 },
  photo: { flex: 1, backgroundColor: colors.elevated },
  priceSticker: { position: 'absolute', top: space.md, right: space.md },
  input: {
    minHeight: 52,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    fontFamily: fonts.medium,
    fontSize: 17,
    color: colors.text,
  },
  bigPrice: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32, letterSpacing: -1, color: colors.text, fontVariant: ['tabular-nums'] },
  live: { gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.skyHaze },
  link: { ...type.caption, textTransform: 'none', color: colors.text },
});
