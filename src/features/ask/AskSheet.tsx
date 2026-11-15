import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/features/home/PressableScale';
import { pickVoice } from '@/features/replay/narrator';
import { EASE_OUT } from '@/features/replay/film';
import type { Trip } from '@/lib/types';
import { colors, radius, space, type } from '@/theme';

import { askQuestion, type AskResult } from './askBackend';
import { CitedStopCard } from './CitedStopCard';
import { StreamedAnswer } from './StreamedAnswer';

export const SUGGESTIONS = [
  'When did I meet Rohan?',
  'Where was golden hour?',
  'What was the weather at lunch?',
  'Where did I spend the longest?',
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
      <View style={styles.grabber} />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={type.caption}>{trip.title}</Text>
          <Text style={styles.title}>Ask your day</Text>
        </View>
        <PressableScale
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={10}
          haptic="none"
          style={styles.close}
        >
          <Text style={styles.closeText}>Done</Text>
        </PressableScale>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {state.kind === 'idle' ? (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} style={{ gap: space.md }}>
            <Text style={styles.hint}>Your photos know where you were, when, and who with. Ask anything.</Text>
            <View style={styles.chips}>
              {SUGGESTIONS.map((s, i) => (
                <Animated.View key={s} entering={FadeInDown.duration(260).delay(60 + i * 45).easing(EASE_OUT)}>
                  <PressableScale
                    onPress={() => ask(s)}
                    accessibilityRole="button"
                    scaleTo={0.96}
                    haptic="none"
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>{s}</Text>
                  </PressableScale>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        ) : (
          <View style={{ gap: space.lg }}>
            <Text style={styles.question}>{state.question}</Text>

            {state.kind === 'thinking' ? (
              <Animated.Text entering={FadeIn.duration(160)} style={styles.thinking}>
                Looking through your day…
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
                      <PressableScale
                        onPress={showMe}
                        accessibilityRole="button"
                        accessibilityLabel={speaking ? 'Stop reading' : 'Read the answer aloud'}
                        scaleTo={0.96}
                        haptic="none"
                        style={styles.showMe}
                      >
                        <Text style={styles.showMeText}>{speaking ? 'Stop' : 'Show me'}</Text>
                      </PressableScale>
                      <Text style={styles.source}>
                        {state.result.source === 'claude' ? 'Answered by Claude from your memories' : 'Answered on this phone'}
                      </Text>
                    </View>

                    <View style={[styles.chips, { marginTop: space.md }]}>
                      {SUGGESTIONS.filter((s) => s !== state.question).map((s) => (
                        <PressableScale
                          key={s}
                          onPress={() => ask(s)}
                          accessibilityRole="button"
                          scaleTo={0.96}
                          haptic="none"
                          style={[styles.chip, styles.chipSmall]}
                        >
                          <Text style={[styles.chipText, { fontSize: 14 }]}>{s}</Text>
                        </PressableScale>
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
          placeholder="When did I…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={() => ask(text)}
          submitBehavior="blurAndSubmit"
          autoCorrect
          accessibilityLabel="Ask a question about this day"
        />
        <PressableScale
          onPress={() => ask(text)}
          disabled={!text.trim()}
          accessibilityRole="button"
          accessibilityLabel="Ask"
          scaleTo={0.94}
          haptic="none"
          style={[styles.send, !text.trim() && { opacity: 0.4 }]}
        >
          <Text style={styles.sendText}>Ask</Text>
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
    marginTop: space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  title: { ...type.title, letterSpacing: -0.6, marginTop: 2 },
  close: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.surface },
  closeText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  body: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xl },
  hint: { ...type.body, color: colors.textMuted, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  chipSmall: { minHeight: 38 },
  chipText: { color: colors.text, fontSize: 15, fontWeight: '500' },
  question: { fontSize: 15, fontWeight: '600', color: colors.accent },
  thinking: { ...type.body, color: colors.textMuted },
  answerActions: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  showMe: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  showMeText: { color: '#1A1408', fontSize: 16, fontWeight: '700' },
  source: { flex: 1, fontSize: 12, color: colors.textMuted },
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
    minHeight: 46,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
  },
  send: {
    minHeight: 46,
    minWidth: 60,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  sendText: { color: '#1A1408', fontSize: 16, fontWeight: '700' },
});
