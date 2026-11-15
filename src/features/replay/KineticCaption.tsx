import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import type { Moment } from '@/lib/types';
import { colors, ease, space, type } from '@/theme';

import { splitWords } from './narrator';
import { formatTime } from './stats';

const EASE_OUT = ease.out;

type Props = {
  moment: Moment;
  progress: SharedValue<number>;
  reducedMotion: boolean;
  onPress: () => void;
};

// Time stamp, place, weather, then the narration revealed word by word.
// Every word is laid out from the start (opacity 0), so lines never reflow.
export function KineticCaption({ moment, progress, reducedMotion, onPress }: Props) {
  const text = moment.narration ?? moment.caption ?? '';
  const { words } = useMemo(() => splitWords(text), [text]);

  const meta: { key: string; text: string; style: object }[] = [
    { key: 'time', text: formatTime(moment.startAt), style: styles.stamp },
    ...(moment.placeName ? [{ key: 'place', text: moment.placeName, style: styles.place }] : []),
    ...(moment.weather
      ? [{ key: 'wx', text: `${Math.round(moment.weather.tempF)}° ${moment.weather.summary}`, style: styles.muted }]
      : []),
    ...(moment.isGoldenHour ? [{ key: 'gold', text: 'Golden hour', style: styles.golden }] : []),
  ];

  return (
    <Animated.View entering={FadeIn.duration(320).easing(EASE_OUT)} exiting={FadeOut.duration(200)}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${moment.placeName ?? 'Stop'}. ${text}`}>
        <View style={styles.meta}>
          {meta.map((m, i) => (
            <Animated.Text
              key={m.key}
              entering={FadeIn.duration(280).delay(80 * i).easing(EASE_OUT)}
              style={m.style}
              numberOfLines={1}
            >
              {m.text}
            </Animated.Text>
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
      transform: reducedMotion ? [] : [{ translateY: (1 - t) * 6 }],
    };
  });
  return <Animated.Text style={[styles.word, style]}>{word} </Animated.Text>;
}

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space.md, rowGap: space.xs, marginBottom: space.sm },
  stamp: { ...type.stamp },
  place: { ...type.label },
  muted: { ...type.callout, color: colors.textMuted },
  golden: { ...type.callout, color: colors.accent },
  words: { flexDirection: 'row', flexWrap: 'wrap' },
  word: {
    ...type.story,
    fontSize: 24,
    lineHeight: 32,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});
