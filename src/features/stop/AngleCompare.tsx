import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Photo } from '@/lib/types';
import { colors, radius, space, type } from '@/theme';

import { ChevronsIcon } from './Icons';
import { clamp, EASE_IN_OUT } from './motion';

const HANDLE = 44;
const EDGE = 0; // divider can go all the way to either side
const FLICK = 900; // px/s: a flick past this sends the divider to the edge it was thrown at

type Props = {
  mine: Photo;
  theirs: Photo[];
  friendName: string;
  width: number;
  reduced: boolean;
};

function selection() {
  Haptics.selectionAsync();
}
function light() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * "You | them": the same moment from two phones, split by a divider you drag.
 * Left of the divider is your photo, right of it is theirs.
 */
export function AngleCompare({ mine, theirs, friendName, width, reduced }: Props) {
  const height = Math.round(width * 0.82);
  const [pick, setPick] = useState(0);
  const their = theirs[Math.min(pick, theirs.length - 1)];

  const x = useSharedValue(width / 2);
  const startX = useSharedValue(width / 2);
  const grabbed = useSharedValue(0);

  // A one-time nudge so it reads as draggable.
  useEffect(() => {
    if (reduced) return;
    x.set(
      withDelay(
        700,
        withSequence(
          withTiming(width * 0.64, { duration: 420, easing: EASE_IN_OUT }),
          withTiming(width * 0.4, { duration: 480, easing: EASE_IN_OUT }),
          withTiming(width / 2, { duration: 360, easing: EASE_IN_OUT }),
        ),
      ),
    );
  }, [reduced, width, x]);

  // Selection tick when the divider crosses the middle: a detent you can feel.
  useAnimatedReaction(
    () => (grabbed.get() > 0 ? x.get() > width / 2 : null),
    (side, prev) => {
      if (side !== null && prev !== null && side !== prev) scheduleOnRN(selection);
    },
  );

  const pan = usePanGesture({
    activeOffsetX: [-6, 6],
    failOffsetY: [-12, 12],
    onActivate: () => {
      'worklet';
      startX.set(x.get());
      grabbed.set(withTiming(1, { duration: 120 }));
      scheduleOnRN(light);
    },
    onUpdate: (e) => {
      'worklet';
      x.set(clamp(startX.get() + e.translationX, EDGE, width - EDGE));
    },
    onDeactivate: (e) => {
      'worklet';
      grabbed.set(withTiming(0, { duration: 180 }));
      if (Math.abs(e.velocityX) > FLICK) {
        const target = e.velocityX > 0 ? width - EDGE : EDGE;
        x.set(withSpring(target, { duration: 400, dampingRatio: 0.8, velocity: e.velocityX, overshootClamping: true }));
        scheduleOnRN(light);
      }
    },
  });

  // The clip window slides right with the divider; the image inside slides left
  // by the same amount so it stays put. Transform-only, no layout per frame.
  const clipStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const innerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -x.get() }] }));
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() - 1 }] }));
  const handleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() - HANDLE / 2 }, { scale: 1 + grabbed.get() * 0.12 }],
  }));
  const youLabel = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [40, 110], [0, 1], 'clamp') }));
  const themLabel = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [width - 130, width - 60], [1, 0], 'clamp') }));

  return (
    <View style={{ gap: space.sm }}>
      <GestureDetector gesture={pan}>
        <View style={{ width, height, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface }}>
          <Image source={{ uri: mine.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />

          <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, clipStyle]}>
            <Animated.View style={[StyleSheet.absoluteFill, innerStyle]}>
              <Image source={{ uri: their.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            </Animated.View>
          </Animated.View>

          <Animated.View pointerEvents="none" style={[styles.line, { height }, lineStyle]} />
          <Animated.View pointerEvents="none" style={[styles.handle, { top: height / 2 - HANDLE / 2 }, handleStyle]}>
            <ChevronsIcon color={colors.bg} />
          </Animated.View>

          <Animated.View pointerEvents="none" style={[styles.label, { left: space.sm }, youLabel]}>
            <Text style={styles.labelText}>You</Text>
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.label, { right: space.sm }, themLabel]}>
            <Text style={styles.labelText}>{friendName}</Text>
          </Animated.View>
        </View>
      </GestureDetector>

      {theirs.length > 1 ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {theirs.map((p, i) => (
            <Pressable
              key={p.id}
              hitSlop={6}
              onPress={() => {
                if (i === pick) return;
                Haptics.selectionAsync();
                setPick(i);
              }}
              style={[styles.thumb, i === pick && { borderColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel={`${friendName}'s photo ${i + 1}`}
            >
              <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            </Pressable>
          ))}
          <Text style={[type.caption, { alignSelf: 'center', marginLeft: space.xs }]}>
            {theirs.length} from {friendName}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { position: 'absolute', top: 0, left: 0, width: 2, backgroundColor: colors.text },
  handle: {
    position: 'absolute',
    left: 0,
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  label: {
    position: 'absolute',
    top: space.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(14,17,22,0.6)',
  },
  labelText: { color: colors.text, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
});
