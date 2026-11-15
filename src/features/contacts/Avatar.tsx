// Cutout-style faces: a photo (or initials on a pastel sticker) with a thick white
// outline and a soft lift, like a cardboard standee. The initials sit underneath the
// photo, so a slow or failed image still shows a face-shaped sticker.

import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, shadow } from '@/theme';

export function Avatar({
  uri,
  initials,
  tint,
  size = 48,
  style,
}: {
  uri?: string;
  initials: string;
  tint: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const ring = Math.max(2, Math.round(size * 0.07));
  const inner = size - ring * 2;
  return (
    <View
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2, padding: ring }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.face, { borderRadius: inner / 2, backgroundColor: tint }]}>
        <Text style={[styles.initials, { fontSize: Math.round(inner * (initials.length > 1 ? 0.36 : 0.44)) }]}>{initials}</Text>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} accessibilityIgnoresInvertColors />
        ) : null}
      </View>
    </View>
  );
}

/** A tilted rectangular standee for the collage. */
export function CutoutCard({
  uri,
  initials,
  tint,
  width,
  height,
  rotate,
}: {
  uri?: string;
  initials: string;
  tint: string;
  width: number;
  height: number;
  rotate: number;
}) {
  const outline = Math.max(4, Math.round(width * 0.05));
  const r = Math.round(width * 0.18);
  return (
    <View style={[styles.card, { width, height, borderRadius: r, padding: outline, transform: [{ rotate: `${rotate}deg` }] }]}>
      <View style={[styles.face, { borderRadius: r - outline, backgroundColor: tint }]}>
        <Text style={[styles.initials, { fontSize: Math.round(width * 0.32) }]}>{initials}</Text>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { backgroundColor: colors.bg, ...shadow.chip },
  card: { backgroundColor: colors.bg, ...shadow.print },
  face: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.bold, color: colors.text, letterSpacing: -0.6, textTransform: 'lowercase' },
});
