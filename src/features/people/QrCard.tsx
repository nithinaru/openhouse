import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { colors, fonts, radius, shadow, space } from '@/theme';
import { Sticker } from '@/theme/ui';

import { pairUrl } from './pair';

const QR = 200;
const CARD_W = QR + space.lg * 2;

/** Your pairing code, on a white card pinned slightly crooked, with your name tag. */
export function QrCard({ name, code }: { name: string; code: string }) {
  return (
    <View style={styles.wrap} accessible accessibilityLabel={`your wish you were here code, ${code.split('').join(' ')}`}>
      <View style={styles.card}>
        <QRCode value={pairUrl(code)} size={QR} color={colors.ink} backgroundColor={colors.bg} />
        <Text style={styles.code}>{code.split('').join(' ')}</Text>
      </View>
      <Sticker label={`@${name.toLowerCase()}`} rotate={-6} style={styles.tag} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  card: {
    width: CARD_W,
    padding: space.lg,
    paddingBottom: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    alignItems: 'center',
    gap: space.md,
    transform: [{ rotate: '-2deg' }],
    ...shadow.float,
  },
  tag: { alignSelf: 'center', marginTop: -16 },
  code: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 15, letterSpacing: 2, fontVariant: ['tabular-nums'] },
});
