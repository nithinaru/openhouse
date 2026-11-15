import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Photo } from '@/lib/types';
import { colors, radius } from '@/theme';

// How far the photo lags behind the page while swiping. The image is drawn
// wider than the page by 2 * PARALLAX so the shift never exposes an edge.
const PARALLAX = 0.22;
const DOT = 6;
const DOT_GAP = 6;
const STEP = DOT + DOT_GAP;
const PILL = 16;

type Props = {
  photos: Photo[];
  width: number;
  height: number;
  /** Vertical scroll of the parent sheet: drives the slow parallax and pull stretch. */
  scrollY: SharedValue<number>;
  /** 0..1 "walk in" progress: grows the photo until it fills the screen. */
  walk: SharedValue<number>;
  /** Scale at walk = 1. */
  walkScale: number;
  reduced: boolean;
  /** Distance from the top for the page indicator. */
  dotsTop: number;
  onPageChange: (page: number) => void;
};

export function HeroPager({ photos, width, height, scrollY, walk, walkScale, reduced, dotsTop, onPageChange }: Props) {
  const scrollX = useSharedValue(0);
  const lastPage = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.set(e.contentOffset.x);
      const page = Math.round(e.contentOffset.x / width);
      if (page !== lastPage.get()) {
        // Fires once per page crossing, not per frame.
        lastPage.set(page);
        scheduleOnRN(onPageChange, page);
      }
    },
  });

  const heroStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    // Pull down: pin to the top and stretch. Scroll up: move at half speed.
    const stretch = y < 0 ? 1 + -y / height : 1;
    const parallaxY = y < 0 ? y : reduced ? 0 : y * 0.45;
    const w = walk.get();
    const s = reduced ? 1 : 1 + w * (walkScale - 1);
    // Scale about the top edge so the photo grows down over the sheet.
    const walkY = ((s - 1) * height) / 2;
    return {
      transform: [{ translateY: parallaxY + walkY + ((stretch - 1) * height) / 2 }, { scale: s * stretch }],
    };
  });

  return (
    <Animated.View style={[{ width, height, overflow: 'visible' }, heroStyle]}>
      <Animated.ScrollView
        horizontal
        pagingEnabled
        bounces={photos.length > 1}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        style={{ width, height }}
      >
        {photos.map((p, i) => (
          <Page key={p.id} photo={p} index={i} width={width} height={height} scrollX={scrollX} reduced={reduced} />
        ))}
      </Animated.ScrollView>
      {photos.length > 1 ? <Dots count={photos.length} width={width} top={dotsTop} scrollX={scrollX} /> : null}
    </Animated.View>
  );
}

function Page({
  photo,
  index,
  width,
  height,
  scrollX,
  reduced,
}: {
  photo: Photo;
  index: number;
  width: number;
  height: number;
  scrollX: SharedValue<number>;
  reduced: boolean;
}) {
  const imageStyle = useAnimatedStyle(() => {
    if (reduced) return { transform: [{ translateX: 0 }] };
    const delta = scrollX.get() - index * width;
    return {
      transform: [
        {
          translateX: interpolate(delta, [-width, 0, width], [-width * PARALLAX, 0, width * PARALLAX], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return (
    <View style={{ width, height, overflow: 'hidden', backgroundColor: colors.surface }}>
      <Animated.View
        style={[{ position: 'absolute', top: 0, bottom: 0, left: -width * PARALLAX, width: width * (1 + PARALLAX * 2) }, imageStyle]}
      >
        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      </Animated.View>
    </View>
  );
}

function Dots({ count, width, top, scrollX }: { count: number; width: number; top: number; scrollX: SharedValue<number> }) {
  const trackW = count * STEP - DOT_GAP;
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (scrollX.get() / width) * STEP - (PILL - DOT) / 2 }],
  }));

  return (
    <View pointerEvents="none" style={[styles.dotsWrap, { top, width: trackW + 20 }]}>
      <View style={{ width: trackW, height: DOT, flexDirection: 'row', gap: DOT_GAP }}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={styles.dot} />
        ))}
        <Animated.View style={[styles.pill, pillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dotsWrap: {
    position: 'absolute',
    left: 16,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: 'rgba(242,238,230,0.4)' },
  pill: { position: 'absolute', left: 0, top: 0, width: PILL, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.text },
});
