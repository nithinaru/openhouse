import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { SERIF } from '@/features/replay/film';
import { colors } from '@/theme';

const WORD_MS = 55; // ~18 words/s: reads as typing, a 30-word answer lands in under 2 s

/** Reveals `text` word by word. Calls onDone once the last word is out. */
export function StreamedAnswer({ text, onDone }: { text: string; onDone?: () => void }) {
  const reduced = useReducedMotion();
  const words = useMemo(() => text.split(/(\s+)/), [text]); // keep the spaces as tokens
  const total = words.length;
  const [shown, setShown] = useState(reduced ? total : 0);

  useEffect(() => {
    // Parent keys this component by text, so state starts fresh for each answer.
    if (reduced) {
      onDone?.();
      return;
    }
    let n = 0;
    const id = setInterval(() => {
      n += 2; // word + following space
      setShown(Math.min(n, total));
      if (n >= total) {
        clearInterval(id);
        onDone?.();
      }
    }, WORD_MS);
    return () => clearInterval(id);
    // onDone is a parent callback; restarting the stream on its identity would be wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, total, reduced]);

  const streaming = shown < total;

  return (
    <View accessible accessibilityLiveRegion="polite" accessibilityLabel={text}>
      <Text style={styles.answer}>
        {words.slice(0, shown).join('')}
        {streaming ? <Text style={styles.caret}> ▍</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  answer: { fontFamily: SERIF, fontSize: 24, lineHeight: 32, color: colors.text },
  caret: { color: colors.accent, fontSize: 20 },
});
