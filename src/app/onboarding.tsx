import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEMO_TRIP_ID } from '@/lib/demo/demoTrip';
import { IngestError, ingestRecent, type IngestProgress } from '@/lib/ingest/readLibrary';
import { setTrip } from '@/lib/ingest/store';
import { colors, radius, space, type } from '@/theme';

type State =
  | { kind: 'idle' }
  | { kind: 'running'; progress: IngestProgress }
  | { kind: 'failed'; message: string };

function progressLabel(p: IngestProgress): string {
  switch (p.phase) {
    case 'permission':
      return 'Asking for access';
    case 'scanning':
      return `Looking for places · ${p.found} photos`;
    case 'reading':
    case 'naming':
    case 'done':
      return `${p.stops} ${p.stops === 1 ? 'stop' : 'stops'} found`;
  }
}

function failureMessage(e: unknown): string {
  if (e instanceof IngestError) {
    if (e.code === 'denied') return 'Openhouse needs photo access to find your stops. You can allow it in Settings.';
    if (e.code === 'no-geotagged') return 'None of your recent photos have a location.';
  }
  return 'Something went wrong reading your photos.';
}

export default function OnboardingScreen() {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const start = async () => {
    setState({ kind: 'running', progress: { phase: 'permission', found: 0, read: 0, stops: 0, limited: false } });
    try {
      const trip = await ingestRecent((progress) => setState({ kind: 'running', progress }));
      setTrip(trip);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/trip/[id]', params: { id: trip.id } });
    } catch (e) {
      console.warn('[onboarding] ingest failed', e);
      setState({ kind: 'failed', message: failureMessage(e) });
    }
  };

  const useDemo = () => router.replace({ pathname: '/trip/[id]', params: { id: DEMO_TRIP_ID } });

  const running = state.kind === 'running';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: space.lg, gap: space.md }}>
        <Text style={type.title}>Openhouse</Text>
        <Text style={type.body}>Turns today&apos;s photos into a replay of where you went.</Text>

        {running && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <ActivityIndicator color={colors.accent} />
            <Text style={type.caption}>{progressLabel(state.progress)}</Text>
          </View>
        )}
        {running && state.progress.limited && (
          <Text style={type.caption}>Using only the photos you selected.</Text>
        )}
        {state.kind === 'failed' && <Text style={type.caption}>{state.message}</Text>}
      </View>

      <View style={{ padding: space.lg, gap: space.sm }}>
        <Pressable
          accessibilityRole="button"
          disabled={running}
          onPress={start}
          style={{
            backgroundColor: colors.accent,
            borderRadius: radius.full,
            paddingVertical: space.md,
            alignItems: 'center',
            opacity: running ? 0.5 : 1,
          }}
        >
          <Text style={[type.body, { color: colors.bg }]}>
            {state.kind === 'failed' ? 'Try again' : 'Let Openhouse read your photos'}
          </Text>
        </Pressable>
        {state.kind === 'failed' && (
          <Pressable accessibilityRole="button" onPress={useDemo} style={{ paddingVertical: space.md, alignItems: 'center' }}>
            <Text style={[type.body, { color: colors.accent }]}>Use demo trip</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
