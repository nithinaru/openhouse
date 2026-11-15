import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/features/home/PressableScale';
import { DEMO_MY_NAME } from '@/features/people/pair';
import { PairCelebration } from '@/features/people/PairCelebration';
import { OrderConfirmed } from '@/features/poster/OrderConfirmed';
import { stopSpeech } from '@/features/replay/narrator';
import { plural } from '@/features/replay/stats';
import { DEMO_TRIP_ID, demoTrip } from '@/lib/demo/demoTrip';
import { colors, radius, space, type } from '@/theme';

import { demoFlags, useDemoFlags } from './demoFlags';
import { backendHost, probeBackend, scheduleKeikiText, type BackendStatus } from './simulate';

type Overlay = 'pair' | 'paid' | null;

// Hidden rehearsal panel (long-press the Openhouse wordmark on Home).
export function DemoPanel() {
  const insets = useSafeAreaInsets();
  const flags = useDemoFlags();
  const [status, setStatus] = useState<BackendStatus>({ state: 'checking' });
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [note, setNote] = useState<string | null>(null);

  const probe = useCallback(async () => {
    setStatus({ state: 'checking' });
    setStatus(await probeBackend());
  }, []);

  useEffect(() => {
    let alive = true;
    void probeBackend().then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, []);

  // Transient confirmation line under the buttons.
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 2600);
    return () => clearTimeout(t);
  }, [note]);

  const loadDemoTrip = () => {
    router.back();
    router.push({ pathname: '/trip/[id]', params: { id: DEMO_TRIP_ID } });
  };

  const resetOnboarding = () => {
    demoFlags.set({ onboardingReset: true, friendPaired: false, orderPaid: false });
    router.back();
    router.push('/onboarding');
  };

  const simulatePair = () => {
    demoFlags.set({ friendPaired: true });
    setOverlay('pair');
  };

  const simulatePaid = () => {
    demoFlags.set({ orderPaid: true });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setOverlay('paid');
  };

  const keiki = async () => {
    const r = await scheduleKeikiText(demoTrip);
    setNote(
      r === 'scheduled'
        ? 'Keiki text lands in 3 s. Lock the phone or go Home.'
        : r === 'denied'
          ? 'Notifications are off for Expo Go. Turn them on in Settings.'
          : 'Could not schedule the notification.',
    );
  };

  const toggleNarrator = (on: boolean) => {
    demoFlags.set({ narratorOn: on });
    if (!on) void stopSpeech();
  };

  const friend = demoTrip.people[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={type.caption}>Rehearsal only</Text>
            <Text style={styles.title}>Demo mode</Text>
          </View>
          <PressableScale onPress={() => router.back()} haptic="none" accessibilityRole="button" hitSlop={10} style={styles.done}>
            <Text style={styles.doneText}>Done</Text>
          </PressableScale>
        </View>

        <StatusBlock status={status} onRetry={probe} />

        <Section title="Stage">
          <Action label="Load demo trip" detail="Opens the YC day Replay, cached on the phone" onPress={loadDemoTrip} primary />
          <Action label="Reset onboarding" detail="Back to “Let Openhouse read your photos”" onPress={resetOnboarding} />
        </Section>

        <Section title="Simulate">
          <Action
            label="Simulate friend pair"
            detail={flags.friendPaired ? `Paired with ${friend?.name ?? 'friend'} · tap to replay` : 'Plays the pairing celebration'}
            onPress={simulatePair}
            on={flags.friendPaired}
          />
          <Action
            label="Simulate order paid"
            detail={flags.orderPaid ? 'Order marked paid' : 'Marks the print order paid, shows the confirmation'}
            onPress={simulatePaid}
            on={flags.orderPaid}
          />
          <Action label="Simulate Keiki text" detail="Local notification in 3 s" onPress={keiki} />
          {note ? (
            <Animated.Text entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={styles.note}>
              {note}
            </Animated.Text>
          ) : null}
        </Section>

        <Section title="Sound">
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Narrator voice</Text>
              <Text style={styles.detail}>{flags.narratorOn ? 'On · Replay reads the story aloud' : 'Off · captions only'}</Text>
            </View>
            <Switch
              value={flags.narratorOn}
              onValueChange={toggleNarrator}
              trackColor={{ true: colors.accent, false: colors.line }}
              accessibilityLabel="Narrator voice"
            />
          </View>
        </Section>

        <PressableScale
          onPress={() => {
            demoFlags.reset();
            setNote('All switches reset.');
          }}
          haptic="none"
          accessibilityRole="button"
          style={styles.resetAll}
        >
          <Text style={styles.resetAllText}>Reset all switches</Text>
        </PressableScale>
      </ScrollView>

      {overlay ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, styles.overlay, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]}>
          {overlay === 'pair' && friend ? (
            <PairCelebration me={{ name: DEMO_MY_NAME }} friend={{ name: friend.name, avatarUri: friend.avatarUri }} onAgain={() => setOverlay(null)} />
          ) : null}
          {overlay === 'paid' ? (
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <OrderConfirmed palette={demoTrip.palette} detail="18×24 · Natural oak · ships in 3–5 days" />
            </View>
          ) : null}
          <PressableScale onPress={() => setOverlay(null)} haptic="none" accessibilityRole="button" style={styles.overlayClose}>
            <Text style={styles.doneText}>Close</Text>
          </PressableScale>
        </Animated.View>
      ) : null}
    </View>
  );
}

function StatusBlock({ status, onRetry }: { status: BackendStatus; onRetry: () => void }) {
  const dot = status.state === 'online' ? '#5BBF7A' : status.state === 'offline' ? '#C2593B' : colors.textMuted;
  const line =
    status.state === 'checking'
      ? 'Checking backend…'
      : status.state === 'online'
        ? `Convex responding · ${status.ms} ms${status.trips != null ? ` · ${plural(status.trips, 'trip')}` : ''}${status.note ? ` · ${status.note}` : ''}`
        : `Backend not responding (${status.reason}). Demo trip and answers run on the phone.`;
  return (
    <PressableScale onPress={onRetry} haptic="light" accessibilityRole="button" accessibilityHint="Checks the backend again" style={styles.status}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.label}>{line}</Text>
        <Text style={styles.detail}>{backendHost} · tap to recheck</Text>
      </View>
    </PressableScale>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.section}>{title}</Text>
      {children}
    </View>
  );
}

function Action({
  label,
  detail,
  onPress,
  primary,
  on,
}: {
  label: string;
  detail: string;
  onPress: () => void;
  primary?: boolean;
  on?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" style={[styles.action, primary && styles.actionPrimary]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.label, primary && { color: '#1A1408' }]}>{label}</Text>
        <Text style={[styles.detail, primary && { color: 'rgba(26,20,8,0.7)' }]}>{detail}</Text>
      </View>
      {on ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'flex-end' },
  title: { ...type.title, letterSpacing: -0.6, marginTop: 2 },
  done: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.surface },
  doneText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  section: { ...type.caption, fontWeight: '600', marginLeft: 2 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  actionPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
  detail: { fontSize: 13, color: colors.textMuted },
  note: { ...type.caption, color: colors.accent, marginLeft: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  resetAll: { alignSelf: 'center', paddingVertical: space.md, paddingHorizontal: space.lg },
  resetAllText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  overlay: { backgroundColor: colors.bg, paddingHorizontal: space.lg, gap: space.lg },
  overlayClose: {
    alignSelf: 'center',
    minHeight: 44,
    paddingHorizontal: space.xl,
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
});
