import { useLocalSearchParams } from 'expo-router';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { getDemoTrip } from '@/lib/demo/demoTrip';
import { startCheckout } from '@/features/poster/checkout';
import { Poster } from '@/features/poster/Poster';
import { colors, radius, space, type } from '@/theme';

// One frame style for now: dark frame with a light mat. Designer replaces.
const FRAME = { border: 10, mat: 16, frameColor: colors.surface, matColor: colors.text };

export default function FrameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // TODO(convex): const trip = useQuery(api.trips.get, { id }) (fall back to demo trip while loading).
  const trip = getDemoTrip(id);
  // TODO(convex): real poster record id from api.posters.create after uploading the capture.
  const posterId = `poster-${trip.id}`;
  // TODO(convex): bind to useQuery(api.orders.forPoster, { posterId })?.status === 'paid'.
  const orderConfirmed = false;

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const posterWidth = Math.min(width - space.lg * 2, 420) - (FRAME.border + FRAME.mat) * 2;

  const frameRef = useRef<ComponentRef<typeof View>>(null);
  const [saving, setSaving] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const perm = await requestPermissionsAsync(true);
      if (!perm.granted) {
        setMessage('Allow Photos access to save the poster.');
        return;
      }
      const uri = await captureRef(frameRef, { format: 'png', quality: 1, result: 'tmpfile' });
      // TODO(convex): also upload `uri` to Convex storage and create the poster record (§5.8).
      await Asset.create(uri);
      setMessage('Saved to Photos');
    } catch (e) {
      console.warn('[frame] save failed', e);
      setMessage('Could not save the poster.');
    } finally {
      setSaving(false);
    }
  }

  async function frameThis() {
    setCheckingOut(true);
    setMessage(null);
    try {
      const url = await startCheckout(posterId);
      if (url) {
        await WebBrowser.openBrowserAsync(url);
        // Do not mark paid here: the order record (orders.forPoster) drives orderConfirmed.
      } else {
        setMessage('Checkout opens once the backend is live');
      }
    } catch (e) {
      console.warn('[frame] checkout failed', e);
      setMessage('Could not open checkout.');
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl, gap: space.lg, alignItems: 'center' }}>
      <Text style={[type.title, { alignSelf: 'flex-start' }]}>Frame it</Text>

      <View
        ref={frameRef}
        collapsable={false}
        style={{ borderWidth: FRAME.border, borderColor: FRAME.frameColor, padding: FRAME.mat, backgroundColor: FRAME.matColor }}>
        <Poster trip={trip} width={posterWidth} />
      </View>

      <Text style={[type.caption, { alignSelf: 'flex-start' }]}>Style · Classic dark frame</Text>

      {orderConfirmed ? (
        <View style={{ alignSelf: 'stretch', padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, gap: space.xs }}>
          <Text style={type.heading}>Order confirmed</Text>
          <Text style={type.caption}>Your framed print is on its way.</Text>
        </View>
      ) : (
        <Pressable
          onPress={frameThis}
          disabled={checkingOut}
          accessibilityRole="button"
          style={({ pressed }) => ({
            alignSelf: 'stretch',
            alignItems: 'center',
            padding: space.md,
            borderRadius: radius.full,
            backgroundColor: colors.accent,
            opacity: pressed || checkingOut ? 0.7 : 1,
          })}>
          {checkingOut ? <ActivityIndicator color={colors.bg} /> : <Text style={[type.body, { color: colors.bg, fontWeight: '600' }]}>Frame this · $39</Text>}
        </Pressable>
      )}

      <Pressable
        onPress={save}
        disabled={saving}
        accessibilityRole="button"
        style={({ pressed }) => ({
          alignSelf: 'stretch',
          alignItems: 'center',
          padding: space.md,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: colors.line,
          opacity: pressed || saving ? 0.7 : 1,
        })}>
        {saving ? <ActivityIndicator color={colors.text} /> : <Text style={type.body}>Save to Photos</Text>}
      </Pressable>

      {message && <Text style={type.caption}>{message}</Text>}
    </ScrollView>
  );
}
