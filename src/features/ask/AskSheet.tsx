import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pickVoice } from '@/features/replay/narrator';
import type { Trip } from '@/lib/types';
import { colors, ease, fonts, radius, size, space, type } from '@/theme';
import { ArrowIcon, SpeakerIcon } from '@/theme/icons';
import { Button, Chip, Press, SheetHeader, Sticker } from '@/theme/ui';

import { askQuestion, type AskResult } from './askBackend';
import { CitedStopCard } from './CitedStopCard';
import { StreamedAnswer } from './StreamedAnswer';

const EASE_OUT = ease.out;

export const SUGGESTIONS = [
  'when did i meet rohan?',
  'where was golden hour?',
  'what was the weather at lunch?',
  'where did i spend the longest?',
];

type State =
  | { kind: 'idle' }
  | { kind: 'thinking'; question: string }
  | { kind: 'answer'; question: string; result: AskResult; streamed: boolean };

export function AskSheet({ trip, initialQuestion }: { trip: Trip; initialQuestion?: string }) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [speaking, setSpeaking] = useState(false);
  const reqId = useRef(0);

  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void Speech.stop();
      setSpeaking(false);
      setText('');
      const id = ++reqId.current;
      setState({ kind: 'thinking', question });
      const result = await askQuestion(trip, question);
      if (id !== reqId.current) return; // a newer question won
      setState({ kind: 'answer', question, result, streamed: false });
    },
    [trip],
  );

  // Deep-link / demo: /ask/<id>?q=... asks straight away.
  const asked = useRef(false);
  useEffect(() => {
    if (initialQuestion && !asked.current) {
      asked.current = true;
      void ask(initialQuestion);
    }
  }, [initialQuestion, ask]);

  useEffect(() => () => void Speech.stop(), []);

  const onStreamed = useCallback(() => {
    setState((s) => (s.kind === 'answer' ? { ...s, streamed: true } : s));
  }, []);

  const showMe = async () => {
    if (state.kind !== 'answer') return;
    if (speaking) {
      void Speech.stop();
      setSpeaking(false);
      return;
    }
    void Haptics.selectionAsync();
    setSpeaking(true);
    const voice = await pickVoice();
    Speech.speak(state.result.answer, {
      language: 'en-US',
      voice,
      rate: Platform.OS === 'ios' ? 0.9 : 0.92,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const openStop = (momentId: string) =>
    router.push({ pathname: '/stop/[id]', params: { id: momentId, tripId: trip.id } });

  const cited =
    state.kind === 'answer'
      ? state.result.momentIds
          .map((id) => trip.moments.find((m) => m.id === id))
          .filter((m): m is NonNullable<typeof m> => !!m)
      : [];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <SheetHeader eyebrow={trip.title} title="ask your day" onClose={() => router.back()} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {state.kind === 'idle' ? (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} style={{ gap: space.md }}>
            <Text style={styles.hint}>your photos know where you were, when, and who with. ask anything.</Text>
            <View style={styles.chips}>
              {SUGGESTIONS.map((s, i) => (
                <Animated.View key={s} entering={FadeInDown.duration(260).delay(60 + i * 45).easing(EASE_OUT)}>
                  <Chip label={s} onPress={() => ask(s)} textStyle={styles.chipText} />
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        ) : (
          <View style={{ gap: space.lg }}>
            <Sticker label={state.question} rotate={-2} style={{ maxWidth: '100%' }} />

            {state.kind === 'thinking' ? (
              <Animated.Text entering={FadeIn.duration(160)} style={styles.thinking}>
                looking through your day…
              </Animated.Text>
            ) : (
              <>
                <StreamedAnswer key={state.result.answer + state.question} text={state.result.answer} onDone={onStreamed} />

                {state.streamed ? (
                  <Animated.View entering={FadeInDown.duration(280).easing(EASE_OUT)} style={{ gap: space.sm }}>
                    {cited.map((m) => (
                      <CitedStopCard key={m.id} moment={m} onPress={() => openStop(m.id)} />
                    ))}

                    <View style={styles.answerActions}>
                      <Button
                        variant="secondary"
                        label={speaking ? 'stop' : 'read aloud'}
                        accessibilityLabel={speaking ? 'stop reading' : 'read the answer aloud'}
                        onPress={showMe}
                        trailing={<SpeakerIcon color={colors.text} />}
                        style={styles.showMe}
                      />
                      <Text style={styles.source}>
                        {state.result.source === 'claude' ? 'answered by claude from your memories' : 'answered on this phone'}
                      </Text>
                    </View>

                    <View style={[styles.chips, { marginTop: space.md }]}>
                      {SUGGESTIONS.filter((s) => s !== state.question).map((s) => (
                        <Chip key={s} label={s} onPress={() => ask(s)} />
                      ))}
                    </View>
                  </Animated.View>
                ) : null}
              </>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="when did i…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={() => ask(text)}
          submitBehavior="blurAndSubmit"
          autoCorrect
          accessibilityLabel="ask a question about this day"
        />
        <Press
          onPress={() => ask(text)}
          disabled={!text.trim()}
          accessibilityRole="button"
          accessibilityLabel="ask"
          scaleTo={0.92}
          haptic="none"
          style={[styles.send, !text.trim() && { opacity: 0.4 }]}
        >
          <ArrowIcon color={colors.accentInk} />
        </Press>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  body: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xl },
  hint: { ...type.body, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chipText: { fontSize: 15, lineHeight: 20 },
  thinking: { ...type.body, color: colors.textMuted },
  answerActions: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  showMe: { minHeight: size.hit, paddingHorizontal: space.md },
  source: { flex: 1, ...type.caption },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    minHeight: size.hit,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 17,
  },
  send: {
    width: size.hit,
    height: size.hit,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: size.hit / 2,
    backgroundColor: colors.accent,
  },
});
