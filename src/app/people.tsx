import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEMO_MY_SHARE_CODE, pair, pairUrl, parsePairCode, type PairResult } from '@/features/people/pair';
import { colors, radius, space, type } from '@/theme';

type Tab = 'code' | 'scan';

export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('code');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg, paddingHorizontal: space.lg, gap: space.lg }}>
      <Text style={type.title}>People</Text>

      <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.full, padding: space.xs }}>
        {(['code', 'scan'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.full, backgroundColor: tab === t ? colors.line : 'transparent' }}>
            <Text style={[type.body, { color: tab === t ? colors.text : colors.textMuted }]}>{t === 'code' ? 'My code' : 'Scan'}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'code' ? <MyCode /> : <Scanner />}
    </View>
  );
}

function MyCode() {
  // TODO(convex): shareCode from api.users.me.
  const code = DEMO_MY_SHARE_CODE;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <View style={{ padding: space.md, backgroundColor: colors.text, borderRadius: radius.md }}>
        <QRCode value={pairUrl(code)} size={220} color={colors.bg} backgroundColor={colors.text} />
      </View>
      <Text style={type.heading}>{code}</Text>
      <Text style={[type.caption, { textAlign: 'center' }]}>Have a friend scan this to add each other to the trip.</Text>
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
      setState({ kind: 'error', message: 'That is not an Wish You Were Here code.' });
      return;
    }

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
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
        <Text style={[type.body, { textAlign: 'center' }]}>Wish You Were Here needs the camera to scan a friend’s code.</Text>
        {permission.canAskAgain ? (
          <PrimaryButton label="Allow camera" onPress={requestPermission} />
        ) : (
          <PrimaryButton label="Open Settings" onPress={() => Linking.openSettings()} />
        )}
      </View>
    );
  }

  if (state.kind === 'paired') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm }}>
        <Text style={type.title}>You and {state.result.friendName}</Text>
        <Text style={type.caption}>Paired · {state.result.shareCode}</Text>
        <Text style={[type.caption, { textAlign: 'center' }]}>Their face pin will show up where you met.</Text>
        <View style={{ height: space.md }} />
        <PrimaryButton label="Scan another" onPress={reset} />
      </View>
    );
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
        {state.kind === 'pairing' && (
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <ActivityIndicator color={colors.text} />
          </View>
        )}
      </View>
      {state.kind === 'error' ? (
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <Text style={type.caption}>{state.message}</Text>
          <PrimaryButton label="Try again" onPress={reset} />
        </View>
      ) : (
        <Text style={[type.caption, { textAlign: 'center' }]}>Point at a friend’s Wish You Were Here code.</Text>
      )}
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ paddingVertical: space.sm + 4, paddingHorizontal: space.lg, borderRadius: radius.full, backgroundColor: colors.accent, opacity: pressed ? 0.7 : 1 })}>
      <Text style={[type.body, { color: colors.bg, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}
