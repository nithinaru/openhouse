import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import type { Moment } from '@/lib/types';
import { colors, radius, space } from '@/theme';

import { EASE_OUT, SERIF } from './film';
import { splitWords } from './narrator';
import { formatTime } from './stats';

type Props = {
  moment: Moment;
  progress: SharedValue<number>;
  reducedMotion: boolean;
  onPress: () => void;
};

// Place / time / weather chips, then the narration revealed word by word.
// Every word is laid out from the start (opacity 0), so lines never reflow.
export function KineticCaption({ moment, progress, reducedMotion, onPress }: Props) {
  const text = moment.narration ?? moment.caption ?? '';
  const { words } = useMemo(() => splitWords(text), [text]);

  const chips = [
    moment.placeName,
    formatTime(moment.startAt),
    moment.weather ? `${Math.round(moment.weather.tempF)}° ${moment.weather.summary}` : undefined,
    moment.isGoldenHour ? 'Golden hour' : undefined,
  ].filter(Boolean) as string[];

  return (
    <Animated.View entering={FadeIn.duration(320).easing(EASE_OUT)} exiting={FadeOut.duration(200)}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${moment.placeName ?? 'Stop'}. ${text}`}>
        <View style={styles.chips}>
          {chips.map((c, i) => (
            <Animated.View
              key={c}
              entering={FadeIn.duration(280).delay(80 * i).easing(EASE_OUT)}
              style={[styles.chip, i === 0 && styles.chipPrimary]}
            >
              <Text style={[styles.chipText, i === 0 && styles.chipTextPrimary]} numberOfLines={1}>
                {c}
              </Text>
            </Animated.View>
          ))}
        </View>
        <View style={styles.words}>
          {words.map((w, i) => (
            <Word key={`${i}-${w}`} word={w} i={i} progress={progress} reducedMotion={reducedMotion} />
          ))}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Word({
  word,
  i,
  progress,
  reducedMotion,
}: {
  word: string;
  i: number;
  progress: SharedValue<number>;
  reducedMotion: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const t = interpolate(progress.get(), [i, i + 1], [0, 1], 'clamp');
    return {
      opacity: t,
      transform: reducedMotion ? [] : [{ translateY: (1 - t) * 7 }],
    };
  });
  return <Animated.Text style={[styles.word, style]}>{word} </Animated.Text>;
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2, marginBottom: space.sm + 2 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(242,238,230,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(242,238,230,0.18)',
  },
  chipPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text, letterSpacing: 0.2 },
  chipTextPrimary: { color: '#1A1408' },
  words: { flexDirection: 'row', flexWrap: 'wrap' },
  word: {
    fontFamily: SERIF,
    fontSize: 23,
    lineHeight: 31,
    color: colors.text,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});
