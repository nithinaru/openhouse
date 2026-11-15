import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';

import { formatCents, type Product } from '@/features/commerce/checkout';
import { Confirmed, PurchaseStatus, Section, TagIcon } from '@/features/commerce/ui';
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
import { EditionToggle, LiveCounter } from '@/features/drop/parts';
import { PieceSheet } from '@/features/drop/PieceSheet';
import { discounted, PROMO_PERCENT_OFF, useReferral } from '@/features/drop/promo';
import { FriendCodes, PromoField, ReferralCard } from '@/features/drop/PromoParts';
import { useTrip } from '@/features/replay/useTrip';
import { FriendPicker, ProductCard } from '@/features/shop/ProductCard';
import { colors, duration, ease, fonts, radius, shadow, space, type } from '@/theme';
import { ArrowIcon } from '@/theme/icons';
import { Button, Chip, haptic, Press, SheetHeader, SkyBackground, Sticker } from '@/theme/ui';

const WHOP_URL = 'https://sandbox.whop.com/yc-hack/';
const openWhop = () => void WebBrowser.openBrowserAsync(WHOP_URL).catch(() => {});

const PRODUCTS: Product[] = ['print', 'postcards', 'zine', 'film'];

type Rehearsal = 'off' | 'purchased' | 'soldout';
const NEXT: Record<Rehearsal, Rehearsal> = { off: 'purchased', purchased: 'soldout', soldout: 'off' };

// "make something from this day": one storefront. The limited "was there" drop leads,
// then the simple things (print, postcards, zine, film). Everything checks out through Whop.
export default function ShopScreen() {
  const { id, gift, ref } = useLocalSearchParams<{ id: string; gift?: string; ref?: string }>();
  const trip = useTrip(id);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const boardW = width - space.lg * 2;

  // --- the drop (wiring copied from app/drop/[id].tsx) ---
  const art = useMemo(() => artFor(trip), [trip]);
  const venue = useMemo(() => venueFor(trip), [trip]);
  const presence = useMemo(() => presenceFor(trip, venue), [trip, venue]);
  const drop = useDrop(trip);
  const referral = useReferral({ tripId: trip.id, dropId: drop.dropId, bundleCents: BUNDLE_CENTS });
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const bundleCents = promoCode ? discounted(BUNDLE_CENTS, PROMO_PERCENT_OFF) : BUNDLE_CENTS;
  const purchase = usePurchase<DropPaid>();

  const [editionPick, setEdition] = useState<Edition>('was_there');
  const edition: Edition = presence.qualifies ? editionPick : 'public';
  const [open, setOpen] = useState<PieceId | null>(null);
  const [sizes, setSizes] = useState<Partial<Record<PieceId, string>>>({});
  const [rehearsal, setRehearsal] = useState<Rehearsal>('off');
  const [waitlisted, setWaitlisted] = useState(false);

  const bought = purchase.state.phase === 'done';
  const live = drop.editions.find((e) => e.edition === edition) ?? drop.editions[0];
  const stock = live?.stock ?? 180;
  const soldOut = rehearsal === 'soldout' || (live ? live.claimed >= live.stock : false);
  const claimed = soldOut ? stock : Math.min(stock, (live?.claimed ?? 0) + (bought && drop.source === 'local' ? 1 : 0));
  const serial = edition === 'was_there' ? `nº ${bought ? claimed : Math.min(stock, claimed + 1)} / ${stock}` : undefined;

  // --- gifting (as before) ---
  const [giftId, setGiftId] = useState<string | undefined>(gift);
  const giftTo = trip.people.find((p) => p.id === giftId);

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
    void purchase.buy(
      () => startDropCheckout({ trip, drop, edition, items, promoCode, referralCode: typeof ref === 'string' ? ref : null }),
      confirmDropPaid,
    );
  };
  const itemFor = (p: PieceId): DropItem => (PIECES[p].sizes ? { piece: p, size: sizes[p] ?? 'm' } : { piece: p });

  const enter = (i: number) =>
    reduced ? FadeIn.duration(duration.base) : FadeInDown.duration(duration.enter).delay(60 + i * 60).easing(ease.out);

  return (
    <SkyBackground variant="fade">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.lg, gap: space.lg }}
        showsVerticalScrollIndicator={false}
      >
        <SheetHeader eyebrow={trip.title} title="make something from this day" onClose={close} />

        <Animated.View entering={enter(0)} style={{ gap: space.sm }}>
          <Sticker
            label={rehearsal === 'off' ? 'limited drop · whop' : `rehearsal · ${rehearsal === 'purchased' ? 'claimed' : 'sold out'}`}
            small
            rotate={-4}
            style={{ alignSelf: 'flex-start' }}
          />
          <Pressable onLongPress={rehearse} delayLongPress={700} accessible={false}>
            <Text style={type.title} accessibilityRole="header">
              the drop · was there
            </Text>
          </Pressable>
          <Text style={[type.callout, { color: colors.textMuted }]}>
            six pieces designed from your day · {art.address} · {art.dateLong}
          </Text>
          <Chip label="view on whop ↗" onPress={openWhop} style={{ alignSelf: 'flex-start' }} />
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <LiveCounter claimed={claimed} stock={stock} closesAt={drop.closesAt} live={drop.source === 'live'} edition={edition} soldOut={soldOut} />
        </Animated.View>

        <FlatLay art={art} edition={edition} serial={serial} width={boardW} onOpen={setOpen} />
        <Text style={[type.caption, { textAlign: 'center', marginTop: -space.sm }]}>tap a piece to see it up close</Text>

        <Section title="edition">
          <EditionToggle edition={edition} presence={presence} onChange={setEdition} />
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
              {formatCents(bundleCents)} <Text style={styles.strike}>{formatCents(promoCode ? BUNDLE_CENTS : PIECES_TOTAL_CENTS)}</Text>
            </Text>
          </View>
          <Text style={type.caption}>
            all six pieces · hoodie {sizes.hoodie ?? 'm'} · tee {sizes.tee ?? 'm'} · change sizes on each piece
          </Text>
          <PromoField applied={promoCode} onApply={setPromoCode} onClear={() => setPromoCode(null)} />
          {soldOut ? (
            waitlisted ? (
              <Animated.View entering={FadeIn.duration(duration.base)} style={styles.waitlist}>
                <Sticker label="you're on the list · #14" rotate={-3} />
              </Animated.View>
            ) : (
              <Button
                label="join the waitlist"
                onPress={() => {
                  haptic('medium');
                  setWaitlisted(true);
                }}
              />
            )
          ) : (
            <Button
              label={`get the full drop · ${formatCents(bundleCents)}`}
              loading={purchase.busy && open == null}
              onPress={() => buy(PIECE_ORDER.map(itemFor))}
            />
          )}
          {soldOut ? (
            <Text style={[type.caption, { textAlign: 'center' }]}>{"whop waitlist · we'll text you if a hoodie frees up"}</Text>
          ) : null}
          {open == null ? <PurchaseStatus purchase={purchase} /> : null}
        </View>

        {bought ? (
          <Animated.View entering={FadeIn.duration(duration.base)}>
            <Confirmed
              palette={trip.palette}
              title={edition === 'was_there' ? `you're ${serial}` : 'it’s yours'}
              detail="confirmed by whop"
              next={[{ label: 'ships in 7–10 days', detail: 'printed after the drop closes, so every run is exact' }]}
            />
          </Animated.View>
        ) : null}

        <FriendCodes
          friends={trip.people.map((p) => ({ name: p.name, shareCode: p.shareCode, avatarUri: p.avatarUri }))}
          dropId={drop.dropId}
          tripId={trip.id}
          onUse={setPromoCode}
        />

        <ReferralCard referral={referral} />

        <View style={styles.divider} accessibilityRole="header">
          <View style={styles.rule} />
          <Text style={type.caption}>or keep it simple</Text>
          <View style={styles.rule} />
        </View>

        {trip.people.length ? (
          <Section title="send as a gift">
            <FriendPicker people={trip.people} selected={giftId} onSelect={setGiftId} />
            {giftTo ? (
              <Text style={type.caption}>
                {giftTo.name.toLowerCase()} gets it in wish you were here the moment whop confirms your payment
              </Text>
            ) : null}
          </Section>
        ) : null}

        {PRODUCTS.map((p) => (
          <ProductCard key={p} trip={trip} product={p} width={boardW} giftTo={giftTo} />
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

        <View style={styles.host}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={type.label}>organizer: {art.venueName}</Text>
            <Text style={type.caption}>{Math.round(HOST_SHARE * 100)}% of the drop to the host · paid out through whop</Text>
          </View>
          <Button variant="quiet" label="host view" onPress={() => router.push('/host')} accessibilityHint="opens the organizer dashboard" />
        </View>
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
  bundle: { backgroundColor: colors.bg, borderRadius: radius.xl, padding: space.md, gap: space.sm, ...shadow.chip },
  bundleArt: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingVertical: space.sm },
  bundleHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  bundlePrice: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.5, color: colors.text },
  strike: { fontFamily: fonts.medium, fontSize: 15, color: colors.textFaint, textDecorationLine: 'line-through' },
  waitlist: { alignItems: 'center', paddingVertical: space.sm },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.lineStrong },
  sell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.sky,
  },
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
