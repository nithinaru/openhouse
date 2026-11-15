// "finding your people…" — a short beat between the permission and the list. Matched
// friends pop into a loose collage one by one, each with a selection tick, then one
// success notification when the count lands.

import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, Keyframe, ReduceMotion } from 'react-native-reanimated';

import { colors, duration, ease, space, type } from '@/theme';
import { Sticker } from '@/theme/ui';

import { Avatar } from './Avatar';
import type { Person } from './people';

// Loose ring around the centre, as offsets in points. First slot is the middle.
const SLOTS = [
  { x: 0, y: 0, s: 104, r: -4 },
  { x: -96, y: -70, s: 76, r: 6 },
  { x: 98, y: -64, s: 80, r: -5 },
  { x: -110, y: 52, s: 72, r: -3 },
  { x: 104, y: 60, s: 74, r: 4 },
  { x: -12, y: -128, s: 64, r: 3 },
  { x: 8, y: 122, s: 66, r: -6 },
];

const STEP = 240;

const popIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.9 }] },
  60: { opacity: 1, transform: [{ scale: 1.04 }], easing: ease.out },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: ease.out },
})
  .duration(duration.base)
  .reduceMotion(ReduceMotion.System);

export function FindingView({ people, total, onDone }: { people: Person[] | null; total: number; onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  const crowd = (people ?? []).slice(0, SLOTS.length);
  const finished = people !== null && shown >= crowd.length;

  useEffect(() => {
    if (people === null) return;
    const list = people.slice(0, SLOTS.length);
    const timers: ReturnType<typeof setTimeout>[] = [];
    list.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setShown(i + 1);
          void Haptics.selectionAsync().catch(() => {}); // same tick the avatar mounts
        }, 260 + i * STEP),
      );
    });
    const landed = 260 + list.length * STEP;
    timers.push(
      setTimeout(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }, landed),
    );
    timers.push(setTimeout(() => done.current(), landed + 900));
    return () => timers.forEach(clearTimeout);
  }, [people]);

  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        {crowd.slice(0, shown).map((p, i) => {
          const s = SLOTS[i];
          return (
            <View
              key={p.id}
              style={[styles.slot, { transform: [{ translateX: s.x - s.s / 2 }, { translateY: s.y - s.s / 2 }, { rotate: `${s.r}deg` }] }]}
            >
              <Animated.View entering={popIn} style={{ alignItems: 'center' }}>
                <Avatar uri={p.uri} initials={p.initials} tint={p.tint} size={s.s} />
                {i < 3 ? <Sticker label={p.first} small rotate={i % 2 ? 5 : -5} style={styles.tag} /> : null}
              </Animated.View>
            </View>
          );
        })}
      </View>

      <View style={styles.copy} accessibilityLiveRegion="polite">
        {finished ? (
          <Animated.View key="found" entering={FadeIn.duration(duration.fast)} style={{ alignItems: 'center', gap: space.xs }}>
            <Text style={[type.title, styles.center]}>
              {total} {total === 1 ? 'friend is' : 'friends are'} already inside
            </Text>
            <Text style={[type.callout, styles.center, { color: colors.textMuted }]}>matched on your phone. nothing left it.</Text>
          </Animated.View>
        ) : (
          <Animated.View key="finding" entering={FadeIn.duration(duration.fast)} style={{ alignItems: 'center', gap: space.xs }}>
            <Text style={[type.title, styles.center]}>finding your people…</Text>
            <Text style={[type.callout, styles.center, { color: colors.textMuted }]}>looking through your contacts</Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg, gap: space.xl },
  stage: { width: 300, height: 300 },
  slot: { position: 'absolute', left: 150, top: 150, alignItems: 'center' },
  tag: { alignSelf: 'center', marginTop: -10 },
  copy: { minHeight: 76, alignItems: 'center' },
  center: { textAlign: 'center' },
});
