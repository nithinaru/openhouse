import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Moment } from '@/lib/types';
import { colors, ease, fonts, radius, shadow, space } from '@/theme';

const EASE_OUT = ease.out;

const TRACK_H = 4;
const HIT_H = 36;
const KNOB = 16;

type Props = {
  moments: Moment[];
  index: number;
  progress: SharedValue<number>;
  onJump: (i: number) => void;
};

// Thin film timeline. Stop i owns segment [i/n, (i+1)/n]. Tap or drag to
// scrub; the stop under the finger is named above the track, and the
// replay jumps there on release.
export function Timeline({ moments, index, progress, onJump }: Props) {
  const n = Math.max(1, moments.length);
  const width = useSharedValue(0);
  const dragging = useSharedValue(false);
  const dragX = useSharedValue(0);
  const lift = useSharedValue(0);
  const [hoverIndex, setHoverIndex] = useState(-1);

  const tick = () => Haptics.selectionAsync().catch(() => {});

  const pan = usePanGesture({
    minDistance: 0,
    hitSlop: { top: 10, bottom: 10 },
    onBegin: (e) => {
      'worklet';
      dragging.set(true);
      dragX.set(Math.min(Math.max(e.x, 0), width.get()));
      lift.set(withTiming(1, { duration: 140, easing: EASE_OUT }));
    },
    onUpdate: (e) => {
      'worklet';
      dragX.set(Math.min(Math.max(e.x, 0), width.get()));
    },
    onFinalize: (e) => {
      'worklet';
      const w = width.get();
      const i = w > 0 ? Math.min(n - 1, Math.max(0, Math.floor((dragX.get() / w) * n))) : -1;
      dragging.set(false);
      lift.set(withTiming(0, { duration: 200, easing: EASE_OUT }));
      if (!e.canceled && i >= 0) {
        progress.set(i / n);
        scheduleOnRN(onJump, i);
      }
      scheduleOnRN(setHoverIndex, -1);
    },
  });

  // Stop under the finger changed: name it and tick once.
  useAnimatedReaction(
    () => {
      if (!dragging.get() || width.get() <= 0) return -1;
      return Math.min(n - 1, Math.max(0, Math.floor((dragX.get() / width.get()) * n)));
    },
    (cur, prev) => {
      if (cur === prev || cur < 0) return;
      scheduleOnRN(setHoverIndex, cur);
      if (prev !== null && prev >= 0) scheduleOnRN(tick);
    },
  );

  const fill = useAnimatedStyle(() => ({
    width: (dragging.get() ? dragX.get() : progress.get() * width.get()) || 0,
  }));
  const knob = useAnimatedStyle(() => {
    const x = dragging.get() ? dragX.get() : progress.get() * width.get();
    return { transform: [{ translateX: x - KNOB / 2 }, { scale: 1 + lift.get() * 0.45 }] };
  });
  const track = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 + lift.get() * 0.6 }] }));
  const labelStyle = useAnimatedStyle(() => {
    const w = width.get();
    const x = Math.min(Math.max(dragX.get(), 60), Math.max(60, w - 60));
    return { opacity: lift.get(), transform: [{ translateX: x - 60 }, { translateY: (1 - lift.get()) * 4 }] };
  });

  const hovered = hoverIndex >= 0 ? moments[hoverIndex] : undefined;

  return (
    <View style={styles.root}>
      <Animated.View pointerEvents="none" style={[styles.label, labelStyle]}>
        <Text style={styles.labelText} numberOfLines={1}>
          {hovered?.placeName ?? (hovered ? `stop ${hoverIndex + 1}` : '')}
        </Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <View
          style={styles.hit}
          onLayout={(e) => width.set(e.nativeEvent.layout.width)}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="replay timeline"
          accessibilityValue={{ text: `stop ${Math.max(1, index + 1)} of ${n}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'increment') onJump(Math.min(n - 1, index + 1));
            if (e.nativeEvent.actionName === 'decrement') onJump(Math.max(0, index - 1));
          }}
        >
          <Animated.View style={[styles.track, track]}>
            <Animated.View style={[styles.fill, fill]} />
            {moments.map((m, i) =>
              i > 0 ? <View key={m.id} style={[styles.notch, { left: `${(i / n) * 100}%` }]} /> : null,
            )}
          </Animated.View>
          <Animated.View style={[styles.knob, knob]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hit: { height: HIT_H, justifyContent: 'center' },
  track: {
    height: TRACK_H,
    borderRadius: radius.full,
    backgroundColor: colors.veil,
    overflow: 'hidden',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accent },
  notch: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: colors.bg },
  knob: {
    position: 'absolute',
    left: 0,
    top: (HIT_H - KNOB) / 2,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.bg,
    borderWidth: 2.5,
    borderColor: colors.ink,
  },
  label: {
    ...shadow.chip,
    position: 'absolute',
    left: 0,
    bottom: HIT_H - 2,
    width: 120,
    alignItems: 'center',
  },
  labelText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.text,
    textTransform: 'lowercase',
    backgroundColor: colors.bg,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
});
