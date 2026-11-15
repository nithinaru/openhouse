import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import type { Pairing, Person } from '@/lib/types';
import { colors, ease, fonts, radius, shadow, type } from '@/theme';

const EASE_OUT = ease.out;

const SIZE = 40;
const GAP = 6;
const LABEL_W = 96;
const BOX_W = SIZE + GAP + LABEL_W;
const ANIM_MS = 1400; // keep re-snapshotting the marker (Android) while it animates

// Face pin with the person's name popping out beside it. The label lives
// inside a fixed-width box so the anchor stays on the avatar.
export function PersonPin({ pairing, person }: { pairing: Pairing; person?: Person }) {
  const [loaded, setLoaded] = useState(!person?.avatarUri);
  const [animating, setAnimating] = useState(true);
  const pop = useSharedValue(0);
  const name = useSharedValue(0);

  useEffect(() => {
    pop.set(withSpring(1, { duration: 480, dampingRatio: 0.6 }));
    name.set(withDelay(200, withTiming(1, { duration: 360, easing: EASE_OUT })));
    const t = setTimeout(() => setAnimating(false), ANIM_MS);
    return () => clearTimeout(t);
  }, [pop, name]);

  const avatarStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.get() * 2),
    transform: [{ scale: 0.7 + 0.3 * pop.get() }],
  }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: name.get(),
    transform: [{ translateX: (1 - name.get()) * -10 }, { rotate: '-4deg' }, { scale: 0.92 + 0.08 * name.get() }],
  }));

  return (
    <Marker
      identifier={`pairing-${pairing.id}`}
      coordinate={{ latitude: pairing.lat, longitude: pairing.lng }}
      anchor={{ x: SIZE / 2 / BOX_W, y: 1.2 }}
      tracksViewChanges={!loaded || animating}
      title={person?.name}
    >
      <View style={styles.box}>
        <Animated.View style={[styles.avatar, avatarStyle]}>
          {person?.avatarUri ? (
            <Image
              source={{ uri: person.avatarUri }}
              style={{ width: SIZE, height: SIZE }}
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(true)}
            />
          ) : (
            <Text style={type.caption}>{person?.name?.[0] ?? '?'}</Text>
          )}
        </Animated.View>
        {person?.name ? (
          <Animated.View style={[styles.label, nameStyle]}>
            <Text style={styles.labelText} numberOfLines={1}>
              {person.name}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  box: { width: BOX_W, height: SIZE, flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: colors.bg,
    backgroundColor: colors.skyHaze,
    ...shadow.chip,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginLeft: GAP,
    maxWidth: LABEL_W,
    backgroundColor: colors.pink,
    borderRadius: radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.pinkEdge,
  },
  labelText: { fontFamily: fonts.bold, fontSize: 12, color: colors.text, textTransform: 'lowercase' },
});
