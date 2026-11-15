import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { colors, space } from '@/theme';

import { EASE_OUT, INK, SERIF } from './film';

type Props = { title: string; date: string; meta: string };

// Opening card: date, title, a rule drawing across, then the count line.
// Fades out over the map as the first flight begins.
export function TitleCard({ title, date, meta }: Props) {
  const rule = useSharedValue(0);
  useEffect(() => {
    rule.set(withDelay(650, withTiming(1, { duration: 900, easing: EASE_OUT })));
  }, [rule]);
  const ruleStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: rule.get() }], opacity: rule.get() }));

  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(900).easing(EASE_OUT)}
      style={styles.root}
    >
      <View style={styles.center}>
        <Animated.Text entering={FadeInDown.duration(700).delay(150).easing(EASE_OUT)} style={styles.date}>
          {date}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.duration(800).delay(300).easing(EASE_OUT)} style={styles.title}>
          {title}
        </Animated.Text>
        <Animated.View style={[styles.rule, ruleStyle]} />
        <Animated.View entering={FadeIn.duration(700).delay(1100)}>
          <Text style={styles.meta}>{meta}</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,7,10,0.78)', justifyContent: 'center' },
  center: { alignItems: 'center', paddingHorizontal: space.xl },
  date: { fontSize: 14, color: colors.textMuted, letterSpacing: 0.3, marginBottom: space.sm },
  title: {
    fontFamily: SERIF,
    fontSize: 40,
    lineHeight: 46,
    color: colors.text,
    textAlign: 'center',
    textShadowColor: INK,
    textShadowRadius: 12,
  },
  rule: { width: 64, height: 2, backgroundColor: colors.accent, marginVertical: space.md, borderRadius: 1 },
  meta: { fontSize: 15, color: colors.text, opacity: 0.85 },
});
