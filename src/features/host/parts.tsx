// Host dashboard pieces: stat tiles that count up, sell-through bars, the live payments feed,
// the fee balance + payout card, and the "powered by whop" source list.

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { formatCents } from '@/features/commerce/checkout';
import { colors, duration, ease, fonts, radius, shadow, space, type } from '@/theme';
import { Button, Cutout, formatClock, Sticker } from '@/theme/ui';

import { faceFor, HOST_FEE, HOST_NAME, type HostSale, type HostStats, type Payout } from './api';

// ---------------------------------------------------------------------------------------------
// Count-up: tweens a number toward its target on the JS thread (a few frames, text only).

function useTween(target: number, ms = 700): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    const start = shownRef.current;
    if (start === target) return;
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const p = reduced ? 1 : Math.min(1, (Date.now() - t0) / ms);
      const k = 1 - Math.pow(1 - p, 3);
      shownRef.current = Math.round(start + (target - start) * k);
      setShown(shownRef.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduced]);

  return shown;
}

/** "$12,480" for big money, cents kept when small. */
export function money(cents: number): string {
  if (cents >= 100_000) return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
  return formatCents(cents);
}

// ---------------------------------------------------------------------------------------------
// Stat tiles

export function StatTile({ label, value, format = String, big }: { label: string; value: number; format?: (n: number) => string; big?: boolean }) {
  const n = useTween(value);
  return (
    <View style={[styles.tile, big && styles.tileBig]} accessible accessibilityLabel={`${label}: ${format(value)}`}>
      <Text style={type.caption}>{label}</Text>
      <Text style={[styles.tileValue, big && styles.tileValueBig]} numberOfLines={1} adjustsFontSizeToFit>
        {format(n)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Sell-through bars

const EDITION_LABEL = { was_there: 'was there', public: 'public' } as const;

function StockBar({ edition, stock, claimed }: { edition: 'was_there' | 'public'; stock: number; claimed: number }) {
  const pct = stock > 0 ? Math.min(1, claimed / stock) : 0;
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withTiming(pct, { duration: duration.slow, easing: ease.out, reduceMotion: ReduceMotion.System }));
  }, [fill, pct]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));
  const n = useTween(claimed);
  const wasThere = edition === 'was_there';
  return (
    <View style={{ gap: space.xs }} accessible accessibilityLabel={`${EDITION_LABEL[edition]}: ${claimed} of ${stock} sold`}>
      <View style={styles.barHead}>
        {wasThere ? <Sticker label="was there" small rotate={-3} /> : <Text style={type.label}>public</Text>}
        <Text style={styles.barCount}>
          {n} <Text style={styles.barOf}>/ {stock} · {Math.round(pct * 100)}%</Text>
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, wasThere ? styles.fillPink : styles.fillInk, fillStyle]} />
      </View>
    </View>
  );
}

export function SellThrough({ editions }: { editions: HostStats['drop']['editions'] }) {
  const order = ['was_there', 'public'] as const;
  const sorted = order.map((e) => editions.find((x) => x.edition === e)).filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <View style={styles.card}>
      <Text style={type.heading}>the drop · sell-through</Text>
      <Text style={type.caption}>limited runs, one whop plan per edition</Text>
      <View style={{ gap: space.md, marginTop: space.sm }}>
        {sorted.map((e) => (
          <StockBar key={e.edition} edition={e.edition} stock={e.stock} claimed={e.claimed} />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Live feed

function ago(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return formatClock(at);
}

function useNow(everyMs = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

function FeedRow({ sale, index, now }: { sale: HostSale; index: number; now: number }) {
  const reduced = useReducedMotion();
  const line = `${sale.who} bought ${sale.item}${sale.edition ? ` · ${EDITION_LABEL[sale.edition]}` : ''} · ${formatCents(sale.amountCents)}`;
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(duration.enter).easing(ease.out)}
      layout={reduced ? undefined : LinearTransition.duration(duration.base).easing(ease.out)}
      style={styles.row}
      accessible
      accessibilityLabel={`${line}, ${ago(sale.at, now)}`}
    >
      <Cutout uri={faceFor(sale.who)} name={sale.who} width={40} height={48} rotate={index % 2 ? 3 : -3} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.label} numberOfLines={2}>
          {sale.who} bought {sale.item}
        </Text>
        <View style={styles.rowMeta}>
          {sale.edition === 'was_there' ? <Text style={styles.wasThere}>was there</Text> : sale.edition ? <Text style={type.caption}>public</Text> : null}
          <Text style={type.stamp}>{ago(sale.at, now)}</Text>
        </View>
      </View>
      <Text style={styles.amount}>{formatCents(sale.amountCents)}</Text>
    </Animated.View>
  );
}

export function LiveFeed({ recent, live }: { recent: HostSale[]; live: boolean }) {
  const now = useNow();
  return (
    <View style={styles.card}>
      <View style={styles.feedHead}>
        <Text style={[type.heading, { flex: 1 }]}>recent payments</Text>
        <View style={styles.liveChip}>
          <View style={[styles.liveDot, !live && { backgroundColor: colors.textFaint }]} />
          <Text style={styles.liveText}>{live ? 'live' : 'preview'}</Text>
        </View>
      </View>
      {recent.length ? (
        <View style={{ gap: space.xs, marginTop: space.xs }}>
          {recent.slice(0, 8).map((s, i) => (
            <FeedRow key={s.key} sale={s} index={i} now={now} />
          ))}
        </View>
      ) : (
        <Text style={[type.caption, { marginTop: space.sm }]}>no payments yet. they show up here the second whop confirms them</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Fee balance + payout

export function PayoutCard({
  balanceCents,
  busy,
  last,
  error,
  onPayout,
  viaWhop,
}: {
  viaWhop?: boolean;
  balanceCents: number;
  busy: boolean;
  last: Payout | null;
  error: string | null;
  onPayout: () => void;
}) {
  const n = useTween(balanceCents);
  return (
    <View style={[styles.card, styles.payout]}>
      <Text style={[type.caption, styles.onInk]}>your {Math.round(HOST_FEE * 100)}% · balance on whop</Text>
      <Text style={[styles.tileValueBig, styles.onInk]}>{money(n)}</Text>
      <Button
        variant="secondary"
        label={balanceCents > 0 ? (viaWhop ? `payout via whop · ${money(balanceCents)}` : `payout to ${HOST_NAME} · ${money(balanceCents)}`) : 'nothing to pay out yet'}
        disabled={balanceCents <= 0}
        loading={busy}
        onPress={onPayout}
        style={{ marginTop: space.sm }}
      />
      {last ? (
        <Text style={[type.caption, styles.onInk, { textAlign: 'center' }]}>
          {last.preview
            ? `preview · would send ${money(last.amountCents)} to ${HOST_NAME}. no money moved`
            : `sent ${money(last.amountCents)} to ${HOST_NAME} · whop transfer ${last.transferId}`}
        </Text>
      ) : null}
      {error ? <Text style={[type.caption, { color: colors.pink, textAlign: 'center' }]}>{error}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Powered by whop

const SOURCES: { what: string; from: string }[] = [
  { what: 'gross revenue · orders · feed', from: 'payments (payment.succeeded webhook, payments.list)' },
  { what: 'members', from: 'memberships (plus renewal plan)' },
  { what: 'sell-through', from: 'plans with stock (one per edition, unlimited_stock: false)' },
  { what: 'fee balance · payout', from: 'transfers (transfers.create) · ledgerAccounts balance' },
];

export function PoweredByWhop() {
  return (
    <View style={styles.powered}>
      <Text style={type.label}>powered by whop</Text>
      {SOURCES.map((s) => (
        <View key={s.what} style={styles.sourceRow}>
          <Text style={[type.caption, { color: colors.text, flex: 1 }]}>{s.what}</Text>
          <Text style={[type.caption, { flex: 1.4, textAlign: 'right' }]}>{s.from}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.lg, padding: space.md, gap: space.xs, ...shadow.chip },
  tileBig: { flexBasis: '100%' },
  tileValue: { fontFamily: fonts.bold, fontSize: 26, letterSpacing: -0.8, color: colors.text, fontVariant: ['tabular-nums'] },
  tileValueBig: { fontFamily: fonts.bold, fontSize: 44, lineHeight: 48, letterSpacing: -1.6, color: colors.text, fontVariant: ['tabular-nums'] },
  card: { backgroundColor: colors.bg, borderRadius: radius.xl, padding: space.md, gap: space.xs, ...shadow.chip },
  barHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  barCount: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, fontVariant: ['tabular-nums'] },
  barOf: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  track: { height: 12, borderRadius: radius.full, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.full },
  fillPink: { backgroundColor: colors.pinkEdge },
  fillInk: { backgroundColor: colors.ink },
  feedHead: { flexDirection: 'row', alignItems: 'center' },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 26, borderRadius: radius.full, backgroundColor: colors.surface },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  liveText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text, textTransform: 'lowercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  wasThere: { fontFamily: fonts.semibold, fontSize: 12, color: colors.pinkEdge, textTransform: 'lowercase' },
  amount: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, fontVariant: ['tabular-nums'] },
  payout: { backgroundColor: colors.ink },
  onInk: { color: colors.accentInk },
  powered: { gap: space.xs, paddingHorizontal: space.xs, paddingTop: space.sm },
  sourceRow: { flexDirection: 'row', gap: space.md, paddingVertical: 2 },
});
