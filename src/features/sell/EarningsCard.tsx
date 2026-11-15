// Seller dashboard: total earnings on a rolling odometer, sales count, one row per guide.
// Polls listings:forSeller (via useSellerListings); every new sale rolls the digits, pops a
// pink "+$4.50" sticker and lands one success haptic. Long-press the title to rehearse a sale.

import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { formatCents } from '@/features/commerce/checkout';
import type { SellerState } from '@/features/commerce/listings';
import { ComingOnline, Sticker } from '@/features/commerce/ui';
import { colors, ease, fonts, radius, space, type } from '@/theme';
import { Chip } from '@/theme/ui';

const DIGIT_H = 52;

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function Digit({ value, reduced }: { value: number; reduced: boolean }) {
  const y = useSharedValue(-value * DIGIT_H);
  useEffect(() => {
    y.set(withTiming(-value * DIGIT_H, { duration: reduced ? 0 : 900, easing: ease.out }));
  }, [reduced, value, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <View style={styles.digitWindow}>
      <Animated.View style={style}>
        {Array.from({ length: 10 }, (_, i) => (
          <Text key={i} style={styles.big}>
            {i}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

/** "$12.60" with each digit on its own rolling strip. Keys count from the right so cents stay put. */
export function Odometer({ cents }: { cents: number }) {
  const reduced = useReducedMotion();
  const chars = `$${dollars(cents)}`.split('');
  return (
    <View style={{ flexDirection: 'row' }} accessible accessibilityLabel={`earned ${formatCents(cents)}`}>
      {chars.map((c, i) => {
        const key = chars.length - i;
        return /\d/.test(c) ? <Digit key={key} value={Number(c)} reduced={reduced} /> : <Text key={key} style={styles.big}>{c}</Text>;
      })}
    </View>
  );
}

export function EarningsCard({ seller, compact }: { seller: SellerState; compact?: boolean }) {
  const reduced = useReducedMotion();
  const total = seller.listings.reduce((s, l) => s + l.earningsCents, 0);
  const sales = seller.listings.reduce((s, l) => s + l.sales, 0);

  // A sale landed: pop "+$x" and bump the card.
  const prev = useRef<number | null>(null);
  const [pop, setPop] = useState<{ id: number; cents: number } | null>(null);
  const bump = useSharedValue(1);
  useEffect(() => {
    const before = prev.current;
    prev.current = total;
    if (before === null || total <= before) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPop({ id: Date.now(), cents: total - before });
    if (!reduced) bump.set(withSequence(withTiming(1.03, { duration: 120, easing: ease.out }), withTiming(1, { duration: 320, easing: ease.out })));
  }, [bump, reduced, total]);
  useEffect(() => {
    if (!pop) return;
    const t = setTimeout(() => setPop(null), 1800);
    return () => clearTimeout(t);
  }, [pop]);
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.get() }] }));

  if (seller.status === 'soon' && !seller.listings.length) {
    return (
      <View style={styles.card}>
        <Text style={type.heading} onLongPress={() => seller.simulateSale()} suppressHighlighting>
          your guides
        </Text>
        <ComingOnline what="guide sales" />
      </View>
    );
  }
  if (!seller.listings.length) return null;

  return (
    <Animated.View style={[styles.card, bumpStyle]}>
      <View style={styles.head}>
        <Text style={type.caption} onLongPress={() => seller.simulateSale()} suppressHighlighting>
          earned selling your days
        </Text>
        <View style={styles.live}>
          <View style={[styles.liveDot, seller.status !== 'live' && { backgroundColor: colors.textFaint }]} />
          <Text style={type.caption}>{seller.status === 'live' ? 'live' : 'reconnecting'}</Text>
        </View>
      </View>

      <View style={styles.totalRow}>
        <Odometer cents={total} />
        {pop ? (
          <Animated.View key={pop.id} entering={reduced ? FadeIn : ZoomIn.springify().duration(400).dampingRatio(0.6)} exiting={FadeOut.duration(300)}>
            <Sticker label={`+${formatCents(pop.cents)}`} tilt={-8} />
          </Animated.View>
        ) : null}
      </View>
      <Text style={type.caption}>
        {sales} {sales === 1 ? 'sale' : 'sales'} · paid out through whop
      </Text>

      {!compact
        ? seller.listings.map((l) => (
            <View key={l.listingId} style={styles.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.label} numberOfLines={1}>
                  {l.title}
                </Text>
                <Text style={type.caption}>
                  {formatCents(l.priceCents)} · {l.sales} {l.sales === 1 ? 'buyer' : 'buyers'} · {formatCents(l.earningsCents)}
                </Text>
              </View>
              <Chip label="share" onPress={() => void Share.share({ message: `walk my day: ${l.title} ${l.shareUrl}`, url: l.shareUrl })} />
            </View>
          ))
        : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md, gap: space.sm, borderRadius: radius.lg, backgroundColor: colors.sky },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: DIGIT_H },
  digitWindow: { height: DIGIT_H, overflow: 'hidden' },
  big: {
    fontFamily: fonts.bold,
    fontSize: 46,
    lineHeight: DIGIT_H,
    height: DIGIT_H,
    letterSpacing: -1.5,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    paddingLeft: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
});
