// Drop screen pieces: the live counter, the countdown, the edition toggle, the piece rows and
// the "who's wearing it" strip.

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { formatCents } from '@/features/commerce/checkout';
import { LockIcon } from '@/features/commerce/ui';
import { colors, duration, ease, fonts, radius, shadow, space, type } from '@/theme';
import { ChevronRightIcon } from '@/theme/icons';
import { Cutout, Press, Sticker } from '@/theme/ui';

import { PieceArt } from './designs';
import { PIECES, type DropArt, type Edition, type PieceId, type Presence } from './model';

export const MONO_FONT = 'Menlo';

// ---------------------------------------------------------------------------------------------
// Countdown: its own component so the 1 s tick only re-renders this line.

function left(ms: number): string {
  if (ms <= 0) return 'closed';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `closes in ${h}h ${String(m).padStart(2, '0')}m`;
  return `closes in ${m}m ${String(s % 60).padStart(2, '0')}s`;
}

export function Countdown({ closesAt, style }: { closesAt: number; style?: object }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <Text style={[styles.mono, style]}>{left(closesAt - now)}</Text>;
}

// ---------------------------------------------------------------------------------------------
// Live counter + progress bar

export function LiveCounter({
  claimed,
  stock,
  closesAt,
  live,
  edition,
  soldOut,
}: {
  claimed: number;
  stock: number;
  closesAt: number;
  live: boolean;
  edition: Edition;
  soldOut: boolean;
}) {
  const pct = stock > 0 ? Math.min(1, claimed / stock) : 0;
  const fill = useSharedValue(0);
  useEffect(() => {
    // Absolute, childless fill: animating width is safe and keeps the round cap.
    fill.set(withTiming(pct, { duration: duration.slow, easing: ease.out, reduceMotion: ReduceMotion.System }));
  }, [fill, pct]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  return (
    <View style={styles.counter}>
      <View style={styles.counterTop}>
        <Text style={styles.count}>
          {claimed} <Text style={styles.countOf}>of {stock} claimed</Text>
        </Text>
        {live ? (
          <View style={styles.live}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>live</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
      <View style={styles.counterTop}>
        <Text style={type.caption}>
          {soldOut ? 'sold out' : `${stock - claimed} left`} · {edition === 'was_there' ? '“was there” edition' : 'public edition'}
        </Text>
        <Countdown closesAt={closesAt} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Edition toggle

export function CheckIcon({ size = 14, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function EditionToggle({
  edition,
  presence,
  onChange,
}: {
  edition: Edition;
  presence: Presence;
  onChange: (e: Edition) => void;
}) {
  const options: { id: Edition; title: string; detail: string }[] = [
    { id: 'was_there', title: 'was there', detail: 'only for people at the venue' },
    { id: 'public', title: 'public', detail: 'open to anyone' },
  ];
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.toggleRow}>
        {options.map((o) => {
          const on = edition === o.id;
          const locked = o.id === 'was_there' && !presence.qualifies;
          return (
            <Press
              key={o.id}
              onPress={() => !locked && onChange(o.id)}
              disabled={locked}
              haptic="selection"
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled: locked }}
              accessibilityLabel={`${o.title} edition, ${o.detail}`}
              style={[styles.option, on && styles.optionOn, locked && { opacity: 0.5 }]}
            >
              <View style={styles.optionHead}>
                <Text style={[type.label, on && { color: colors.accentInk }]}>{o.title}</Text>
                {locked ? <LockIcon color={on ? colors.accentInk : colors.text} /> : null}
              </View>
              <Text style={[type.caption, on && { color: 'rgba(255,255,255,0.7)' }]}>{o.detail}</Text>
              {o.id === 'was_there' && presence.qualifies ? (
                <Sticker label="verified" small rotate={-4} style={styles.verified} />
              ) : null}
            </Press>
          );
        })}
      </View>
      <View style={styles.reason}>
        {presence.qualifies ? <CheckIcon color={colors.success} /> : <LockIcon color={colors.textMuted} />}
        <Text style={[type.caption, { flex: 1, color: presence.qualifies ? colors.text : colors.textMuted }]}>{presence.reason}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Piece rows

export function PieceRow({
  piece,
  art,
  edition,
  size,
  onPress,
}: {
  piece: PieceId;
  art: DropArt;
  edition: Edition;
  size?: string;
  onPress: () => void;
}) {
  const info = PIECES[piece];
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${info.name}, ${formatCents(info.priceCents)}`} style={styles.row}>
      <View style={styles.thumb}>
        <PieceArt piece={piece} art={art} edition={edition} width={50} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.label} numberOfLines={1}>
          {info.name}
        </Text>
        <Text style={type.caption} numberOfLines={1}>
          {info.sizes ? `size ${size ?? 'm'} · ` : ''}
          {info.blurb.split(' · ')[0]}
        </Text>
      </View>
      <Text style={styles.price}>{formatCents(info.priceCents)}</Text>
      <ChevronRightIcon color={colors.textFaint} />
    </Press>
  );
}

// ---------------------------------------------------------------------------------------------
// Who's wearing it

export type Wearer = { id: string; name: string; uri?: string; aspect: number; tag: string };

export function WearingStrip({ wearers }: { wearers: Wearer[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wearing}>
      {wearers.map((w, i) => {
        const width = 64;
        const height = Math.min(150, Math.max(84, width / (w.aspect || 0.5)));
        return (
          <Cutout
            key={w.id}
            uri={w.uri}
            name={w.name}
            width={width}
            height={height}
            rotate={i % 2 ? 3 : -3}
            tag={w.tag}
            tagRotate={i % 2 ? 4 : -5}
            style={{ width: 110, justifyContent: 'flex-end' }}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mono: { fontFamily: MONO_FONT, fontSize: 12, lineHeight: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  counter: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: space.md, gap: space.sm, ...shadow.chip },
  counterTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  count: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32, letterSpacing: -1, color: colors.text, fontVariant: ['tabular-nums'] },
  countOf: { fontFamily: fonts.medium, fontSize: 17, letterSpacing: -0.3, color: colors.textMuted },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 26, borderRadius: radius.full, backgroundColor: colors.surface },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.pinkEdge },
  liveText: { ...type.stamp, color: colors.text },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 5, backgroundColor: colors.ink },
  toggleRow: { flexDirection: 'row', gap: space.sm },
  option: {
    flex: 1,
    minHeight: 84,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 2,
  },
  optionOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  optionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  verified: { position: 'absolute', top: -12, right: 8 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
  },
  thumb: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.skyHaze, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  price: { fontFamily: fonts.bold, fontSize: 17, letterSpacing: -0.3, color: colors.text, fontVariant: ['tabular-nums'] },
  wearing: { gap: space.xs, paddingVertical: space.md, paddingHorizontal: space.xs, alignItems: 'flex-end' },
});
