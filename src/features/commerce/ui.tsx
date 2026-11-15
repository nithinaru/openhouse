// Small pieces every commerce surface shares: icons, the pink sticker, the soft plus lock,
// the confirmed card with what happens next, and the status line under a buy button.
// Tokens only, so the theme re-skin carries through.

import type { ReactNode } from 'react';
import { Linking, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { OrderConfirmed } from '@/features/poster/OrderConfirmed';
import { colors, duration, ease, radius, space, type } from '@/theme';
import { Button, Sticker as ThemeSticker } from '@/theme/ui';

import type { Purchase } from './usePurchase';
import { phaseLine } from './usePurchase';

// ---------------------------------------------------------------------------------------------
// Icons (same grid and stroke as src/theme/icons.tsx)

type IconProps = { size?: number; color: string };
const base = (size: number, color: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color,
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function LockIcon({ size = 14, color }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Rect x={5} y={11} width={14} height={9} rx={2} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function GiftIcon({ size = 18, color }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Rect x={4} y={9} width={16} height={11} rx={1.5} />
      <Path d="M3 9h18M12 9v11M12 9c-1.5-3-5-3.5-5-1.2C7 9 9.5 9 12 9zm0 0c1.5-3 5-3.5 5-1.2C17 9 14.5 9 12 9z" />
    </Svg>
  );
}

export function BagIcon({ size = 18, color }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M5 8h14l-1 12H6L5 8z" />
      <Path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </Svg>
  );
}

export function TagIcon({ size = 18, color }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M3 12V4h8l10 10-8 8L3 12z" />
      <Path d="M7.5 7.5h.01" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------------------------
// Sticker: the pink tag, slapped on a little crooked.

/** The theme's sticker; `tilt` kept as the commerce-side name for its rotation. */
export function Sticker({ label, tilt = -4, style }: { label: string; tilt?: number; style?: StyleProp<ViewStyle> }) {
  return <ThemeSticker label={label} rotate={tilt} style={[{ alignSelf: 'flex-start' }, style]} />;
}

/** Soft lock: a small "plus" sticker with a lock, tappable to the paywall. */
export function PlusLock({ onPress, label = 'plus', style }: { onPress?: () => void; label?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <ThemeSticker
      small
      rotate={-3}
      label={label}
      icon={<LockIcon size={12} color={colors.text} />}
      onPress={onPress}
      accessibilityLabel="unlock with openhouse plus"
      style={style}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Confirmed: the celebration plus concrete next steps.

export type NextStep = { label: string; detail?: string; url?: string | null };

export function Confirmed({ palette, title, detail, next }: { palette: string[]; title?: string; detail: string; next: NextStep[] }) {
  const reduced = useReducedMotion();
  return (
    <View style={{ gap: space.sm }}>
      <OrderConfirmed palette={palette} detail={detail} />
      {title ? <Text style={[type.heading, { textAlign: 'center' }]}>{title}</Text> : null}
      {next.map((n, i) => (
        <Animated.View
          key={n.label}
          entering={reduced ? FadeIn.duration(duration.fast) : FadeInDown.duration(duration.base).delay(420 + i * 80).easing(ease.out)}
          style={styles.next}
        >
          <View style={styles.nextDot} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={type.label}>{n.label}</Text>
            {n.detail ? <Text style={type.caption}>{n.detail}</Text> : null}
          </View>
          {n.url ? <Button variant="secondary" label="open" onPress={() => void Linking.openURL(n.url!)} style={styles.nextBtn} /> : null}
        </Animated.View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Status line under a buy button. "coming online" reads calm, not like an error.

export function PurchaseStatus<T>({ purchase }: { purchase: Purchase<T> }) {
  const line = phaseLine(purchase.state);
  if (!line) return null;
  const soon = purchase.state.phase === 'unavailable' && purchase.state.reason === 'soon';
  return (
    <Animated.View key={purchase.state.phase} entering={FadeIn.duration(duration.fast)} exiting={FadeOut.duration(140)} style={styles.status}>
      {soon ? <ComingOnline /> : <Text style={[type.caption, { textAlign: 'center' }]}>{line}</Text>}
      {purchase.state.phase === 'waiting' ? <Button variant="quiet" label="check again" onPress={() => void purchase.retryConfirm()} /> : null}
    </Animated.View>
  );
}

export function ComingOnline({ what = 'whop checkout for this', style }: { what?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.soon, style]} accessibilityRole="text">
      <View style={styles.soonDot} />
      <Text style={[type.caption, { flex: 1, color: colors.text }]}>
        coming online · {what} turns on with the next backend deploy
      </Text>
    </View>
  );
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.sectionHead}>
        <Text style={type.caption}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  nextDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  nextBtn: { minHeight: 36, paddingHorizontal: space.md },
  status: { alignItems: 'center', gap: space.xs },
  soon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignSelf: 'stretch',
  },
  soonDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pinkEdge },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
