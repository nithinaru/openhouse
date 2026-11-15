import { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { EASE_OUT } from '@/features/stop/motion';
import { colors } from '@/theme';

const CORNER = 34;
const STROKE = 4;
const SHADE = 'rgba(8,10,14,0.62)';

/**
 * Overlay for the camera: dims everything but a square window, draws corner
 * brackets and a sweeping scan line. `locked` = a code was read.
 */
export function Viewfinder({ locked }: { locked: boolean }) {
  const reduced = useReducedMotion();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const sweep = useSharedValue(0);
  const breathe = useSharedValue(0);
  const lock = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    sweep.set(withRepeat(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.quad) }), -1, true));
    breathe.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [breathe, reduced, sweep]);

  useEffect(() => {
    lock.set(withTiming(locked ? 1 : 0, { duration: 220, easing: EASE_OUT }));
  }, [lock, locked]);

  const size = box ? Math.round(Math.min(box.w, box.h) * 0.68) : 0;

  const bracketStyle = useAnimatedStyle(() => ({
    transform: [{ scale: (1 + breathe.get() * 0.025) * (1 - lock.get() * 0.08) }],
  }));
  const lineStyle = useAnimatedStyle(() => ({
    opacity: 1 - lock.get(),
    transform: [{ translateY: sweep.get() * (size - 2) }],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {box && size > 0 ? (
        <>
          {/* Shade around the window */}
          <View style={[styles.shade, { top: 0, left: 0, right: 0, height: (box.h - size) / 2 }]} />
          <View style={[styles.shade, { bottom: 0, left: 0, right: 0, height: (box.h - size) / 2 }]} />
          <View style={[styles.shade, { top: (box.h - size) / 2, left: 0, width: (box.w - size) / 2, height: size }]} />
          <View style={[styles.shade, { top: (box.h - size) / 2, right: 0, width: (box.w - size) / 2, height: size }]} />

          <Animated.View style={[{ position: 'absolute', left: (box.w - size) / 2, top: (box.h - size) / 2, width: size, height: size }, bracketStyle]}>
            <Corner style={{ top: 0, left: 0, borderTopWidth: STROKE, borderLeftWidth: STROKE, borderTopLeftRadius: 18 }} lock={lock} />
            <Corner style={{ top: 0, right: 0, borderTopWidth: STROKE, borderRightWidth: STROKE, borderTopRightRadius: 18 }} lock={lock} />
            <Corner style={{ bottom: 0, left: 0, borderBottomWidth: STROKE, borderLeftWidth: STROKE, borderBottomLeftRadius: 18 }} lock={lock} />
            <Corner style={{ bottom: 0, right: 0, borderBottomWidth: STROKE, borderRightWidth: STROKE, borderBottomRightRadius: 18 }} lock={lock} />

            <Animated.View style={[{ position: 'absolute', left: 12, right: 12, top: 0, height: 2 }, lineStyle]}>
              <Svg width={size - 24} height={2}>
                <Defs>
                  <LinearGradient id="scanLine" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={colors.accent} stopOpacity="0" />
                    <Stop offset="0.5" stopColor={colors.accent} stopOpacity="1" />
                    <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect width={size - 24} height={2} fill="url(#scanLine)" />
              </Svg>
            </Animated.View>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

function Corner({ style, lock }: { style: ViewStyle; lock: SharedValue<number> }) {
  const color = useAnimatedStyle(() => ({ borderColor: interpolateColor(lock.get(), [0, 1], [colors.text, colors.accent]) }));
  return <Animated.View style={[styles.corner, style, color]} />;
}

const styles = StyleSheet.create({
  shade: { position: 'absolute', backgroundColor: SHADE },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.text },
});
