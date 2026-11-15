// Shared controls. One primary pill, one secondary, one quiet text action, one round
// icon button, one chip, one sheet header, plus the scrapbook pieces: the sticker tag,
// the cardboard cutout, the photo print, the sky, the wordmark and the dock. Screens
// compose these instead of styling their own.

import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useId, type ReactNode } from 'react';
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
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { CloseIcon } from './icons';
import { colors, duration, ease, fonts, radius, shadow, size, space, type } from './index';

const WORDMARK_CHROME: number = require('../../assets/brand/wordmark-sky.png');

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

/** Style keys that place the control among its siblings; they belong on the outer Pressable. */
const OUTER_KEYS = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'zIndex',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
]);

function splitStyle(style: StyleProp<ViewStyle>): [ViewStyle, ViewStyle] {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const k in flat) (OUTER_KEYS.has(k) ? outer : inner)[k] = flat[k];
  // A control told to grow should fill its outer box too.
  if (outer.flex != null || outer.flexGrow != null) inner.flexGrow = 1;
  return [outer as ViewStyle, inner as ViewStyle];
}

export function Press({ children, style, scaleTo = 0.97, haptic: h = 'light', onPressIn, onPressOut, onPress, ...rest }: PressProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const [outer, inner] = splitStyle(style);

  return (
    <Pressable
      {...rest}
      style={outer}
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
      <Animated.View style={[inner, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Button: black pill, white pill, or quiet text.

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
      style={[v.box, (disabled || loading) && { opacity: 0.55 }, style]}
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
  borderRadius: radius.full,
  paddingHorizontal: space.lg,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: space.sm,
};

const buttonLabel: TextStyle = { fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.4, textTransform: 'lowercase' };

const buttonStyles = {
  primary: StyleSheet.create({
    box: { ...buttonBox, backgroundColor: colors.accent },
    label: buttonLabel,
  }),
  secondary: StyleSheet.create({
    box: { ...buttonBox, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.lineStrong },
    label: buttonLabel,
  }),
  quiet: StyleSheet.create({
    box: { ...buttonBox, minHeight: size.hit, paddingHorizontal: space.md },
    label: { fontFamily: fonts.medium, fontSize: 15, textTransform: 'lowercase' },
  }),
};

// ---------------------------------------------------------------------------
// Round icon button (close, back, play/pause). White paper disc, 40pt visual, 44pt+ hit.

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
  /** `media` floats over photos and maps; `surface` sits on paper or sky. */
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
  return <IconButton icon={<CloseIcon color={colors.text} />} onPress={onPress} label="close" tone={tone} style={style} />;
}

// ---------------------------------------------------------------------------
// Chip: small fact (time, place, weather) or a tappable suggestion. Soft grey pill;
// `accent` is the pink sticker fill, `media` a white pill over imagery.

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
      <Text style={[styles.chipText, textStyle]} numberOfLines={1}>
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
// Sheet header: optional quiet eyebrow, bold lowercase title, close on the right.

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
          <Text style={[type.caption, { marginBottom: space.xxs }]} numberOfLines={1}>
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
// Stamp: times and dates, quiet tabular figures.

export function Stamp({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[type.stamp, style]}>{children}</Text>;
}

/** "3:42 pm" */
export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

// ---------------------------------------------------------------------------
// Sticker: the signature. A pink tag with a dashed edge, slapped on a little crooked.
// `paper` is the white variant with an ink dashed edge, for "add yours" prompts.

export function Sticker({
  label,
  rotate = -4,
  tone = 'pink',
  small,
  icon,
  style,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  rotate?: number;
  tone?: 'pink' | 'paper';
  small?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const box = [
    styles.sticker,
    small && styles.stickerSmall,
    tone === 'paper' ? styles.stickerPaper : styles.stickerPink,
    { transform: [{ rotate: `${rotate}deg` }] },
    style,
  ];
  const body = (
    <>
      {icon}
      <Text style={[styles.stickerText, small && styles.stickerTextSmall]} numberOfLines={1}>
        {label}
      </Text>
    </>
  );
  if (!onPress) {
    return (
      <View style={box} accessible accessibilityLabel={accessibilityLabel ?? label}>
        {body}
      </View>
    );
  }
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} haptic="selection" style={box}>
      {body}
    </Press>
  );
}

// ---------------------------------------------------------------------------
// Cutout: a cardboard standee. The photo gets a thick white outline, a soft shadow
// and a slight tilt; an optional sticker tag names who it is.

export function Cutout({
  uri,
  name,
  width,
  height,
  rotate = -3,
  tag,
  tagRotate = -5,
  style,
}: {
  uri?: string;
  /** Used for the initial when there is no photo, and the accessibility label. */
  name: string;
  width: number;
  height: number;
  rotate?: number;
  /** Sticker text under the cutout, e.g. "@ines · by the stairs". */
  tag?: string;
  tagRotate?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const outline = Math.max(4, Math.round(width * 0.045));
  const r = Math.round(width * 0.16);
  return (
    <View style={[{ width, alignItems: 'center' }, style]} accessible accessibilityLabel={tag ?? name}>
      <View
        style={[
          styles.cutout,
          { width, height, borderRadius: r, padding: outline, transform: [{ rotate: `${rotate}deg` }] },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ flex: 1, borderRadius: r - outline }}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.cutoutBlank, { borderRadius: r - outline }]}>
            <Text style={[styles.cutoutInitial, { fontSize: Math.round(width * 0.42) }]}>{name.slice(0, 1).toLowerCase()}</Text>
          </View>
        )}
      </View>
      {tag ? <Sticker label={tag} rotate={tagRotate} small={width < 110} style={{ marginTop: -14 }} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Print: a tilted photo with a white border, like a print pinned in the scrapbook.

export function Print({
  uri,
  width,
  height,
  rotate = 0,
  border = 8,
  caption,
  meta,
  style,
  children,
}: {
  uri?: string;
  width: number;
  height?: number;
  rotate?: number;
  border?: number;
  /** Bold white caption set on the photo's lower edge. */
  caption?: string;
  meta?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const h = height ?? Math.round(width * 1.2);
  const inner = Math.max(4, radius.md - border);
  return (
    <View
      style={[styles.print, { width, height: h, padding: border, transform: [{ rotate: `${rotate}deg` }] }, style]}
    >
      <View style={{ flex: 1, borderRadius: inner, overflow: 'hidden', backgroundColor: colors.surface }}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
        {caption || meta ? (
          <>
            <MediaShade />
            <View style={styles.printCaption}>
              {caption ? (
                <Text style={styles.printTitle} numberOfLines={2}>
                  {caption}
                </Text>
              ) : null}
              {meta ? (
                <Text style={styles.printMeta} numberOfLines={1}>
                  {meta}
                </Text>
              ) : null}
            </View>
          </>
        ) : null}
        {children}
      </View>
    </View>
  );
}

/** Bottom-weighted dark gradient so white type reads on any photo. */
export function MediaShade({ from = 0.4, strength = 0.72 }: { from?: number; strength?: number }) {
  const id = useSvgId('shade');
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset={from} stopColor={colors.ink} stopOpacity="0" />
          <Stop offset="1" stopColor={colors.ink} stopOpacity={strength} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Sky: the soft vertical gradient behind most screens.
// `sky` deepens toward the top; `fade` melts sky into white paper; `soft` is the even
// pale blue of the "building your house" beat.

const SKY_STOPS = {
  sky: [
    { o: 0, c: colors.skyDeep },
    { o: 0.55, c: colors.sky },
    { o: 1, c: colors.skyHaze },
  ],
  fade: [
    { o: 0, c: colors.sky },
    { o: 0.5, c: colors.skyHaze },
    { o: 1, c: '#FFFFFF' },
  ],
  soft: [
    { o: 0, c: '#B9D3F0' },
    { o: 0.6, c: '#C8DCF3' },
    { o: 1, c: '#B4D2F0' },
  ],
} as const;

export function SkyBackground({
  variant = 'sky',
  style,
  children,
}: {
  variant?: keyof typeof SKY_STOPS;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const id = useSvgId('sky');
  const stops = SKY_STOPS[variant];
  return (
    <View style={[{ flex: 1, backgroundColor: stops[1].c }, style]}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {stops.map((s) => (
              <Stop key={s.o} offset={s.o} stopColor={s.c} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Wordmark. `text` is the small bold header mark; `chrome` is the balloon lettering,
// which carries its own sky and only belongs on sky backgrounds.

export function Wordmark({
  variant = 'text',
  size: fontSize = 28,
  width = 300,
  color = colors.text,
  style,
  onLongPress,
}: {
  variant?: 'text' | 'chrome';
  /** Font size of the text mark. */
  size?: number;
  /** Width of the chrome mark. */
  width?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  onLongPress?: () => void;
}) {
  if (variant === 'chrome') {
    // The source art has a stray print corner along its top edge; crop it off.
    const h = Math.round((width * 420) / 780);
    const crop = Math.round((width * 36) / 780);
    return (
      <View
        style={[{ width, height: h - crop, overflow: 'hidden' }, style]}
        accessible
        accessibilityRole="header"
        accessibilityLabel="openhouse"
      >
        <Image source={WORDMARK_CHROME} style={{ width, height: h, marginTop: -crop }} contentFit="cover" />
      </View>
    );
  }
  return (
    <Text
      style={[styles.wordmark, { fontSize, lineHeight: Math.round(fontSize * 1.1), letterSpacing: -fontSize * 0.055, color }, style as StyleProp<TextStyle>]}
      onLongPress={onLongPress}
      suppressHighlighting
      accessibilityRole="header"
    >
      openhouse
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Dock: the black floating pill. The active item is a white pill with its label; a
// `pink` item is the round add button.

export type DockItem = {
  key: string;
  label: string;
  icon: (color: string) => ReactNode;
  onPress: () => void;
  active?: boolean;
  tone?: 'pink';
};

export function Dock({ items, style }: { items: DockItem[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.dock, style]} accessibilityRole="tablist">
      {items.map((it) => {
        if (it.active) {
          return (
            <Press
              key={it.key}
              onPress={it.onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: true }}
              accessibilityLabel={it.label}
              haptic="none"
              style={styles.dockActive}
            >
              {it.icon(colors.text)}
              <Text style={styles.dockActiveText}>{it.label}</Text>
            </Press>
          );
        }
        return (
          <Press
            key={it.key}
            onPress={it.onPress}
            accessibilityRole={it.tone === 'pink' ? 'button' : 'tab'}
            accessibilityLabel={it.label}
            scaleTo={0.9}
            haptic={it.tone === 'pink' ? 'medium' : 'selection'}
            style={[styles.dockItem, it.tone === 'pink' && styles.dockPink]}
          >
            {it.icon(it.tone === 'pink' ? colors.text : 'rgba(255,255,255,0.86)')}
          </Press>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------

/** SVG gradient ids must be plain; React's useId contains colons. */
function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

const DOCK_H = 64;

const styles = StyleSheet.create({
  iconButton: {
    width: size.iconButton,
    height: size.iconButton,
    borderRadius: size.iconButton / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSurface: { backgroundColor: colors.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, ...shadow.chip },
  iconMedia: { backgroundColor: colors.scrim, ...shadow.chip },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: size.chip,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  chipTap: { minHeight: size.hit, paddingHorizontal: space.md },
  chipAccent: { backgroundColor: colors.pink },
  chipMedia: { backgroundColor: colors.scrim, ...shadow.chip },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, color: colors.text, textTransform: 'lowercase' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  sticker: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  stickerSmall: { minHeight: 26, paddingHorizontal: 10 },
  stickerPink: { backgroundColor: colors.pink, borderColor: colors.pinkEdge },
  stickerPaper: { backgroundColor: colors.bg, borderColor: colors.ink },
  stickerText: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, letterSpacing: -0.3, color: colors.text, textTransform: 'lowercase' },
  stickerTextSmall: { fontSize: 13, lineHeight: 16, letterSpacing: -0.2 },
  cutout: { backgroundColor: colors.bg, ...shadow.print },
  cutoutBlank: { flex: 1, backgroundColor: colors.skyHaze, alignItems: 'center', justifyContent: 'center' },
  cutoutInitial: { fontFamily: fonts.bold, color: colors.text, letterSpacing: -1 },
  print: { backgroundColor: colors.bg, borderRadius: radius.md, ...shadow.print },
  printCaption: { position: 'absolute', left: space.md, right: space.md, bottom: space.md, gap: 2 },
  printTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 25,
    letterSpacing: -0.9,
    color: colors.onMedia,
    textTransform: 'lowercase',
  },
  printMeta: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, color: 'rgba(255,255,255,0.88)', textTransform: 'lowercase' },
  wordmark: { fontFamily: fonts.bold, color: colors.text },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: DOCK_H,
    padding: 6,
    gap: space.xs,
    borderRadius: DOCK_H / 2,
    backgroundColor: colors.ink,
    ...shadow.float,
  },
  dockActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: DOCK_H - 12,
    paddingHorizontal: 20,
    borderRadius: (DOCK_H - 12) / 2,
    backgroundColor: colors.bg,
  },
  dockActiveText: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.3, color: colors.text, textTransform: 'lowercase' },
  dockItem: { width: DOCK_H - 12, height: DOCK_H - 12, borderRadius: (DOCK_H - 12) / 2, alignItems: 'center', justifyContent: 'center' },
  dockPink: { backgroundColor: colors.pink },
});
