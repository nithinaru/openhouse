import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, shadow } from '@/theme';
import { Sticker } from '@/theme/ui';

// Room label on the house: "hacking floor · 1,108". The room you're looking at gets the
// pink sticker; rooms already lived in are white pills; rooms the day hasn't reached
// yet are dashed paper prompts.

export function RoomSticker({ label, frames, state, rotate }: { label: string; frames: number; state: 'here' | 'seen' | 'later'; rotate: number }) {
  const text = state === 'later' ? `${label} · later` : `${label} · ${frames.toLocaleString('en-US')}`;
  if (state === 'here') return <Sticker label={text} rotate={rotate} />;
  if (state === 'later') return <Sticker label={text} tone="paper" small rotate={rotate} />;
  return (
    <View style={[styles.pill, { transform: [{ rotate: `${rotate}deg` }] }]} accessible accessibilityLabel={text}>
      <Text style={styles.text} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** The pin a room's sticker hangs off. */
export function RoomPin({ active }: { active: boolean }) {
  return <View style={[styles.pin, active && styles.pinActive]} />;
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    ...shadow.chip,
  },
  text: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: -0.3, color: colors.text, textTransform: 'lowercase' },
  pin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.ink,
    borderWidth: 2.5,
    borderColor: colors.bg,
    ...shadow.chip,
  },
  pinActive: { backgroundColor: colors.pinkEdge },
});
