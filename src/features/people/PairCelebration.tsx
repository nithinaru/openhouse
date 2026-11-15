import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { PairPromo } from '@/features/drop/PromoParts';
import { EASE_IN_OUT, EASE_OUT } from '@/features/stop/motion';
import { colors, fonts, shadow, space, type } from '@/theme';
import { Button } from '@/theme/ui';

const AV = 88;
const START = 150; // px each avatar travels in from
const REST = AV / 2 - 10; // final offset from center: the two overlap by 20px
const APPROACH_MS = 520;
const SPARKS = 12;
const SPARK_COLORS = [colors.pinkEdge, colors.ink, colors.skyDeep];

type Person = { name: string; avatarUri?: string; /** Friend only: their users.shareCode, for the "was there" code. */ shareCode?: string };

function meetHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Two avatars slide in and meet in the middle; the haptic lands on contact. */
export function PairCelebration({ me, friend, onAgain }: { me: Person; friend: Person; onAgain: () => void }) {
  const reduced = useReducedMotion();
  const approach = useSharedValue(reduced ? 1 : 0);
  const bump = useSharedValue(1);
  const burst = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      meetHaptic();
      return;
    }
    approach.set(
      withTiming(1, { duration: APPROACH_MS, easing: EASE_IN_OUT }, (finished) => {
        if (!finished) return;
        // Contact: haptic, a small squash, and the spark burst, all in the same frame.
        scheduleOnRN(meetHaptic);
        bump.set(withSequence(withTiming(1.08, { duration: 90, easing: EASE_OUT }), withTiming(1, { duration: 260, easing: EASE_OUT })));
        burst.set(withTiming(1, { duration: 800, easing: EASE_OUT }));
      }),
    );
  }, [approach, bump, burst, reduced]);

  const leftStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, approach.get() * 3),
    transform: [{ translateX: -REST - (1 - approach.get()) * START }, { rotate: `${(1 - approach.get()) * -12}deg` }, { scale: bump.get() }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, approach.get() * 3),
    transform: [{ translateX: REST + (1 - approach.get()) * START }, { rotate: `${(1 - approach.get()) * 12}deg` }, { scale: bump.get() }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: burst.get() === 0 ? 0 : (1 - burst.get()) * 0.8,
    transform: [{ scale: 0.6 + burst.get() * 2.2 }],
  }));

  const textDelay = reduced ? 0 : APPROACH_MS + 180;

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <Animated.View style={[styles.ring, ringStyle]} />
        {!reduced && Array.from({ length: SPARKS }, (_, i) => <Spark key={i} index={i} progress={burst} />)}
        <Animated.View style={[styles.avatarWrap, leftStyle]}>
          <Avatar person={me} />
        </Animated.View>
        <Animated.View style={[styles.avatarWrap, rightStyle]}>
          <Avatar person={friend} />
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.duration(380).delay(textDelay).easing(EASE_OUT)} style={{ alignItems: 'center', gap: space.xs }}>
        <Text style={type.title}>you and {friend.name}</Text>
        <Text style={[type.body, { color: colors.textMuted, textAlign: 'center' }]}>you’ll show up on each other’s map</Text>
      </Animated.View>

      {friend.shareCode ? <PairPromo friendName={friend.name} friendShareCode={friend.shareCode} delay={textDelay + 80} /> : null}

      <Animated.View entering={FadeInDown.duration(380).delay(textDelay + 120).easing(EASE_OUT)}>
        <Button label="scan another" onPress={onAgain} />
      </Animated.View>
    </View>
  );
}

function Avatar({ person }: { person: Person }) {
  return person.avatarUri ? (
    <Image source={{ uri: person.avatarUri }} style={styles.avatar} contentFit="cover" />
  ) : (
    <View style={[styles.avatar, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pink }]}>
      <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 36 }}>{person.name.slice(0, 1).toLowerCase()}</Text>
    </View>
  );
}

function Spark({ index, progress }: { index: number; progress: SharedValue<number> }) {
  // Fan upward from the contact point, deterministic so rehearsals match the stage.
  const angle = -Math.PI / 2 + ((index / (SPARKS - 1)) - 0.5) * Math.PI * 1.5;
  const dist = 70 + ((index * 29) % 34);
  const size = index % 2 ? 6 : 8;

  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: p === 0 ? 0 : 1 - Math.max(0, (p - 0.5) / 0.5),
      transform: [{ translateX: Math.cos(angle) * dist * p }, { translateY: Math.sin(angle) * dist * p + p * p * 18 }, { scale: 1 - p * 0.5 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: SPARK_COLORS[index % SPARK_COLORS.length] }, style]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  stage: { width: '100%', height: AV + 80, alignItems: 'center', justifyContent: 'center' },
  avatarWrap: { position: 'absolute' },
  avatar: { width: AV, height: AV, borderRadius: AV / 2, borderWidth: 4, borderColor: colors.bg, backgroundColor: colors.surface, ...shadow.print },
  ring: { position: 'absolute', width: AV, height: AV, borderRadius: AV / 2, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.pinkEdge },
});
