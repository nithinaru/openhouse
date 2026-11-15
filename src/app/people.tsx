import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PairCelebration } from '@/features/people/PairCelebration';
import { DEMO_MY_NAME, DEMO_MY_SHARE_CODE, pair, parsePairCode, type PairResult } from '@/features/people/pair';
import { QrCard } from '@/features/people/QrCard';
import { Viewfinder } from '@/features/people/Viewfinder';
import { EASE_OUT } from '@/features/stop/motion';
import { PressScale } from '@/features/stop/PressScale';
import { colors, radius, space, type } from '@/theme';

type Tab = 'code' | 'scan';
const TABS: Tab[] = ['code', 'scan'];
const ME = { name: DEMO_MY_NAME }; // TODO(convex): api.users.me (name + avatar)

export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('code');
  // Hidden rehearsal switch: long-press the title to preview the pairing celebration.
  const [preview, setPreview] = useState<PairResult | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg, paddingHorizontal: space.lg, gap: space.lg }}>
      <Pressable
        delayLongPress={700}
        onLongPress={async () => {
          Haptics.selectionAsync();
          setPreview(preview ? null : await pair('RHN42X', 0, 0));
        }}
      >
        <Text style={type.title}>People</Text>
        <Text style={[type.caption, { marginTop: 2 }]}>Scan each other to share the day.</Text>
      </Pressable>

      <Segmented value={tab} onChange={setTab} />

      {preview ? (
        <PairCelebration key={`preview-${preview.shareCode}`} me={ME} friend={{ name: preview.friendName, avatarUri: preview.avatarUri }} onAgain={() => setPreview(null)} />
      ) : tab === 'code' ? (
        <Animated.View key="code" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm }}>
          {/* TODO(convex): name + shareCode from api.users.me. */}
          <QrCard name={DEMO_MY_NAME} code={DEMO_MY_SHARE_CODE} />
          <Text style={[type.caption, { textAlign: 'center', maxWidth: 260 }]}>Have a friend scan this. You’ll each show up on the other’s map, right where you met.</Text>
        </Animated.View>
      ) : (
        <Animated.View key="scan" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={{ flex: 1 }}>
          <Scanner />
        </Animated.View>
      )}
    </View>
  );
}

function Segmented({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const idx = TABS.indexOf(value);

  useEffect(() => {
    x.set(withTiming(idx, { duration: 200, easing: EASE_OUT }));
  }, [idx, x]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() * (w / TABS.length) }] }));

  return (
    <View style={styles.segment} onLayout={(e) => setW(e.nativeEvent.layout.width - space.xs * 2)}>
      {w > 0 ? <Animated.View style={[styles.segmentPill, { width: w / TABS.length }, pill]} /> : null}
      {TABS.map((t) => (
        <Pressable
          key={t}
          onPress={() => {
            if (t === value) return;
            Haptics.selectionAsync();
            onChange(t);
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === t }}
          style={{ flex: 1, alignItems: 'center', paddingVertical: space.sm + 2 }}
        >
          <Text style={[type.body, { fontWeight: '600', color: value === t ? colors.text : colors.textMuted }]}>{t === 'code' ? 'My code' : 'Scan'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

type ScanState = { kind: 'scanning' } | { kind: 'pairing' } | { kind: 'paired'; result: PairResult } | { kind: 'error'; message: string };

function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>({ kind: 'scanning' });
  // onBarcodeScanned fires many times per second; a ref blocks re-entry before state updates land.
  const lock = useRef(false);

  async function onScanned({ data }: BarcodeScanningResult) {
    if (lock.current) return;
    lock.current = true;

    const code = parsePairCode(data);
    if (!code) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setState({ kind: 'error', message: 'That is not an Openhouse code.' });
      return;
    }

    Haptics.selectionAsync(); // the viewfinder locks on this frame
    setState({ kind: 'pairing' });
    try {
      const loc = await Location.requestForegroundPermissionsAsync();
      if (!loc.granted) {
        setState({ kind: 'error', message: 'Location is needed to drop a pin where you met.' });
        return;
      }
      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: 60_000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const result = await pair(code, pos.coords.latitude, pos.coords.longitude);
      // The medium haptic fires inside PairCelebration, the moment the avatars meet.
      setState({ kind: 'paired', result });
    } catch (e) {
      console.warn('[people] pair failed', e);
      setState({ kind: 'error', message: 'Could not pair. Try again.' });
    }
  }

  function reset() {
    lock.current = false;
    setState({ kind: 'scanning' });
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { gap: space.md }]}>
        <Text style={[type.body, { textAlign: 'center' }]}>Openhouse needs the camera to scan a friend’s code.</Text>
        {permission.canAskAgain ? (
          <PrimaryButton label="Allow camera" onPress={requestPermission} />
        ) : (
          <PrimaryButton label="Open Settings" onPress={() => Linking.openSettings()} />
        )}
      </View>
    );
  }

  if (state.kind === 'paired') {
    return <PairCelebration me={ME} friend={{ name: state.result.friendName, avatarUri: state.result.avatarUri }} onAgain={reset} />;
  }

  return (
    <View style={{ flex: 1, gap: space.md }}>
      <View style={{ flex: 1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={state.kind === 'scanning' ? onScanned : undefined}
        />
        <Viewfinder locked={state.kind === 'pairing'} />
        {state.kind === 'pairing' && (
          <Animated.View entering={FadeIn.duration(160)} style={styles.pairing}>
            <ActivityIndicator color={colors.text} />
            <Text style={[type.caption, { color: colors.text }]}>Pairing…</Text>
          </Animated.View>
        )}
      </View>
      {state.kind === 'error' ? (
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <Text style={type.caption}>{state.message}</Text>
          <PrimaryButton label="Try again" onPress={reset} />
        </View>
      ) : (
        <Text style={[type.caption, { textAlign: 'center' }]}>Point at a friend’s Openhouse code.</Text>
      )}
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" style={styles.primary}>
      <Text style={[type.body, { color: colors.bg, fontWeight: '600' }]}>{label}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.full, padding: space.xs },
  segmentPill: { position: 'absolute', top: space.xs, bottom: space.xs, left: space.xs, borderRadius: radius.full, backgroundColor: colors.line },
  pairing: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: space.lg,
    alignItems: 'center',
    gap: space.xs,
  },
  primary: { paddingVertical: space.sm + 4, paddingHorizontal: space.lg, borderRadius: radius.full, backgroundColor: colors.accent },
});
