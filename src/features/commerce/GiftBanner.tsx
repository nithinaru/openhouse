// Home banner for an incoming gift: "nithin sent you a print of lunch on 3rd st".
// Rare and caused by someone else, so it gets a real entrance; one haptic when it lands.

import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { colors, duration, ease, radius, shadow, space, type } from '@/theme';
import { CloseIcon } from '@/theme/icons';
import { Press } from '@/theme/ui';

import { giftLine, useGifts } from './gifts';
import { GiftIcon, Sticker } from './ui';

export function GiftBanner() {
  const { unseen, dismiss } = useGifts(5000);
  const reduced = useReducedMotion();

  const landed = unseen?.giftId;
  useEffect(() => {
    if (landed) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [landed]);

  if (!unseen) return null;

  return (
    <Animated.View
      key={unseen.giftId}
      entering={reduced ? FadeIn.duration(duration.fast) : FadeInDown.duration(duration.enter).easing(ease.out)}
      exiting={FadeOut.duration(duration.fast)}
    >
      <Press
        onPress={() => {
          dismiss(unseen.giftId);
          router.push('/gift/inbox');
        }}
        accessibilityRole="button"
        accessibilityLabel={`${giftLine(unseen)}. opens your gifts`}
        style={[styles.banner, shadow.chip]}
      >
        {unseen.previewUrl ? (
          <Image source={{ uri: unseen.previewUrl }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.center]}>
            <GiftIcon color={colors.text} />
          </View>
        )}
        <View style={{ flex: 1, gap: space.xs }}>
          <Sticker label="a gift" tilt={-5} />
          <Text style={type.label} numberOfLines={2}>
            {giftLine(unseen)}
          </Text>
        </View>
        <Press onPress={() => dismiss(unseen.giftId)} hitSlop={12} haptic="none" accessibilityRole="button" accessibilityLabel="dismiss">
          <CloseIcon color={colors.textMuted} />
        </Press>
      </Press>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    paddingRight: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.pink },
  center: { alignItems: 'center', justifyContent: 'center' },
});
