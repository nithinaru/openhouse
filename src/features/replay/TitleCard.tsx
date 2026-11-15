import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { colors, ease, space, type } from '@/theme';
import { SkyBackground, Sticker } from '@/theme/ui';

const EASE_OUT = ease.out;

type Props = { title: string; date: string; meta: string };

// Opening card: the sky, the date, the title, then the count slapped on as a sticker.
// Fades out over the map as the first flight begins.
export function TitleCard({ title, date, meta }: Props) {
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(900).easing(EASE_OUT)}
      style={styles.root}
    >
      <SkyBackground variant="sky" style={styles.center}>
        <View style={styles.inner}>
          <Animated.Text entering={FadeInDown.duration(700).delay(150).easing(EASE_OUT)} style={styles.date}>
            {date}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.duration(800).delay(300).easing(EASE_OUT)} style={styles.title}>
            {title}
          </Animated.Text>
          <Animated.View entering={FadeIn.duration(500).delay(1000)} style={{ marginTop: space.lg }}>
            <Sticker label={meta} rotate={-4} />
          </Animated.View>
        </View>
      </SkyBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  center: { justifyContent: 'center' },
  inner: { alignItems: 'center', paddingHorizontal: space.xl },
  date: { ...type.callout, color: colors.textMuted, marginBottom: space.sm },
  title: { ...type.display, fontSize: 44, lineHeight: 46, letterSpacing: -2, textAlign: 'center' },
});
