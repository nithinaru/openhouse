import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors, radius, space } from '@/theme';

import { pairUrl } from './pair';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
const QR = 200;
const CARD_W = QR + space.lg * 2;
const GLOW = CARD_W + 140;

/** Your pairing code on a card, with a slow breathing glow behind it. */
export function QrCard({ name, code }: { name: string; code: string }) {
  const reduced = useReducedMotion();
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    breath.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [breath, reduced]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 0.7 : 0.45 + breath.get() * 0.5,
    transform: [{ scale: reduced ? 1 : 0.94 + breath.get() * 0.1 }],
  }));

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* Glow is centered on the card but takes no layout space. */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', left: '50%', top: '50%', marginLeft: -GLOW / 2, marginTop: -(GLOW + 40) / 2, width: GLOW, height: GLOW + 40 }, glowStyle]}
      >
        <Svg width={GLOW} height={GLOW + 40}>
          <Defs>
            <RadialGradient id="qrGlow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={colors.accent} stopOpacity="0.55" />
              <Stop offset="0.55" stopColor={colors.accent} stopOpacity="0.16" />
              <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width={GLOW} height={GLOW + 40} fill="url(#qrGlow)" />
        </Svg>
      </Animated.View>

      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.sub}>Openhouse</Text>
          </View>
        </View>
        <QRCode value={pairUrl(code)} size={QR} color={colors.bg} backgroundColor={colors.text} />
        <Text style={styles.code}>{code.split('').join(' ')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    padding: space.lg,
    paddingTop: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.text,
    alignItems: 'center',
    gap: space.md,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'stretch' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
  name: { color: colors.bg, fontSize: 18, fontWeight: '700' },
  sub: { color: 'rgba(14,17,22,0.55)', fontSize: 12, fontWeight: '500' },
  code: { color: colors.bg, fontFamily: MONO, fontSize: 15, letterSpacing: 2, fontWeight: '600' },
});
