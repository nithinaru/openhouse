// "who was there?" — the contacts ask, after onboarding o3: a collage of friend
// cutouts with pink sticker tags, one black pill, one quiet way out.

import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, duration, ease, space, type } from '@/theme';
import { StarDoodleIcon } from '@/theme/icons';
import { Button, CloseButton, Sticker } from '@/theme/ui';

import { CutoutCard } from './Avatar';
import { face, TINTS } from './people';

type Card = { x: number; y: number; w: number; h: number; rot: number; img: number; initials: string };

// Fractions of the collage width. Overlapping, a little crooked, like o3.
const CARDS: Card[] = [
  { x: 0.33, y: 0.0, w: 0.33, h: 0.4, rot: 4, img: 47, initials: 'mc' },
  { x: 0.02, y: 0.05, w: 0.34, h: 0.4, rot: -6, img: 13, initials: 'r' },
  { x: 0.64, y: 0.06, w: 0.34, h: 0.4, rot: -3, img: 12, initials: 'tp' },
  { x: 0.0, y: 0.46, w: 0.34, h: 0.4, rot: 3, img: 44, initials: 'ia' },
  { x: 0.64, y: 0.47, w: 0.34, h: 0.4, rot: 5, img: 49, initials: 'pn' },
  { x: 0.31, y: 0.38, w: 0.38, h: 0.44, rot: -2, img: 33, initials: 'jo' },
];

type Tag = { x: number; y: number; label: string; rot: number; tone: 'pink' | 'paper'; delay: number };
const TAGS: Tag[] = [
  { x: 0.03, y: 0.36, label: 'rohan ✓', rot: -6, tone: 'pink', delay: 0 },
  { x: 0.66, y: 0.38, label: 'theo ✓', rot: 5, tone: 'pink', delay: 700 },
  { x: 0.36, y: 0.75, label: '+ add jules', rot: -3, tone: 'paper', delay: 1300 },
];

const pop = (i: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.9 }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: ease.out },
  })
    .duration(duration.enter)
    .delay(80 + i * 70)
    .reduceMotion(ReduceMotion.System);

export function AskView({
  mode,
  busy,
  onSync,
  onNotNow,
  onOpenSettings,
  onSample,
}: {
  mode: 'ask' | 'denied';
  busy: boolean;
  onSync: () => void;
  onNotNow: () => void;
  onOpenSettings: () => void;
  onSample: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [box, setBox] = useState({ w: 0, h: 0 });
  // Fit the collage to whatever room the copy and buttons leave, on any phone size.
  const w = Math.floor(Math.min(box.w, box.h / 0.92));
  const h = Math.round(w * 0.9);

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }]}>
      <View style={styles.top}>
        <CloseButton onPress={onNotNow} />
      </View>

      <View style={styles.copy}>
        <Text style={[type.display, styles.center]} accessibilityRole="header">
          {mode === 'ask' ? 'who was\nthere?' : 'no worries.'}
        </Text>
        <Text style={[type.body, styles.center, { color: colors.textMuted }]}>
          {mode === 'ask'
            ? 'connect your contacts to see the day from where your friends stood.'
            : 'wish you were here only reads names on your phone to find your friends. turn contacts on in settings, or peek with sample friends.'}
        </Text>
      </View>

      <View style={styles.collageWrap} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {w > 0 ? (
          <View style={{ width: w, height: h }}>
            <View style={[styles.star, { left: w * 0.0, top: -6 }]}>
              <StarDoodleIcon size={26} color={colors.text} />
            </View>
            <View style={[styles.star, { right: w * 0.02, top: h * 0.88 }]}>
              <StarDoodleIcon size={22} color={colors.text} />
            </View>
            {CARDS.map((c, i) => (
              <Animated.View key={c.img} entering={pop(i)} style={{ position: 'absolute', left: c.x * w, top: c.y * w }}>
                <CutoutCard
                  uri={face(c.img)}
                  initials={c.initials}
                  tint={TINTS[i % TINTS.length]}
                  width={Math.round(c.w * w)}
                  height={Math.round(c.h * w)}
                  rotate={c.rot}
                />
              </Animated.View>
            ))}
            {TAGS.map((t, i) => (
              <Animated.View
                key={t.label}
                entering={pop(CARDS.length + i)}
                style={{ position: 'absolute', left: t.x * w, top: t.y * w }}
              >
                <Floating delay={t.delay}>
                  <Sticker label={t.label} rotate={t.rot} tone={t.tone} />
                </Floating>
              </Animated.View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        {mode === 'ask' ? (
          <>
            <Button label="sync contacts" onPress={onSync} loading={busy} />
            <Button label="not now" variant="quiet" onPress={onNotNow} />
          </>
        ) : (
          <>
            <Button label="open settings" onPress={onOpenSettings} />
            <Button label="use sample friends" variant="secondary" onPress={onSample} />
          </>
        )}
        <Text style={[type.caption, styles.center, { color: colors.textFaint }]}>
          {mode === 'ask' ? 'rohan, theo + 4 others are already inside' : 'matched on your phone. nothing is uploaded.'}
        </Text>
      </View>
    </View>
  );
}

/** A slow 3pt bob, so the tags feel stuck on loosely. Still under reduced motion. */
function Floating({ delay, children }: { delay: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    y.set(
      withDelay(
        delay,
        withRepeat(withTiming(-3, { duration: 1800, easing: Easing.bezier(0.45, 0, 0.55, 1) }), -1, true),
      ),
    );
  }, [delay, reduced, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.lg },
  top: { flexDirection: 'row', justifyContent: 'flex-start', minHeight: 44 },
  copy: { gap: space.sm, alignItems: 'center', paddingHorizontal: space.sm, marginTop: space.xs },
  center: { textAlign: 'center' },
  collageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: space.md, marginHorizontal: -space.sm },
  star: { position: 'absolute', zIndex: 2 },
  actions: { gap: space.xs },
});
