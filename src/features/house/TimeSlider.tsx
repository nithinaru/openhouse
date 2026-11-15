import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors } from '@/theme';

// Scrub through the day. The thumb rides the UI thread; React only hears about it when
// the time crosses a 5-minute step, so the map re-renders a few times per drag, not
// once per frame.

const THUMB = 30;
const STEP_MS = 5 * 60_000;

export function TimeSlider({
  start,
  end,
  initial,
  marks,
  onChange,
}: {
  start: number;
  end: number;
  initial: number;
  /** Stop start times, drawn as ticks on the track. */
  marks: number[];
  onChange: (t: number) => void;
}) {
  const steps = Math.max(1, Math.round((end - start) / STEP_MS));
  const [width, setWidth] = useState(0);
  const w = useSharedValue(0);
  const frac = useSharedValue((initial - start) / (end - start));
  const startFrac = useSharedValue(0);
  const pressed = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    w.set(next);
    setWidth(next);
  };

  const emit = (step: number) => onChange(start + step * STEP_MS);

  useAnimatedReaction(
    () => Math.round(frac.get() * steps),
    (cur, prev) => {
      if (prev !== null && cur !== prev) scheduleOnRN(emit, cur);
    },
  );

  const pan = Gesture.Pan()
    .hitSlop({ top: 16, bottom: 16 })
    .onBegin((e) => {
      pressed.set(withSpring(1, { duration: 200, dampingRatio: 1 }));
      const span = Math.max(1, w.get() - THUMB);
      frac.set(Math.min(1, Math.max(0, (e.x - THUMB / 2) / span)));
      startFrac.set(frac.get());
    })
    .onUpdate((e) => {
      const span = Math.max(1, w.get() - THUMB);
      frac.set(Math.min(1, Math.max(0, startFrac.get() + e.translationX / span)));
    })
    .onFinalize(() => {
      pressed.set(withSpring(0, { duration: 260, dampingRatio: 1 }));
    });

  const fill = useAnimatedStyle(() => ({ width: frac.get() * Math.max(0, w.get() - THUMB) }));
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: frac.get() * Math.max(0, w.get() - THUMB) }, { scale: 1 + pressed.get() * 0.12 }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.wrap} onLayout={onLayout} accessibilityRole="adjustable" accessibilityLabel="time of day">
        <View style={styles.track} />
        {width > 0
          ? marks.map((m) => (
              <View key={m} style={[styles.mark, { left: THUMB / 2 + ((m - start) / (end - start)) * (width - THUMB) - 1.5 }]} />
            ))
          : null}
        <Animated.View style={[styles.fill, fill]} />
        <Animated.View style={[styles.thumb, thumb]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 44, justifyContent: 'center' },
  track: { position: 'absolute', left: THUMB / 2, right: THUMB / 2, height: 4, borderRadius: 2, backgroundColor: colors.surface },
  mark: { position: 'absolute', width: 3, height: 10, borderRadius: 1.5, backgroundColor: colors.lineStrong },
  fill: { position: 'absolute', left: THUMB / 2, height: 4, borderRadius: 2, backgroundColor: colors.ink },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.bg,
    borderWidth: 2.5,
    borderColor: colors.ink,
  },
});
