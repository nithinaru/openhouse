import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { EASE_OUT } from '@/features/stop/motion';
import { colors, radius, space, type } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const BADGE = 64;
const CHECK_LEN = 34; // path length of the check stroke below
const PIECES = 18;

type Props = { palette: string[]; detail: string };

/** Mount this when the order flips to confirmed; it plays once. */
export function OrderConfirmed({ palette, detail }: Props) {
  const reduced = useReducedMotion();
  const badge = useSharedValue(reduced ? 1 : 0);
  const check = useSharedValue(reduced ? 1 : 0);
  const ring = useSharedValue(0);
  const burst = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (reduced) return;
    badge.set(withSpring(1, { duration: 550, dampingRatio: 0.55 }));
    check.set(withDelay(160, withTiming(1, { duration: 340, easing: EASE_OUT })));
    ring.set(withTiming(1, { duration: 700, easing: EASE_OUT }));
    burst.set(withTiming(1, { duration: 1100, easing: EASE_OUT }));
  }, [badge, burst, check, reduced, ring]);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, badge.get() * 2),
    transform: [{ scale: 0.6 + 0.4 * badge.get() }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.get()) * 0.7,
    transform: [{ scale: 1 + ring.get() * 1.4 }],
  }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - check.get()) }));

  const colorsFor = palette.length ? palette : [colors.pinkEdge, colors.ink, colors.skyDeep];

  return (
    <Animated.View entering={reduced ? FadeIn.duration(200) : FadeIn.duration(260)} style={styles.card}>
      <View style={styles.badgeWrap}>
        {!reduced &&
          Array.from({ length: PIECES }, (_, i) => (
            <Piece key={i} index={i} color={colorsFor[i % colorsFor.length]} progress={burst} />
          ))}
        <Animated.View style={[styles.ring, ringStyle]} />
        <Animated.View style={[styles.badge, badgeStyle]}>
          <Svg width={34} height={34} viewBox="0 0 34 34">
            <AnimatedPath
              d="M8 17.5l6 6L26 11"
              fill="none"
              stroke={colors.accentInk}
              strokeWidth={3.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={CHECK_LEN}
              animatedProps={checkProps}
            />
          </Svg>
        </Animated.View>
      </View>
      <Text style={[type.heading, { marginTop: space.md }]}>order confirmed</Text>
      <Text style={[type.caption, { textAlign: 'center', marginTop: space.xs }]}>{detail}</Text>
      <Pressable onPress={() => router.push('/whop/chat')} accessibilityRole="link" hitSlop={8} style={{ marginTop: space.sm }}>
        <Text style={[type.label, { textDecorationLine: 'underline' }]}>join the owners chat →</Text>
      </Pressable>
    </Animated.View>
  );
}

function Piece({ index, color, progress }: { index: number; color: string; progress: SharedValue<number> }) {
  // Deterministic scatter so every run looks the same on stage.
  const angle = (index / PIECES) * Math.PI * 2 + ((index * 37) % 10) / 20;
  const dist = 62 + ((index * 53) % 40);
  const spin = ((index * 71) % 360) - 180;
  const tall = index % 3 === 0;

  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: p === 0 ? 0 : 1 - Math.max(0, (p - 0.55) / 0.45),
      transform: [
        { translateX: Math.cos(angle) * dist * p },
        // Outward burst, then a little gravity.
        { translateY: Math.sin(angle) * dist * p + p * p * 26 },
        { rotate: `${spin * p}deg` },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: tall ? 4 : 7, height: tall ? 9 : 5, borderRadius: 1, backgroundColor: color }, style]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  badgeWrap: { width: BADGE, height: BADGE, alignItems: 'center', justifyContent: 'center' },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.pinkEdge,
  },
});
