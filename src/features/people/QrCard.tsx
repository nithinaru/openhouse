import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { colors, fonts, radius, shadow, space } from '@/theme';

import { pairUrl } from './pair';

const QR = 200;
const CARD_W = QR + space.lg * 2;

/** Your pairing code, printed on a paper card. */
export function QrCard({ name, code }: { name: string; code: string }) {
  return (
    <View style={styles.card} accessible accessibilityLabel={`Your Openhouse code, ${code.split('').join(' ')}`}>
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
    ...shadow.float,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'stretch' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontFamily: fonts.serif, fontSize: 18 },
  name: { color: colors.bg, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  sub: { color: colors.textFaint, fontSize: 13, lineHeight: 18 },
  code: { color: colors.bg, fontFamily: fonts.mono, fontSize: 15, letterSpacing: 2, fontVariant: ['tabular-nums'] },
});
