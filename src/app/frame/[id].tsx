import * as Haptics from 'expo-haptics';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { scheduleOnRN } from 'react-native-worklets';

import { PLUS_STYLES, useEntitlements } from '@/features/commerce/membership';
import { PlusLock } from '@/features/commerce/ui';
import { startCheckout, waitForPaid } from '@/features/poster/checkout';
import { FRAME_STYLES, FramedPoster, frameInset } from '@/features/poster/FramedPoster';
import { OrderConfirmed } from '@/features/poster/OrderConfirmed';
import { POSTER_VARIANTS } from '@/features/poster/Poster';
import { EASE_IN_OUT } from '@/features/stop/motion';
import { PressScale } from '@/features/stop/PressScale';
import { getDemoTrip } from '@/lib/demo/demoTrip';
import { colors, radius, space, type } from '@/theme';
import { Button, SheetHeader } from '@/theme/ui';

const SIZES = [
  { id: '12x16', label: '12 × 16 in', price: 39, scale: 0.84 },
  { id: '18x24', label: '18 × 24 in', price: 59, scale: 1 },
] as const;
type SizeId = (typeof SIZES)[number]['id'];

const WALLS = POSTER_VARIANTS.map((v) => FRAME_STYLES[v.id].wall);

function tick() {
  Haptics.selectionAsync();
}

export default function FrameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // TODO(convex): const trip = useQuery(api.trips.get, { id }) (fall back to demo trip while loading).
  const trip = getDemoTrip(id);
  // Set by the /whop webhook via the Convex order record, polled after checkout.
  const [serverConfirmed, setServerConfirmed] = useState(false);
  // Hidden rehearsal switch: long-press the title to preview the confirmed state.
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  const orderConfirmed = serverConfirmed || previewConfirmed;

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  const itemW = Math.min(Math.round(width * 0.74), 380);
  const side = (width - itemW) / 2;
  const outerW = itemW - space.lg; // frame outer width at full size
  const wallH = Math.round(outerW * (4 / 3)) + space.xl * 2;

  const [index, setIndex] = useState(0);
  const [size, setSize] = useState<SizeId>('12x16');
  const sizeInfo = SIZES.find((s) => s.id === size)!;
  const variant = POSTER_VARIANTS[index];
  // Night and field are Openhouse+ styles: soft lock, the button opens the paywall.
  const { plus } = useEntitlements(id ?? trip.id);
  const styleLocked = !plus && PLUS_STYLES.has(variant.id);
  const openPlus = () => router.push({ pathname: '/plus', params: { from: 'styles', tripId: id ?? trip.id } });

  const scrollX = useSharedValue(0);
  const lastIndex = useSharedValue(0);
  const sizeScale = useSharedValue<number>(sizeInfo.scale);

  const frameRefs = useRef<(ComponentRef<typeof View> | null)[]>([]);
  const [saving, setSaving] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    sizeScale.set(withTiming(sizeInfo.scale, { duration: reduced ? 0 : 260, easing: EASE_IN_OUT }));
  }, [reduced, sizeInfo.scale, sizeScale]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.set(e.contentOffset.x);
      const i = Math.max(0, Math.min(POSTER_VARIANTS.length - 1, Math.round(e.contentOffset.x / itemW)));
      if (i !== lastIndex.get()) {
        lastIndex.set(i);
        scheduleOnRN(setIndex, i);
        scheduleOnRN(tick);
      }
    },
  });

  const wallInput = POSTER_VARIANTS.map((_, i) => i * itemW);
  const wallStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(scrollX.get(), wallInput, WALLS),
  }));

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const perm = await requestPermissionsAsync(true);
      if (!perm.granted) {
        setMessage('Allow Photos access to save the poster.');
        return;
      }
      const ref = frameRefs.current[index];
      if (!ref) throw new Error('frame not mounted');
      const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
      // TODO(convex): also upload `uri` to Convex storage and create the poster record (§5.8).
      await Asset.create(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      const checkout = await startCheckout({ tripId: id ?? trip.id, style: variant.id, size });
      if (checkout) {
        await WebBrowser.openBrowserAsync(checkout.url);
        // Never mark paid on browser close: wait for the webhook to update the order.
        setMessage('Confirming your order…');
        const paid = await waitForPaid(checkout.orderId);
        setMessage(paid ? null : 'Payment not confirmed yet. It will show here once Whop confirms it.');
        if (paid) setServerConfirmed(true);
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
      contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl, gap: space.lg }}
    >
      <View style={{ paddingHorizontal: space.lg, gap: space.xs }}>
        <SheetHeader
          title="Frame it"
          onTitleLongPress={() => setPreviewConfirmed((v) => !v)}
          onClose={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <Text style={type.caption}>Your day, printed and framed. Swipe to change the style</Text>
      </View>

      {/* The wall */}
      <Animated.View style={[{ height: wallH }, wallStyle]}>
        <WallLight width={width} height={wallH} />
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={itemW}
          decelerationRate="fast"
          disableIntervalMomentum
          scrollEventThrottle={16}
          onScroll={onScroll}
          contentContainerStyle={{ paddingHorizontal: side, alignItems: 'center' }}
        >
          {POSTER_VARIANTS.map((v, i) => (
            <CarouselItem key={v.id} index={i} itemW={itemW} height={wallH} scrollX={scrollX} sizeScale={sizeScale} reduced={reduced}>
              <FramedPoster
                ref={(r) => {
                  frameRefs.current[i] = r;
                }}
                trip={trip}
                variant={v.id}
                posterWidth={outerW - frameInset(v.id) * 2}
              />
            </CarouselItem>
          ))}
        </Animated.ScrollView>
      </Animated.View>

      <View style={{ alignItems: 'center', gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={type.heading}>{variant.label}</Text>
          {styleLocked ? <PlusLock onPress={openPlus} /> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {POSTER_VARIANTS.map((v, i) => (
            <View key={v.id} style={[styles.dot, i === index && { backgroundColor: colors.text, width: 16 }]} />
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
        <View style={styles.sizes}>
          {SIZES.map((s) => {
            const active = s.id === size;
            return (
              <PressScale
                key={s.id}
                onPress={() => {
                  if (active) return;
                  Haptics.selectionAsync();
                  setSize(s.id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.size, active && styles.sizeActive]}
              >
                <Text style={[styles.sizeLabel, active && { color: colors.text }]}>{s.label}</Text>
                <Text style={[styles.sizePrice, active && { color: colors.text }]}>${s.price}</Text>
              </PressScale>
            );
          })}
        </View>

        {orderConfirmed ? (
          <OrderConfirmed
            palette={trip.palette}
            detail={`${sizeInfo.label} · ${variant.label} · ships in 3–5 days`}
          />
        ) : styleLocked ? (
          <Button label="unlock this style with plus" onPress={openPlus} />
        ) : (
          <Button label={`Frame this · $${sizeInfo.price}`} onPress={frameThis} loading={checkingOut} />
        )}

        <Button variant="secondary" label="Save to Photos" onPress={save} loading={saving} />

        {message && <Text style={[type.caption, { textAlign: 'center' }]}>{message}</Text>}
      </View>
    </ScrollView>
  );
}

function CarouselItem({
  index,
  itemW,
  height,
  scrollX,
  sizeScale,
  reduced,
  children,
}: {
  index: number;
  itemW: number;
  height: number;
  scrollX: SharedValue<number>;
  sizeScale: SharedValue<number>;
  reduced: boolean;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const d = (scrollX.get() - index * itemW) / itemW; // -1..1 around center
    const s = interpolate(d, [-1, 0, 1], [0.84, 1, 0.84], 'clamp') * sizeScale.get();
    return {
      opacity: interpolate(d, [-1, 0, 1], [0.45, 1, 0.45], 'clamp'),
      transform: reduced
        ? [{ scale: s }]
        : [{ perspective: 900 }, { rotateY: `${interpolate(d, [-1, 0, 1], [14, 0, -14], 'clamp')}deg` }, { scale: s }],
    };
  });

  return (
    <View style={{ width: itemW, height, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={style}>{children}</Animated.View>
    </View>
  );
}

function WallLight({ width, height }: { width: number; height: number }) {
  return (
    <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="spot" cx="50%" cy="8%" rx="70%" ry="75%">
          <Stop offset="0" stopColor="#FFF6E5" stopOpacity="0.32" />
          <Stop offset="1" stopColor="#FFF6E5" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={height} fill="url(#spot)" />
      <Rect width={width} height={height} fill="url(#floor)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  sizes: { flexDirection: 'row', gap: space.sm },
  size: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sizeActive: { borderColor: colors.text, backgroundColor: colors.surface },
  sizeLabel: { color: colors.textMuted, fontSize: 15, fontWeight: '500' },
  sizePrice: { color: colors.textMuted, fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
});
