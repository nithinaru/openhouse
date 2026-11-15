// $1–$10 price slider. The thumb follows the finger on the UI thread; whole-dollar detents
// tick a selection haptic and update React only when the step changes (never per frame).

import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, radius, shadow, space, type } from '@/theme';

const THUMB = 32;

type Props = { min?: number; max?: number; value: number; onChange: (dollars: number) => void };

function tick() {
  void Haptics.selectionAsync().catch(() => {});
}

export function PriceSlider({ min = 1, max = 10, value, onChange }: Props) {
  const [trackW, setTrackW] = useState(0);
  const x = useSharedValue(0);
  const start = useSharedValue(0);
  const step = useSharedValue(value);
  const width = useSharedValue(0);
  const span = max - min;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width - THUMB;
    setTrackW(w);
    width.set(w);
    x.set(((value - min) / span) * w);
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      start.set(x.get());
    })
    .onUpdate((e) => {
      const w = width.get();
      if (w <= 0) return;
      const nx = Math.min(w, Math.max(0, start.get() + e.translationX));
      x.set(nx);
      const s = Math.round(min + (nx / w) * span);
      if (s !== step.get()) {
        step.set(s);
        scheduleOnRN(onChange, s);
        scheduleOnRN(tick);
      }
    })
    .onFinalize((e) => {
      const w = width.get();
      if (w <= 0) return;
      x.set(withSpring(((step.get() - min) / span) * w, { duration: 300, dampingRatio: 0.8, velocity: e.velocityX }));
    });

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const fillStyle = useAnimatedStyle(() => ({ width: x.get() + THUMB / 2 }));

  return (
    <View style={{ gap: space.sm }}>
      <GestureDetector gesture={pan}>
        <View
          style={styles.track}
          onLayout={onLayout}
          hitSlop={{ top: 12, bottom: 12 }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="price"
          accessibilityValue={{ min, max, now: value, text: `$${value}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            const next = Math.min(max, Math.max(min, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1)));
            if (next === value) return;
            step.set(next);
            x.set(((next - min) / span) * trackW);
            onChange(next);
          }}
        >
          <View style={styles.rail} />
          <Animated.View style={[styles.fill, fillStyle]} />
          <Animated.View style={[styles.thumb, shadow.chip, thumbStyle]} />
        </View>
      </GestureDetector>
      <View style={styles.ticks}>
        <Text style={type.caption}>${min}</Text>
        <Text style={type.caption}>${max}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: THUMB, justifyContent: 'center' },
  rail: { position: 'absolute', left: THUMB / 2, right: THUMB / 2, height: 6, borderRadius: radius.full, backgroundColor: colors.elevated },
  fill: { position: 'absolute', left: 0, height: 6, borderRadius: radius.full, backgroundColor: colors.accent },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  ticks: { flexDirection: 'row', justifyContent: 'space-between' },
});
