// Shared controls. One primary button, one secondary, one quiet text action, one round
// icon button, one chip, one sheet header. Screens compose these instead of styling
// their own.

import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CloseIcon } from './icons';
import { colors, duration, ease, radius, size, space, type } from './index';

// ---------------------------------------------------------------------------
// Press: scale on press-in (UI thread), one haptic on commit.

export type Haptic = 'light' | 'medium' | 'selection' | 'none';

export function haptic(kind: Haptic) {
  if (kind === 'none') return;
  if (kind === 'selection') void Haptics.selectionAsync().catch(() => {});
  else
    void Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(
      () => {},
    );
}

export type PressProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Pressed scale. 0.97 cards, 0.96 buttons, 0.9 small round buttons. */
  scaleTo?: number;
  haptic?: Haptic;
};

export function Press({ children, style, scaleTo = 0.97, haptic: h = 'light', onPressIn, onPressOut, onPress, ...rest }: PressProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      {...rest}
      pressRetentionOffset={{ top: 20, left: 20, right: 20, bottom: 20 }}
      onPressIn={(e) => {
        scale.set(withTiming(scaleTo, { duration: duration.press, easing: ease.out, reduceMotion: ReduceMotion.System }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, { duration: duration.release, easing: ease.out, reduceMotion: ReduceMotion.System }));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        haptic(h);
        onPress?.(e);
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Button

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet';
  loading?: boolean;
  disabled?: boolean;
  /** Shown after the label, e.g. a price or an arrow. */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  trailing,
  style,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const v = buttonStyles[variant];
  const fg = variant === 'primary' ? colors.accentInk : variant === 'secondary' ? colors.text : colors.textMuted;
  return (
    <Press
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      scaleTo={variant === 'quiet' ? 0.97 : 0.96}
      haptic={variant === 'primary' ? 'medium' : variant === 'secondary' ? 'light' : 'none'}
      style={[v.box, (disabled || loading) && { opacity: 0.6 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          <Text style={[v.label, { color: fg }]} numberOfLines={1}>
            {label}
          </Text>
          {trailing}
        </>
      )}
    </Press>
  );
}

const buttonBox: ViewStyle = {
  minHeight: size.button,
  borderRadius: radius.md,
  paddingHorizontal: space.lg,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: space.sm,
};

const buttonStyles = {
  primary: StyleSheet.create({
    box: { ...buttonBox, backgroundColor: colors.accent },
    label: { fontSize: 17, fontWeight: '600' },
  }),
  secondary: StyleSheet.create({
    box: { ...buttonBox, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong },
    label: { fontSize: 17, fontWeight: '500' },
  }),
  quiet: StyleSheet.create({
    box: { ...buttonBox, minHeight: size.hit, paddingHorizontal: space.md },
    label: { fontSize: 15, fontWeight: '500' },
  }),
};

// ---------------------------------------------------------------------------
// Round icon button (close, back, play/pause). 40pt visual, 44pt+ hit area.

export function IconButton({
  icon,
  onPress,
  label,
  tone = 'surface',
  style,
}: {
  icon: ReactNode;
  onPress: () => void;
  label: string;
  /** `media` floats over photos and maps; `surface` sits on the app background. */
  tone?: 'surface' | 'media';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      scaleTo={0.9}
      haptic="light"
      style={[styles.iconButton, tone === 'media' ? styles.iconMedia : styles.iconSurface, style]}
    >
      {icon}
    </Press>
  );
}

export function CloseButton({ onPress, tone, style }: { onPress: () => void; tone?: 'surface' | 'media'; style?: StyleProp<ViewStyle> }) {
  return <IconButton icon={<CloseIcon color={colors.text} />} onPress={onPress} label="Close" tone={tone} style={style} />;
}

// ---------------------------------------------------------------------------
// Chip: small fact (time, place, weather) or a tappable suggestion.

export function Chip({
  label,
  icon,
  tone = 'default',
  onPress,
  style,
  textStyle,
}: {
  label: string;
  icon?: ReactNode;
  tone?: 'default' | 'accent' | 'media';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const body = (
    <>
      {icon}
      <Text style={[styles.chipText, tone === 'accent' && { color: colors.accent }, textStyle]} numberOfLines={1}>
        {label}
      </Text>
    </>
  );
  const boxStyle = [styles.chip, tone === 'accent' && styles.chipAccent, tone === 'media' && styles.chipMedia, style];
  if (!onPress) return <View style={boxStyle}>{body}</View>;
  return (
    <Press onPress={onPress} accessibilityRole="button" scaleTo={0.96} haptic="selection" style={[boxStyle, styles.chipTap]}>
      {body}
    </Press>
  );
}

// ---------------------------------------------------------------------------
// Sheet header: optional quiet eyebrow, serif title, close on the right.

export function SheetHeader({
  eyebrow,
  title,
  onClose,
  onTitleLongPress,
  right,
}: {
  eyebrow?: string;
  title: string;
  onClose?: () => void;
  /** Hidden rehearsal switches hang off the title. */
  onTitleLongPress?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        style={{ flex: 1 }}
        onLongPress={
          onTitleLongPress
            ? () => {
                haptic('selection');
                onTitleLongPress();
              }
            : undefined
        }
        delayLongPress={700}
        accessible={false}
      >
        {eyebrow ? (
          <Text style={type.caption} numberOfLines={1}>
            {eyebrow}
          </Text>
        ) : null}
        <Text style={type.title} accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
      </Pressable>
      {right}
      {onClose ? <CloseButton onPress={onClose} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stamp: the date imprint.

export function Stamp({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[type.stamp, style]}>{children}</Text>;
}

/** "3:42 PM" */
export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  iconButton: {
    width: size.iconButton,
    height: size.iconButton,
    borderRadius: size.iconButton / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSurface: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  iconMedia: { backgroundColor: colors.scrim, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: size.chip,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  chipTap: { minHeight: size.hit, paddingHorizontal: space.md },
  chipAccent: { backgroundColor: colors.accentMuted, borderColor: 'rgba(233,168,76,0.32)' },
  chipMedia: { backgroundColor: colors.scrim, borderColor: colors.line },
  chipText: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.text },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
});
