// Demo: "sign in with whop". A mock OAuth consent sheet, then referral payouts.
// Hardcoded; the spinner is a timer, no network.

import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, WHOP_ORANGE, WhopMark } from '@/features/whop/parts';
import { colors, fonts, radius, space, type } from '@/theme';
import { Button, haptic, SheetHeader, Sticker } from '@/theme/ui';

type Phase = 'consent' | 'loading' | 'connected';

const SCOPES = ['see your whop profile', 'pay out your referral earnings'];

export default function ConnectWhop() {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('consent');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const connect = () => {
    setPhase('loading');
    timer.current = setTimeout(() => {
      haptic('medium');
      setPhase('connected');
    }, 1200);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.sky }}
      contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.lg, gap: space.lg }}
    >
      <SheetHeader eyebrow="get paid for your link" title="sign in with whop" onClose={close} />

      <View style={styles.sheet}>
        <View style={styles.logos}>
          <View style={[styles.logo, { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line }]}>
            <Text style={styles.logoText}>w</Text>
          </View>
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.dot} />
            ))}
          </View>
          <View style={[styles.logo, { backgroundColor: colors.ink }]}>
            <View style={styles.whopDot} />
          </View>
        </View>

        {phase !== 'connected' ? (
          <Animated.View key="consent" entering={reduced ? undefined : FadeIn.duration(200)} style={{ gap: space.md }}>
            <Text style={[type.heading, { textAlign: 'center' }]}>wish you were here wants to:</Text>
            <View style={{ gap: space.sm }}>
              {SCOPES.map((s) => (
                <View key={s} style={styles.scope}>
                  <View style={styles.tick}>
                    <Text style={styles.tickText}>✓</Text>
                  </View>
                  <Text style={[type.callout, { flex: 1 }]}>{s}</Text>
                </View>
              ))}
            </View>
            <Text style={[type.caption, { textAlign: 'center' }]}>it can{'\''}t post, message or charge you. revoke any time in whop settings.</Text>
            <Button label="connect whop" onPress={connect} loading={phase === 'loading'} />
            <Button variant="quiet" label="not now" onPress={close} />
          </Animated.View>
        ) : (
          <Animated.View key="done" entering={reduced ? undefined : FadeInDown.duration(260)} style={{ gap: space.md, alignItems: 'center' }}>
            <View style={styles.check}>
              <Text style={styles.checkText}>✓</Text>
            </View>
            <View style={styles.connectedRow}>
              <Avatar name="nithin" size={28} />
              <Text style={type.label}>connected as @nithin</Text>
            </View>
          </Animated.View>
        )}
      </View>

      {phase === 'connected' ? (
        <Animated.View entering={reduced ? undefined : FadeInDown.duration(300).delay(120)} style={styles.card}>
          <Sticker label="referral payouts" small rotate={-4} style={{ alignSelf: 'flex-start' }} />
          <Text style={styles.big}>$44.70 earned</Text>
          <View style={styles.stats}>
            <Stat value="3" label="sales" />
            <Stat value="friday" label="next payout" />
            <Stat value="10%" label="your cut" />
          </View>
          <Text style={type.caption}>3 sales · next payout friday, straight to your whop balance</Text>
          <Button label="done" onPress={close} />
          <WhopMark label="payouts by whop" style={{ alignSelf: 'center' }} />
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.bg, borderRadius: radius.xl, padding: space.lg, gap: space.lg },
  logos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md },
  logo: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: fonts.bold, fontSize: 26, color: colors.ink },
  whopDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: WHOP_ORANGE },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong },
  scope: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface },
  tick: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  tickText: { color: colors.accentInk, fontFamily: fonts.bold, fontSize: 12 },
  check: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: colors.onMedia, fontFamily: fonts.bold, fontSize: 30 },
  connectedRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  card: { backgroundColor: colors.bg, borderRadius: radius.xl, padding: space.lg, gap: space.md },
  big: { ...type.title },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.surface, gap: 2 },
  statValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, textTransform: 'lowercase' },
});
