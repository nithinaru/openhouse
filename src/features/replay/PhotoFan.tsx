import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import type { Moment, Photo } from '@/lib/types';
import { colors, radius } from '@/theme';

const CARD_W = 116;
const CARD_H = 88;
const SPREAD = [
  { x: -92, rotate: -9 },
  { x: 0, rotate: 0 },
  { x: 92, rotate: 9 },
];

function Card({ photo, slot, onPress }: { photo: Photo; slot: number; onPress: () => void }) {
  const t = useSharedValue(0);
  const target = SPREAD[slot];

  useEffect(() => {
    t.value = withDelay(slot * 110, withSpring(1, { damping: 14, stiffness: 140 }));
  }, [slot, t]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, t.value * 1.5),
    transform: [
      { translateX: target.x * t.value },
      { translateY: (1 - t.value) * 60 },
      { rotate: `${target.rotate * t.value}deg` },
      { scale: 0.8 + 0.2 * t.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: CARD_W,
          height: CARD_H,
          borderRadius: radius.sm,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: colors.text,
          backgroundColor: colors.surface,
        },
        style,
      ]}
    >
      <Pressable onPress={onPress} style={{ flex: 1 }}>
        <Image source={{ uri: photo.uri }} style={{ flex: 1 }} contentFit="cover" transition={150} />
      </Pressable>
    </Animated.View>
  );
}

// Three photos fanning in for the current stop. Mount it with key={moment.id}
// so every stop replays the animation.
export function PhotoFan({ moment, onPress }: { moment: Moment; onPress: () => void }) {
  const hero = moment.photos.find((p) => p.id === moment.heroPhotoId);
  const rest = moment.photos.filter((p) => p.id !== hero?.id);
  const picks = (hero ? [rest[0], hero, rest[1]] : rest.slice(0, 3)).filter(Boolean) as Photo[];
  // Order so the middle (hero) card renders last, on top.
  const slots = picks.length === 3 ? [0, 2, 1] : picks.length === 2 ? [0, 2] : [1];
  const ordered = picks.length === 3 ? [picks[0], picks[2], picks[1]] : picks;

  return (
    <Animated.View exiting={FadeOut.duration(250)} pointerEvents="box-none">
      <View style={{ height: CARD_H + 24, alignItems: 'center', justifyContent: 'center' }} pointerEvents="box-none">
        {ordered.map((p, i) => (
          <Card key={p.id} photo={p} slot={slots[i]} onPress={onPress} />
        ))}
      </View>
    </Animated.View>
  );
}
