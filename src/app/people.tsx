import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PairCelebration } from '@/features/people/PairCelebration';
import { DEMO_MY_NAME, DEMO_MY_SHARE_CODE, demoPair, pair, parsePairCode, type PairResult } from '@/features/people/pair';
import '@/features/people/pairRemote';
import { QrCard } from '@/features/people/QrCard';
import { Viewfinder } from '@/features/people/Viewfinder';
import { EASE_OUT } from '@/features/stop/motion';
import { colors, radius, space, type } from '@/theme';
import { Button, SheetHeader, SkyBackground, Sticker } from '@/theme/ui';

type Tab = 'code' | 'scan';
const TABS: Tab[] = ['code', 'scan'];
const ME = { name: DEMO_MY_NAME }; // TODO(convex): api.users.me (name + avatar)

export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('code');
  // Hidden rehearsal switch: long-press the title to preview the pairing celebration.
  const [preview, setPreview] = useState<PairResult | null>(null);

  return (
    <SkyBackground variant="fade" style={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg, paddingHorizontal: space.lg, gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <SheetHeader
          title="people"
          onTitleLongPress={() => setPreview(preview ? null : demoPair('RHN42X'))}
          right={<Sticker label="+ find friends" rotate={-3} onPress={() => router.push('/contacts')} style={{ marginTop: 4 }} />}
          onClose={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <Text style={type.caption}>scan each other to share the day</Text>
      </View>

      <Segmented value={tab} onChange={setTab} />

      {preview ? (
        <PairCelebration key={`preview-${preview.shareCode}`} me={ME} friend={{ name: preview.friendName, avatarUri: preview.avatarUri, shareCode: preview.shareCode }} onAgain={() => setPreview(null)} />
      ) : tab === 'code' ? (
        <Animated.View key="code" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm }}>
          {/* TODO(convex): name + shareCode from api.users.me. */}
          <QrCard name={DEMO_MY_NAME} code={DEMO_MY_SHARE_CODE} />
          <Text style={[type.caption, { textAlign: 'center', maxWidth: 280, marginTop: space.md }]}>have a friend scan this. you’ll each show up on the other’s map, right where you met.</Text>
        </Animated.View>
      ) : (
        <Animated.View key="scan" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={{ flex: 1 }}>
          <Scanner />
        </Animated.View>
      )}
    </SkyBackground>
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
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 36 }}
        >
          <Text style={[type.label, { color: value === t ? colors.accentInk : colors.textMuted }]}>{t === 'code' ? 'my code' : 'scan'}</Text>
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
      setState({ kind: 'error', message: 'that is not an openhouse code' });
      return;
    }

    Haptics.selectionAsync(); // the viewfinder locks on this frame
    setState({ kind: 'pairing' });
    try {
      const loc = await Location.requestForegroundPermissionsAsync();
      if (!loc.granted) {
        setState({ kind: 'error', message: 'location is needed to drop a pin where you met' });
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
      setState({ kind: 'error', message: 'could not pair. try again' });
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
        <Text style={[type.body, { textAlign: 'center' }]}>openhouse needs the camera to scan a friend’s code</Text>
        {permission.canAskAgain ? (
          <PrimaryButton label="allow camera" onPress={requestPermission} />
        ) : (
          <PrimaryButton label="open settings" onPress={() => Linking.openSettings()} />
        )}
      </View>
    );
  }

  if (state.kind === 'paired') {
    return <PairCelebration me={ME} friend={{ name: state.result.friendName, avatarUri: state.result.avatarUri, shareCode: state.result.shareCode }} onAgain={reset} />;
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
            <ActivityIndicator color={colors.onMedia} />
            <Text style={[type.label, { color: colors.onMedia }]}>pairing…</Text>
          </Animated.View>
        )}
      </View>
      {state.kind === 'error' ? (
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <Text style={type.caption}>{state.message}</Text>
          <PrimaryButton label="try again" onPress={reset} />
        </View>
      ) : (
        <Text style={[type.caption, { textAlign: 'center' }]}>point at a friend’s openhouse code</Text>
      )}
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Button label={label} onPress={onPress} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: radius.full,
    padding: space.xs,
  },
  segmentPill: {
    position: 'absolute',
    top: space.xs,
    bottom: space.xs,
    left: space.xs,
    borderRadius: radius.full,
    backgroundColor: colors.ink,
  },
  pairing: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: space.lg,
    alignItems: 'center',
    gap: space.xs,
  },
});
