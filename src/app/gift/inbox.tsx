import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { giftLine, markGiftSeen, useGifts } from '@/features/commerce/gifts';
import { GiftIcon, Sticker } from '@/features/commerce/ui';
import { colors, duration, ease, radius, space, type } from '@/theme';
import { Button, SheetHeader } from '@/theme/ui';

// Gifts friends sent you, from gifts:forUser. Opening this marks them seen.
export default function GiftInbox() {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { gifts } = useGifts(5000);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  useEffect(() => {
    gifts.filter((g) => !g.seen).forEach((g) => void markGiftSeen(g.giftId));
  }, [gifts]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.lg, gap: space.lg }}
    >
      <SheetHeader eyebrow="from your friends" title="gifts" onClose={close} />

      {gifts.length === 0 ? (
        <View style={styles.empty}>
          <GiftIcon size={28} color={colors.textMuted} />
          <Text style={[type.caption, { textAlign: 'center' }]}>
            when a friend sends you something from a day you shared, it shows up here
          </Text>
        </View>
      ) : null}

      {gifts.map((g, i) => (
        <Animated.View
          key={g.giftId}
          entering={reduced ? undefined : FadeInDown.duration(duration.enter).delay(i * 60).easing(ease.out)}
          style={styles.card}
        >
          {g.previewUrl ? <Image source={{ uri: g.previewUrl }} style={styles.photo} contentFit="cover" transition={200} /> : null}
          <Sticker label={`from ${g.fromName.toLowerCase()}`} style={styles.sticker} />
          <View style={{ padding: space.md, gap: space.xs }}>
            <Text style={type.heading}>{giftLine(g)}</Text>
            <Text style={type.caption}>
              {g.downloadUrl
                ? 'ready to download'
                : g.shipsInDays
                  ? `on its way · arrives in ${g.shipsInDays[0]}–${g.shipsInDays[1]} days`
                  : 'being made now · the link appears here when it is ready'}
            </Text>
            {g.downloadUrl ? (
              <Button label="open" onPress={() => void Linking.openURL(g.downloadUrl!)} style={{ marginTop: space.sm }} />
            ) : null}
          </View>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  card: { borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden' },
  photo: { height: 180, backgroundColor: colors.elevated },
  sticker: { position: 'absolute', top: space.md, left: space.md },
});
