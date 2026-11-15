// Openhouse design tokens. Every screen imports from here; nothing hard-codes its own
// colors, sizes, fonts or curves.
//
// Direction: a darkroom. Warm umber blacks instead of blue-black, paper-white type,
// one safelight amber used rarely (the primary action, the current stop, the date
// stamp). Display type is the iOS system serif (New York) for titles and narration;
// the interface itself is the system sans. The one signature detail is the stamp:
// times and dates set in mono amber, like the date imprint on a film print.

import { Platform } from 'react-native';
import { Easing } from 'react-native-reanimated';

// ---------------------------------------------------------------------------
// Color

/** Raw ramp. Screens use the semantic `colors` below, not these. */
const ramp = {
  umber950: '#0A0907', // letterbox, scrims
  umber900: '#12100D', // app background
  umber850: '#1A1713', // raised surface
  umber800: '#24201B', // elevated (sheets over surfaces, pressed rows)
  umber700: '#3A342C',
  paper50: '#F4EDE1', // primary text, "white"
  paper300: '#B5AB9C',
  paper400: '#A0968A', // secondary text, 7.0:1 on umber900
  paper600: '#6F675D', // faint meta only, never body copy
  safelight: '#E9A84C', // accent, 9.2:1 on umber900
  safelightInk: '#1A1206', // text on the accent, 10.4:1
  sage: '#86B58F',
  clay: '#D9735C',
};

export const colors = {
  bg: ramp.umber900,
  surface: ramp.umber850,
  elevated: ramp.umber800,
  ink: ramp.umber950,

  text: ramp.paper50,
  textMuted: ramp.paper400,
  textFaint: ramp.paper600,

  accent: ramp.safelight,
  accentInk: ramp.safelightInk,
  accentMuted: 'rgba(233,168,76,0.14)',

  /** Hairlines: paper at 10% / 18%. */
  line: 'rgba(244,237,225,0.10)',
  lineStrong: 'rgba(244,237,225,0.18)',

  success: ramp.sage,
  danger: ramp.clay,

  /** Controls that float over photos and maps. */
  scrim: 'rgba(10,9,7,0.56)',
  scrimStrong: 'rgba(10,9,7,0.82)',
  /** Paper at low alpha, for tracks and inactive dots over media. */
  veil: 'rgba(244,237,225,0.22)',
} as const;

// ---------------------------------------------------------------------------
// Type

/** System serif (New York) on iOS. Resolved by RN's font utils, no font files needed. */
export const fonts = {
  serif: Platform.select({ ios: 'ui-serif', android: 'serif', default: 'Georgia' }) as string,
  sans: Platform.select({ ios: 'System', default: undefined }) as string | undefined,
  mono: Platform.select({ ios: 'ui-monospace', android: 'monospace', default: 'Menlo' }) as string,
};

/** Weights: 400 and 500 for reading, 600 for rare emphasis. Nothing heavier. */
export const type = {
  /** Big serif headline: onboarding, title card. */
  display: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 42, color: colors.text, letterSpacing: -0.4 },
  /** Screen titles and trip names. */
  title: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: colors.text, letterSpacing: -0.2 },
  /** Card titles, section heads. */
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' as const, color: colors.text },
  /** Narration and quoted text. */
  story: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 30, color: colors.text },
  body: { fontSize: 17, lineHeight: 24, color: colors.text },
  callout: { fontSize: 15, lineHeight: 20, color: colors.text },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' as const, color: colors.text },
  caption: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  /** The signature: times and dates, mono amber, like a film date imprint. */
  stamp: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, color: colors.accent, fontVariant: ['tabular-nums' as const] },
};

// ---------------------------------------------------------------------------
// Space, shape, depth

/** 4pt grid. */
export const space = { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 40, xxl: 56 };

/** Controls 12, cards 16, sheets 24. Chips and round buttons use `full`. */
export const radius = { xs: 6, sm: 8, md: 12, lg: 16, xl: 24, full: 999 };

/** Minimum touch target and standard control heights. */
export const size = { hit: 44, button: 52, chip: 32, iconButton: 40, icon: 18 };

/** Neutral, soft shadows only, for things that float over imagery. */
export const shadow = {
  print: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  float: { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
} as const;

// ---------------------------------------------------------------------------
// Motion

/** One ease-out for UI, one in-out for things that travel across the screen. */
export const ease = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
};

export const duration = {
  press: 110,
  release: 160,
  fast: 200,
  base: 280,
  enter: 360,
  slow: 560,
  cinematic: 900,
};

// ---------------------------------------------------------------------------
// Film (Replay)

export const film = {
  letterboxH: 54,
  /** Opacity of the light-of-day wash over the map. */
  tintOpacity: 0.36,
  tintFadeMs: 1400,
};

// ---------------------------------------------------------------------------
// Light of day
//
// The wash laid over the Replay map, from the hour each stop was shot. Night and
// blue hour lean cool, midday stays nearly neutral, afternoon warms, golden hour is
// the one strong amber. Kept dark so paper-white captions always read on top.

const LIGHT = [
  { until: 5, color: '#0B0E1C' }, // night
  { until: 7, color: '#1B2240' }, // blue hour, dawn
  { until: 10, color: '#2E3A4A' }, // morning, cool
  { until: 15, color: '#33352F' }, // midday, neutral
  { until: 18, color: '#4A3822' }, // afternoon, warming
  { until: 20, color: '#1E2142' }, // dusk, blue hour
  { until: 24, color: '#0B0E1C' }, // night
];
const GOLDEN = '#7A4A16';

export function tintFor(hourOfDay: number, isGoldenHour?: boolean): string {
  if (isGoldenHour) return GOLDEN;
  const h = ((hourOfDay % 24) + 24) % 24;
  return (LIGHT.find((l) => h < l.until) ?? LIGHT[LIGHT.length - 1]).color;
}
