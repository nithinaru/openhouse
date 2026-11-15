import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { HousePerson } from '@/lib/demo/demoHouse';
import { shadow } from '@/theme';
import { Sticker } from '@/theme/ui';

// A cardboard standee: the cutout (its white outline is baked into the crop), a small
// folded cardboard stand behind the feet, a soft floor shadow and a pink name tag.

const CARD = '#C9A574';
const CARD_DARK = '#A9844F';

export function Standee({
  person,
  height,
  tag,
  tagRotate = -5,
  style,
}: {
  person: HousePerson;
  height: number;
  /** Sticker text; defaults to the handle. Pass null for no tag. */
  tag?: string | null;
  tagRotate?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const w = Math.round(height * person.aspect);
  const base = Math.max(6, Math.round(height * 0.06));
  const label = tag === undefined ? person.handle : tag;
  return (
    <View style={[{ alignItems: 'center' }, style]} accessible accessibilityLabel={`${person.name}'s cutout`}>
      <View style={{ width: w, height: height + base }}>
        {/* floor shadow */}
        <View style={[styles.floor, { width: w * 1.1, height: base * 1.6, borderRadius: base, left: -w * 0.05, bottom: -base * 0.4 }]} />
        {/* the folded stand peeking out behind the feet */}
        <View
          style={[
            styles.stand,
            { width: w * 0.34, height: height * 0.16, left: w * 0.5, bottom: base * 0.6, borderRadius: 2 },
          ]}
        />
        <Image source={person.cutout} style={{ width: w, height, ...shadow.chip }} contentFit="contain" />
        {/* cardboard base plate */}
        <View style={[styles.base, { width: w * 0.86, height: base, left: w * 0.07, borderRadius: base / 3 }]} />
      </View>
      {label ? <Sticker label={label} small rotate={tagRotate} style={{ marginTop: -base * 0.4 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  floor: { position: 'absolute', backgroundColor: 'rgba(10,10,10,0.22)' },
  stand: { position: 'absolute', backgroundColor: CARD_DARK, transform: [{ skewX: '-18deg' }] },
  base: { backgroundColor: CARD, borderBottomWidth: 2, borderBottomColor: CARD_DARK },
});
