// "who was there?" Reads the address book on-device only. Nothing is sent anywhere.

import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { readContacts, requestAccess } from '@/features/contacts/device';
import { letterOf, TINTS, hash, type RawContact } from '@/features/contacts/people';
import { colors, duration, ease, fonts, space, type } from '@/theme';
import { Button, Press } from '@/theme/ui';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function ContactsStep({ onDone }: { onDone: (invited: boolean) => void }) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [top, setTop] = useState<RawContact[]>([]);

  const connect = async () => {
    if (busy) return;
    setBusy(true);
    const access = await requestAccess();
    if (access !== 'granted') {
      onDone(false);
      return;
    }
    const all = await readContacts();
    const picked = [...all].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 10);
    if (picked.length === 0) {
      onDone(false);
      return;
    }
    setTop(picked);
    await wait(1400);
    Alert.alert('send invites?', `would you like to send invites to your top ${picked.length} contacts?`, [
      { text: 'not now', style: 'cancel', onPress: () => onDone(false) },
      {
        text: 'send invites',
        onPress: () => {
          // Nothing leaves the phone: no sms, no network.
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onDone(true);
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.md }]}>
      <StatusBar style="dark" />
      <Animated.View entering={FadeInDown.duration(duration.enter).easing(ease.out)} style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          who was there?
        </Text>
        <Text style={styles.sub}>connect your contacts so friends can step back into the day with you.</Text>
      </Animated.View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
        {top.map((c, i) => (
          <Animated.View key={c.id} entering={FadeIn.duration(260).delay(i * 70)} style={styles.row}>
            {c.uri ? (
              <Image source={{ uri: c.uri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: TINTS[hash(c.name) % TINTS.length] }]}>
                <Text style={styles.initial}>{letterOf(c.name)}</Text>
              </View>
            )}
            <Text style={styles.name} numberOfLines={1}>
              {c.name.toLowerCase()}
            </Text>
          </Animated.View>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <Button label={busy ? 'connecting…' : 'connect contacts'} onPress={connect} disabled={busy} />
        <Press onPress={() => onDone(false)} accessibilityRole="button" haptic="selection" hitSlop={10} style={styles.skip}>
          <Text style={styles.skipText}>not now</Text>
        </Press>
        <Text style={styles.fine}>contacts stay on your phone. nothing is sent.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: { alignItems: 'center', paddingHorizontal: space.lg, gap: space.sm },
  title: { ...type.display, fontSize: 40, lineHeight: 42, letterSpacing: -1.8, textAlign: 'center' },
  sub: { ...type.body, color: colors.textMuted, textAlign: 'center', maxWidth: 320 },
  list: { flex: 1, marginTop: space.lg },
  listInner: { paddingHorizontal: space.lg, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  name: { ...type.body, flex: 1, color: colors.text },
  actions: { paddingHorizontal: space.lg, gap: space.sm, alignItems: 'stretch' },
  skip: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  skipText: { ...type.callout, color: colors.textFaint },
  fine: { ...type.caption, color: colors.textFaint, textAlign: 'center' },
});
