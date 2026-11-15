import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { Moment, Photo } from '@/lib/types';
import { colors, radius, shadow } from '@/theme';

const CARD_W = 136;
const CARD_H = 102;
const SPREAD = [
  { x: -104, y: 10, rotate: -9 },
  { x: 0, y: 0, rotate: -2 },
  { x: 104, y: 12, rotate: 8 },
];
// Ken Burns: each card drifts its own way while it's on screen.
const KB_MS = 9000;
const KB = [
  { from: 1.06, to: 1.2, dx: 7, dy: -3 },
  { from: 1.04, to: 1.16, dx: -5, dy: -4 },
  { from: 1.08, to: 1.22, dx: -7, dy: 3 },
];

function Card({
  photo,
  slot,
  paused,
  reducedMotion,
  onPress,
}: {
  photo: Photo;
  slot: number;
  paused: boolean;
  reducedMotion: boolean;
  onPress: () => void;
}) {
  const t = useSharedValue(0);
  const kb = useSharedValue(0);
  const target = SPREAD[slot];
  const drift = KB[slot];

  useEffect(() => {
    t.set(withDelay(slot === 1 ? 160 : slot * 90, withSpring(1, { duration: 650, dampingRatio: 0.78 })));
  }, [slot, t]);

  // Ken Burns runs while playing, holds on pause, resumes from where it was.
  useEffect(() => {
    if (reducedMotion) return;
    if (paused) {
      cancelAnimation(kb);
      return;
    }
    const left = (1 - kb.get()) * KB_MS;
    kb.set(withTiming(1, { duration: left, easing: Easing.inOut(Easing.sin) }));
  }, [paused, reducedMotion, kb]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, t.get() * 1.6),
    transform: [
      { translateX: target.x * t.get() },
      { translateY: target.y * t.get() + (1 - t.get()) * 56 },
      { rotate: `${target.rotate * t.get()}deg` },
      { scale: 0.86 + 0.14 * t.get() },
    ],
  }));

  const kbStyle = useAnimatedStyle(() => {
    const k = kb.get();
    return {
      transform: [
        { translateX: drift.dx * k },
        { translateY: drift.dy * k },
        { scale: drift.from + (drift.to - drift.from) * k },
      ],
    };
  });

  return (
    <Animated.View style={[styles.card, slot === 1 && styles.hero, style]}>
      <Pressable onPress={onPress} style={styles.fill} accessibilityRole="imagebutton" accessibilityLabel="open stop">
        <Animated.View style={[styles.fill, kbStyle]}>
          <Image source={{ uri: photo.uri }} style={styles.fill} contentFit="cover" transition={180} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// Three photos fanning in for the current stop. Mount it with key={moment.id}
// so every stop replays the animation.
export function PhotoFan({
  moment,
  paused = false,
  reducedMotion = false,
  onPress,
}: {
  moment: Moment;
  paused?: boolean;
  reducedMotion?: boolean;
  onPress: () => void;
}) {
  const hero = moment.photos.find((p) => p.id === moment.heroPhotoId);
  const rest = moment.photos.filter((p) => p.id !== hero?.id);
  const picks = (hero ? [rest[0], hero, rest[1]] : rest.slice(0, 3)).filter(Boolean) as Photo[];
  // Order so the middle (hero) card renders last, on top.
  const slots = picks.length === 3 ? [0, 2, 1] : picks.length === 2 ? [0, 2] : [1];
  const ordered = picks.length === 3 ? [picks[0], picks[2], picks[1]] : picks;

  return (
    <Animated.View exiting={FadeOut.duration(250)} pointerEvents="box-none">
      <View style={styles.stage} pointerEvents="box-none">
        {ordered.map((p, i) => (
          <Card key={p.id} photo={p} slot={slots[i]} paused={paused} reducedMotion={reducedMotion} onPress={onPress} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { height: CARD_H + 28, alignItems: 'center', justifyContent: 'center' },
  card: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 5,
    borderColor: colors.bg,
    backgroundColor: colors.bg,
    ...shadow.print,
  },
  hero: { width: CARD_W + 12, height: CARD_H + 9 },
  fill: { flex: 1 },
});
