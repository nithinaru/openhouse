import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCents } from '@/features/commerce/checkout';
import { Confirmed, PurchaseStatus, Section } from '@/features/commerce/ui';
import { usePurchase } from '@/features/commerce/usePurchase';
import { confirmDropPaid, startDropCheckout, useDrop, type DropItem, type DropPaid } from '@/features/drop/api';
import { PieceArt } from '@/features/drop/designs';
import { FlatLay } from '@/features/drop/FlatLay';
import {
  artFor,
  BUNDLE_CENTS,
  HOST_SHARE,
  PIECE_ORDER,
  PIECES,
  PIECES_TOTAL_CENTS,
  presenceFor,
  venueFor,
  type Edition,
  type PieceId,
} from '@/features/drop/model';
import { EditionToggle, LiveCounter, PieceRow, WearingStrip, type Wearer } from '@/features/drop/parts';
import { PieceSheet } from '@/features/drop/PieceSheet';
import { ShareCardSaver } from '@/features/drop/ShareCard';
import { useTrip } from '@/features/replay/useTrip';
import { colors, duration, ease, fonts, radius, shadow, space, type } from '@/theme';
import { Button, CloseButton, haptic, SkyBackground, Sticker } from '@/theme/ui';

type Rehearsal = 'off' | 'purchased' | 'soldout';
const NEXT: Record<Rehearsal, Rehearsal> = { off: 'purchased', purchased: 'soldout', soldout: 'off' };

const WEAR_TAGS: string[] = ['hoodie · m', 'route tee', 'cutout tote', 'dad cap', 'the pin'];

// The drop: a limited collection designed from the day, sold as a Whop drop. "was there" is
// the edition only people verified at the venue by their own photos can buy.
export default function DropScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  const art = useMemo(() => artFor(trip), [trip]);
  const venue = useMemo(() => venueFor(trip), [trip]);
  const presence = useMemo(() => presenceFor(trip, venue), [trip, venue]);
  const drop = useDrop(trip);
  const purchase = usePurchase<DropPaid>();

  const [editionPick, setEdition] = useState<Edition>('was_there');
  const edition: Edition = presence.qualifies ? editionPick : 'public';
  const [open, setOpen] = useState<PieceId | null>(null);
  const [sizes, setSizes] = useState<Partial<Record<PieceId, string>>>({});
  const [rehearsal, setRehearsal] = useState<Rehearsal>('off');

  const bought = purchase.state.phase === 'done';
  const live = drop.editions.find((e) => e.edition === edition) ?? drop.editions[0];
  const stock = live?.stock ?? 180;
  const soldOut = rehearsal === 'soldout' || (live ? live.claimed >= live.stock : false);
  // A local (pre-backend) drop counts your rehearsal purchase; a live one already includes it.
  const claimed = soldOut ? stock : Math.min(stock, (live?.claimed ?? 0) + (bought && drop.source === 'local' ? 1 : 0));
  const serial = edition === 'was_there' ? `nº ${bought ? claimed : Math.min(stock, claimed + 1)} / ${stock}` : undefined;
  const title = `the drop · ${trip.title.toLowerCase()}`;
  const boardW = width - space.lg * 2;
  const shareW = Math.min(boardW, 360);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const rehearse = () => {
    const next = NEXT[rehearsal];
    haptic('selection');
    setRehearsal(next);
    if (next === 'purchased') purchase.preview({ orderId: 'preview' });
    else purchase.reset();
  };

  const buy = (items: DropItem[]) => {
    setOpen(null);
    void purchase.buy(() => startDropCheckout({ trip, drop, edition, items }), confirmDropPaid);
  };
  const itemFor = (p: PieceId): DropItem => (PIECES[p].sizes ? { piece: p, size: sizes[p] ?? 'm' } : { piece: p });

  const wearers: Wearer[] = [
    ...(bought
      ? [{ id: 'you', name: 'you', aspect: 0.6, tag: edition === 'was_there' ? 'you · was there' : 'you · public' }]
      : []),
    ...art.people.map((p, i) => ({ id: p.id, name: p.name, uri: p.uri, aspect: p.aspect, tag: `@${p.name} · ${WEAR_TAGS[i % WEAR_TAGS.length]}` })),
  ];

  const enter = (i: number) => (reduced ? FadeIn.duration(duration.base) : FadeInDown.duration(duration.enter).delay(60 + i * 60).easing(ease.out));

  return (
    <SkyBackground variant="fade">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.lg, gap: space.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Sticker label={rehearsal === 'off' ? 'limited drop · whop' : `rehearsal · ${rehearsal === 'purchased' ? 'claimed' : 'sold out'}`} small rotate={-4} />
          <CloseButton onPress={close} />
        </View>

        <Animated.View entering={enter(0)}>
          <Pressable onLongPress={rehearse} delayLongPress={700} accessible={false}>
            <Text style={type.display} accessibilityRole="header">
              {title}
            </Text>
          </Pressable>
          <Text style={[type.callout, { color: colors.textMuted, marginTop: space.xs }]}>
            six pieces designed from your day · {art.address} · {art.dateLong}
          </Text>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <LiveCounter claimed={claimed} stock={stock} closesAt={drop.closesAt} live={drop.source === 'live'} edition={edition} soldOut={soldOut} />
        </Animated.View>

        <FlatLay art={art} edition={edition} serial={serial} width={boardW} onOpen={setOpen} />
        <Text style={[type.caption, { textAlign: 'center', marginTop: -space.sm }]}>tap a piece to see it up close</Text>

        <Section title="edition">
          <EditionToggle edition={edition} presence={presence} onChange={setEdition} />
        </Section>

        <Section title="the collection">
          <View style={{ gap: space.xs }}>
            {PIECE_ORDER.map((p) => (
              <PieceRow key={p} piece={p} art={art} edition={edition} size={sizes[p]} onPress={() => setOpen(p)} />
            ))}
          </View>
        </Section>

        <View style={styles.bundle}>
          <View style={styles.bundleArt}>
            {(['hoodie', 'tee', 'cap', 'pin'] as PieceId[]).map((p, i) => (
              <View key={p} style={{ marginLeft: i ? -14 : 0, transform: [{ rotate: `${(i - 1.5) * 6}deg` }] }}>
                <PieceArt piece={p} art={art} edition={edition} width={54} />
              </View>
            ))}
          </View>
          <View style={styles.bundleHead}>
            <Text style={type.heading}>the full drop</Text>
            <Text style={styles.bundlePrice}>
              {formatCents(BUNDLE_CENTS)} <Text style={styles.strike}>{formatCents(PIECES_TOTAL_CENTS)}</Text>
            </Text>
          </View>
          <Text style={type.caption}>
            all six pieces · hoodie {sizes.hoodie ?? 'm'} · tee {sizes.tee ?? 'm'} · change sizes on each piece
          </Text>
          <Button
            label={soldOut ? 'sold out' : `get the full drop · ${formatCents(BUNDLE_CENTS)}`}
            disabled={soldOut}
            loading={purchase.busy && open == null}
            onPress={() => buy(PIECE_ORDER.map(itemFor))}
          />
          {open == null ? <PurchaseStatus purchase={purchase} /> : null}
        </View>

        {purchase.state.phase === 'done' ? (
          <Animated.View entering={FadeIn.duration(duration.base)}>
            <Confirmed
              palette={trip.palette}
              title={edition === 'was_there' ? `you're ${serial}` : 'it’s yours'}
              detail="confirmed by whop"
              next={[
                { label: 'ships in 7–10 days', detail: 'printed after the drop closes, so every run is exact' },
                { label: 'your “i was there” card is ready', detail: 'save it below and post it' },
              ]}
            />
          </Animated.View>
        ) : null}

        <View style={styles.host}>
          <Text style={type.label}>organizer: {art.venueName}</Text>
          <Text style={type.caption}>
            {Math.round(HOST_SHARE * 100)}% to the host · paid out through whop
          </Text>
        </View>

        <Section title="who's wearing it">
          <WearingStrip wearers={wearers} />
        </Section>

        <Section title="your card">
          <ShareCardSaver art={art} edition={edition} serial={serial} width={shareW} />
        </Section>
      </ScrollView>

      <PieceSheet
        piece={open}
        art={art}
        edition={edition}
        serial={serial}
        size={open ? sizes[open] : undefined}
        onSize={(p, s) => setSizes((cur) => ({ ...cur, [p]: s }))}
        onClose={() => setOpen(null)}
        onBuy={(p) => {
          // Let the sheet finish dismissing before the Whop sheet presents.
          setOpen(null);
          setTimeout(() => buy([itemFor(p)]), 450);
        }}
        purchase={purchase}
        soldOut={soldOut}
      />
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bundle: { backgroundColor: colors.bg, borderRadius: radius.xl, padding: space.md, gap: space.sm, ...shadow.chip },
  bundleArt: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingVertical: space.sm },
  bundleHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  bundlePrice: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.5, color: colors.text },
  strike: { fontFamily: fonts.medium, fontSize: 15, color: colors.textFaint, textDecorationLine: 'line-through' },
  host: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
});
