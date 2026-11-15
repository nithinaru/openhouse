// Demo: the "was there" owners chat, unlocked by buying the hoodie on Whop.
// Hardcoded messages; sending appends locally.

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, FLOOR_PHOTO, WHOP_ORANGE } from '@/features/whop/parts';
import { colors, fonts, radius, space, type } from '@/theme';
import { CloseButton, haptic, Press, Sticker } from '@/theme/ui';

type Msg = {
  id: string;
  from: string;
  personId?: string;
  time: string;
  text?: string;
  photo?: string;
  sticker?: string;
  mine?: boolean;
};

const SEED: Msg[] = [
  { id: '1', from: 'rohan', personId: 'rohan', time: '8:02 pm', text: 'hoodie just landed in my cart. who else' },
  { id: '2', from: 'ines', personId: 'ines', time: '8:03 pm', text: 'me. the back print is our whole day lol' },
  { id: '3', from: 'sol', personId: 'sol', time: '8:05 pm', text: 'found myself by the stairs at 9:15' },
  { id: '4', from: 'maya', time: '8:06 pm', text: 'wait you can see where everyone stood??' },
  { id: '5', from: 'rohan', personId: 'rohan', time: '8:07 pm', photo: FLOOR_PHOTO, text: 'hacking floor, 10 am. my angle' },
  { id: '6', from: 'ines', personId: 'ines', time: '8:09 pm', sticker: 'was there' },
  { id: '7', from: 'dev', time: '8:11 pm', text: 'demo team table 14 reporting in' },
  { id: '8', from: 'sol', personId: 'sol', time: '8:12 pm', text: 'replay with sound on during finalist demos was unreal' },
  { id: '9', from: 'ines', personId: 'ines', time: '8:14 pm', text: 'same time next year, same hoodie' },
];

function nowClock() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

export default function OwnersChat() {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [msgs, setMsgs] = useState<Msg[]>(SEED);
  const [draft, setDraft] = useState('');
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    haptic('medium');
    setMsgs((m) => [...m, { id: String(Date.now()), from: 'you', time: nowClock(), text, mine: true }]);
    setDraft('');
    requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true }));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={type.heading}>owners of the was there hoodie · 113</Text>
          <View style={styles.lock}>
            <View style={styles.lockIcon}>
              <View style={styles.lockShackle} />
              <View style={styles.lockBody} />
            </View>
            <Text style={styles.lockText}>unlocked by your purchase · whop</Text>
          </View>
        </View>
        <CloseButton onPress={close} />
      </View>

      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.md, gap: space.md }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
      >
        <Text style={[type.stamp, { textAlign: 'center' }]}>today · yc hackathon</Text>
        {msgs.map((m, i) => (
          <Animated.View
            key={m.id}
            entering={reduced || i < SEED.length ? undefined : FadeInDown.duration(220)}
            style={[styles.row, m.mine && { justifyContent: 'flex-end' }]}
          >
            {!m.mine ? <Avatar id={m.personId} name={m.from} size={34} /> : null}
            <View style={{ maxWidth: '78%', gap: 4, alignItems: m.mine ? 'flex-end' : 'flex-start' }}>
              <Text style={type.stamp}>
                {m.from} · {m.time}
              </Text>
              {m.photo ? <Image source={{ uri: m.photo }} style={styles.photo} contentFit="cover" transition={200} /> : null}
              {m.sticker ? <Sticker label={m.sticker} rotate={-6} /> : null}
              {m.text ? (
                <View style={[styles.bubble, m.mine && styles.bubbleMine]}>
                  <Text style={[type.callout, m.mine && { color: colors.accentInk }]}>{m.text}</Text>
                </View>
              ) : null}
            </View>
          </Animated.View>
        ))}
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + space.sm }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="say something to the owners"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Press onPress={send} haptic="none" accessibilityRole="button" accessibilityLabel="send" disabled={!draft.trim()}>
          <View style={[styles.send, !draft.trim() && { opacity: 0.4 }]}>
            <Text style={styles.sendText}>send</Text>
          </View>
        </Press>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.md, backgroundColor: colors.sky },
  lock: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.ink, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  lockIcon: { width: 10, height: 12, alignItems: 'center' },
  lockShackle: { width: 7, height: 6, borderWidth: 1.6, borderBottomWidth: 0, borderColor: WHOP_ORANGE, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  lockBody: { width: 10, height: 6, borderRadius: 1.5, backgroundColor: WHOP_ORANGE },
  lockText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accentInk, textTransform: 'lowercase' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  bubble: { backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg, borderBottomLeftRadius: 6 },
  bubbleMine: { backgroundColor: colors.ink, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: 6 },
  photo: { width: 220, height: 150, borderRadius: radius.md, borderWidth: 4, borderColor: colors.bg, backgroundColor: colors.surface, transform: [{ rotate: '-2deg' }] },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  input: { flex: 1, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.full, backgroundColor: colors.surface, fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  send: { height: 44, paddingHorizontal: space.md, borderRadius: radius.full, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontFamily: fonts.bold, fontSize: 15, color: colors.accentInk, textTransform: 'lowercase' },
});
