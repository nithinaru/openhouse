// Openhouse design tokens. Every screen imports from here; nothing hard-codes its own
// colors, sizes, fonts or curves.
//
// Direction: a sticker scrapbook in the sky. White paper and soft sky blue, ink-black
// type and black pill buttons, one sticker pink for name tags, chrome only in the
// wordmark. Inter Tight everywhere, all lowercase: bold and tight for headlines, medium
// for reading. The signature detail is the sticker: a pink tag with a dashed edge,
// slapped on slightly crooked, naming who stood where.

import { Easing } from 'react-native-reanimated';

// ---------------------------------------------------------------------------
// Color

/** Raw ramp. Screens use the semantic `colors` below, not these. */
const ramp = {
  paper: '#FFFFFF',
  mist: '#F2F3F5', // chips, quiet fills
  cloud: '#E7E9ED', // pressed, elevated fills
  ink: '#0A0A0A', // type, pills, the dock
  slate: '#525A68', // secondary text, 7.0:1 on paper, 4.4:1 on sky
  haze: '#8E95A1', // faint meta only
  sky: '#B4D2F0',
  skyDeep: '#9CC3EC',
  skyHaze: '#DCEAF8',
  pink: '#F7C5DD', // sticker fill
  pinkEdge: '#E2549E', // sticker dashed edge
  sage: '#3E9B6A',
  clay: '#D2484B',
};

export const colors = {
  bg: ramp.paper,
  surface: ramp.mist,
  elevated: ramp.cloud,
  ink: ramp.ink,

  text: ramp.ink,
  textMuted: ramp.slate,
  textFaint: ramp.haze,

  /** The primary action is a black pill; "accent" is ink in this brand. */
  accent: ramp.ink,
  accentInk: ramp.paper,
  accentMuted: 'rgba(10,10,10,0.06)',

  /** Hairlines: ink at 8% / 16%. */
  line: 'rgba(10,10,10,0.08)',
  lineStrong: 'rgba(10,10,10,0.16)',

  success: ramp.sage,
  danger: ramp.clay,

  /** Controls that float over photos and maps: white paper discs and pills. */
  scrim: 'rgba(255,255,255,0.92)',
  scrimStrong: 'rgba(255,255,255,0.97)',
  /** Ink at low alpha, for tracks and inactive dots. */
  veil: 'rgba(10,10,10,0.14)',

  // Rebrand additions
  sky: ramp.sky,
  skyDeep: ramp.skyDeep,
  skyHaze: ramp.skyHaze,
  pink: ramp.pink,
  pinkEdge: ramp.pinkEdge,
  /** Type set directly on a photo. */
  onMedia: '#FFFFFF',
  /** Darkens a camera feed or photo behind white type. */
  shade: 'rgba(10,10,10,0.45)',
} as const;

// ---------------------------------------------------------------------------
// Type

/** Inter Tight, loaded in the root layout. `serif`/`sans`/`mono` stay as aliases. */
export const fonts = {
  regular: 'InterTight_400Regular',
  medium: 'InterTight_500Medium',
  semibold: 'InterTight_600SemiBold',
  bold: 'InterTight_700Bold',
  /** Headlines (was the system serif). */
  serif: 'InterTight_700Bold',
  sans: 'InterTight_500Medium',
  /** Times and counts (tabular figures via fontVariant). */
  mono: 'InterTight_500Medium',
};

const lower = 'lowercase' as const;

/** Bold and tight for headlines, medium for reading. Everything lowercase. */
export const type = {
  /** Big headline: onboarding, title card. */
  display: { fontFamily: fonts.bold, fontSize: 36, lineHeight: 38, color: colors.text, letterSpacing: -1.4, textTransform: lower },
  /** Screen titles and trip names. */
  title: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 32, color: colors.text, letterSpacing: -1.1, textTransform: lower },
  /** Card titles, section heads. */
  heading: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 24, color: colors.text, letterSpacing: -0.5, textTransform: lower },
  /** Narration and quoted text. */
  story: { fontFamily: fonts.medium, fontSize: 21, lineHeight: 28, color: colors.text, letterSpacing: -0.3, textTransform: lower },
  body: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 24, color: colors.text, textTransform: lower },
  callout: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.text, textTransform: lower },
  label: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.text, textTransform: lower },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.textMuted, textTransform: lower },
  /** Times and dates: quiet tabular figures. */
  stamp: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
    fontVariant: ['tabular-nums' as const],
    textTransform: lower,
  },
};

// ---------------------------------------------------------------------------
// Space, shape, depth

/** 4pt grid. */
export const space = { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 40, xxl: 56 };

/** Controls 10, cards 20, sheets 28. Buttons, chips and stickers use `full`. */
export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, full: 999 };

/** Minimum touch target and standard control heights. */
export const size = { hit: 44, button: 56, chip: 36, iconButton: 40, icon: 18 };

/** Soft, slightly blue shadows: prints and cutouts lifted off paper or sky. */
export const shadow = {
  print: { shadowColor: '#1B2B44', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  float: { shadowColor: '#1B2B44', shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 14 } },
  /** Small lift for white discs and pills over imagery. */
  chip: { shadowColor: '#1B2B44', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
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
  /** Opacity of the light-of-day wash over the map. Kept subtle on a light map. */
  tintOpacity: 0.16,
  tintFadeMs: 1400,
};

// ---------------------------------------------------------------------------
// Light of day
//
// The wash laid over the Replay map, from the hour each stop was shot. Night leans
// deep blue, blue hour periwinkle, midday almost paper, afternoon warms, golden hour
// is the one strong apricot. Light enough that ink captions always read on top.

const LIGHT = [
  { until: 5, color: '#2A3B66' }, // night
  { until: 7, color: '#6E86C4' }, // blue hour, dawn
  { until: 10, color: '#B4D2F0' }, // morning, sky
  { until: 15, color: '#F4F1E8' }, // midday, paper
  { until: 18, color: '#F2D9B0' }, // afternoon, warming
  { until: 20, color: '#B9A8E0' }, // dusk
  { until: 24, color: '#2A3B66' }, // night
];
const GOLDEN = '#F5B565';

export function tintFor(hourOfDay: number, isGoldenHour?: boolean): string {
  if (isGoldenHour) return GOLDEN;
  const h = ((hourOfDay % 24) + 24) % 24;
  return (LIGHT.find((l) => h < l.until) ?? LIGHT[LIGHT.length - 1]).color;
}
