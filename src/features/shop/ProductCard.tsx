// One product in the shop: a live preview, variants, price, and its own Whop purchase flow.

import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import {
  PRODUCTS,
  formatCents,
  getOrder,
  pollUntil,
  priceCents,
  startCheckout,
  waitForOrder,
  type Order,
  type Product,
} from '@/features/commerce/checkout';
import { Confirmed, PurchaseStatus, type NextStep } from '@/features/commerce/ui';
import { usePurchase } from '@/features/commerce/usePurchase';
import type { Moment, Person, Trip } from '@/lib/types';
import { colors, duration, ease, radius, space, type } from '@/theme';
import { ArrowIcon } from '@/theme/icons';
import { Button, Chip } from '@/theme/ui';

import { FilmPreview, PostcardPreview, PrintPreview, ZinePreview, orderedStops } from './previews';

const BLURB: Record<Product, (trip: Trip) => string> = {
  print: () => 'the whole day as a poster, framed in oak, sent to your door',
  postcards: (t) => `${Math.min(8, Math.max(1, t.moments.length))} cards, one per stop. photo on the front, the narration, time and route on the back`,
  zine: (t) => `a cover and one page per stop, ${t.moments.length} pages of your day`,
  film: () => 'the replay with narration, as a video file you keep',
};

type Props = {
  trip: Trip;
  product: Product;
  width: number;
  giftTo?: Person;
  /** A single stop (gifting "lunch on 3rd st"). */
  moment?: Moment;
  /** Rehearsal: long-press the title to preview the confirmed state. */
  allowPreview?: boolean;
};

export function ProductCard({ trip, product, width, giftTo, moment, allowPreview = true }: Props) {
  const info = PRODUCTS[product];
  const reduced = useReducedMotion();
  const [variant, setVariant] = useState<string | undefined>(info.variants?.[0]?.id);
  const purchase = usePurchase<Order>();
  const price = priceCents(product, variant);
  const inner = width - space.md * 2 - space.sm * 2;

  // Digital goods: keep polling after paid until the download link exists.
  const done = purchase.state.phase === 'done' ? purchase.state : null;
  const [download, setDownload] = useState<string | null>(null);
  useEffect(() => {
    if (!done || done.value.downloadUrl || info.ships(variant) || done.checkout.orderId === 'preview') return;
    const ctl = new AbortController();
    void pollUntil(async () => (await getOrder(done.checkout.orderId))?.downloadUrl, { timeoutMs: 180_000, everyMs: 3000, signal: ctl.signal }).then(
      (url) => url && setDownload(url),
    );
    return () => ctl.abort();
  }, [done, info, variant]);

  const buy = () =>
    purchase.buy(
      () =>
        startCheckout({
          product,
          tripId: trip.id,
          variant,
          momentId: moment?.id,
          giftToShareCode: giftTo?.shareCode,
        }),
      (c, signal) => waitForOrder(c.orderId, { signal }),
    );

  const preview: ReactNode =
    product === 'print' ? (
      <PrintPreview trip={trip} width={Math.min(150, inner * 0.46)} />
    ) : product === 'postcards' ? (
      <PostcardPreview trip={trip} moment={moment} width={inner} />
    ) : product === 'zine' ? (
      <ZinePreview trip={trip} width={inner} />
    ) : (
      <FilmPreview trip={trip} width={inner} />
    );

  const label = giftTo ? `gift ${giftTo.name.toLowerCase()} · ${formatCents(price)}` : `buy · ${formatCents(price)}`;

  return (
    <Animated.View layout={reduced ? undefined : LinearTransition.duration(duration.base).easing(ease.out)} style={[styles.card, { width }]}>
      <View style={[styles.preview, product === 'print' && { alignItems: 'center', paddingVertical: space.md }]}>{preview}</View>

      <View style={styles.head}>
        <Text
          style={[type.heading, { flex: 1 }]}
          onLongPress={
            allowPreview
              ? () =>
                  purchase.preview({
                    status: 'paid',
                    product,
                    variant: variant ?? null,
                    shipsInDays: info.ships(variant),
                    downloadUrl: null,
                    giftTo: giftTo ? { name: giftTo.name } : null,
                  })
              : undefined
          }
          suppressHighlighting
        >
          {info.name}
        </Text>
        <Text style={styles.price}>{formatCents(price)}</Text>
      </View>
      <Text style={type.caption}>{BLURB[product](trip)}</Text>

      {info.variants && product !== 'print' ? (
        <View style={styles.variants}>
          {info.variants.map((v) => (
            <Chip
              key={v.id}
              label={`${v.label} · ${formatCents(priceCents(product, v.id))}`}
              tone={v.id === variant ? 'accent' : 'default'}
              onPress={purchase.busy || done ? undefined : () => setVariant(v.id)}
            />
          ))}
        </View>
      ) : null}

      {done ? (
        <Animated.View entering={FadeIn.duration(duration.base)}>
          <Confirmed
            palette={trip.palette}
            detail={`${info.name}${variant && product !== 'print' ? ` · ${variant}` : ''} · paid with whop`}
            next={nextSteps(product, done.value, variant, download, giftTo, moment, trip)}
          />
        </Animated.View>
      ) : product === 'print' ? (
        <Button
          variant="secondary"
          label={giftTo ? `frame one for ${giftTo.name.toLowerCase()}` : 'choose a frame'}
          onPress={() => router.push({ pathname: '/frame/[id]', params: { id: trip.id } })}
          trailing={<ArrowIcon color={colors.text} />}
        />
      ) : (
        <Button label={label} onPress={buy} loading={purchase.busy} />
      )}

      <PurchaseStatus purchase={purchase} />
    </Animated.View>
  );
}

function nextSteps(
  product: Product,
  order: Order,
  variant: string | undefined,
  download: string | null,
  giftTo: Person | undefined,
  moment: Moment | undefined,
  trip: Trip,
): NextStep[] {
  const steps: NextStep[] = [];
  const ships = order.shipsInDays ?? PRODUCTS[product].ships(variant);
  const name = giftTo?.name.toLowerCase();
  if (giftTo) {
    steps.push({ label: `${name} sees it on their home screen`, detail: `a gift from you, of ${(moment?.placeName ?? trip.title).toLowerCase()}` });
  }
  if (ships) {
    steps.push({
      label: `ships in ${ships[0]}–${ships[1]} days`,
      detail: giftTo ? `we ask ${name} where to send it` : 'tracking arrives by email from whop',
    });
  } else {
    const url = order.downloadUrl ?? download;
    steps.push(
      url
        ? { label: product === 'film' ? 'your film is ready' : 'your zine is ready', detail: 'download link below', url }
        : {
            label: product === 'film' ? 'rendering your film' : 'laying out your zine',
            detail: 'the download link appears here when it is ready',
          },
    );
  }
  return steps;
}

export function FriendPicker({
  people,
  selected,
  onSelect,
}: {
  people: Person[];
  selected?: string;
  onSelect: (id: string | undefined) => void;
}) {
  if (!people.length) return null;
  return (
    <View style={styles.variants}>
      <Chip label="for me" tone={!selected ? 'accent' : 'default'} onPress={() => onSelect(undefined)} />
      {people.map((p) => (
        <Chip key={p.id} label={`gift ${p.name.toLowerCase()}`} tone={selected === p.id ? 'accent' : 'default'} onPress={() => onSelect(p.id)} />
      ))}
    </View>
  );
}

export const stopsOf = orderedStops;

const styles = StyleSheet.create({
  card: {
    padding: space.md,
    gap: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  preview: { borderRadius: radius.md, backgroundColor: colors.skyHaze, padding: space.sm, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.xs },
  price: { ...type.label, fontVariant: ['tabular-nums'] },
  variants: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
