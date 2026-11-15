import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors, ease, film } from '@/theme';

const INK = colors.ink;
const LETTERBOX_H = film.letterboxH;
const EASE_IN_OUT = ease.inOut;

// Letterbox bars that slide in during flights and out when the camera lands.
export function Letterbox({ visible, topInset }: { visible: boolean; topInset: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(visible ? 1 : 0, { duration: visible ? 700 : 900, easing: EASE_IN_OUT }));
  }, [visible, t]);

  const topH = LETTERBOX_H + topInset;
  const top = useAnimatedStyle(() => ({ transform: [{ translateY: (t.get() - 1) * topH }] }));
  const bottom = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - t.get()) * LETTERBOX_H }] }));

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.bar, { top: 0, height: topH }, top]} />
      <Animated.View pointerEvents="none" style={[styles.bar, { bottom: 0, height: LETTERBOX_H }, bottom]} />
    </>
  );
}

// Soft dark gradient behind the caption so serif type reads over any map.
// Its strength crossfades with `strong` (opacity only).
export function BottomScrim({ height, strong }: { height: number; strong: boolean }) {
  const o = useSharedValue(0.55);
  useEffect(() => {
    o.set(withTiming(strong ? 1 : 0.55, { duration: 600 }));
  }, [strong, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  return (
    <Animated.View pointerEvents="none" style={[styles.scrim, { height }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={INK} stopOpacity="0" />
            <Stop offset="0.45" stopColor={INK} stopOpacity="0.55" />
            <Stop offset="1" stopColor={INK} stopOpacity="0.92" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#scrim)" />
      </Svg>
    </Animated.View>
  );
}

// Top fade so the controls sit on something.
export function TopScrim({ height }: { height: number }) {
  return (
    <View pointerEvents="none" style={[styles.topScrim, { height }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="top" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={INK} stopOpacity="0.7" />
            <Stop offset="1" stopColor={INK} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#top)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, backgroundColor: INK },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  topScrim: { position: 'absolute', left: 0, right: 0, top: 0 },
});
