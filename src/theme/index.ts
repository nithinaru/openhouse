// Placeholder tokens. The designer owns this folder; features import from here
// and never hard-code their own colors, sizes or fonts.

export const colors = {
  bg: '#0E1116',
  surface: '#171B22',
  text: '#F2EEE6',
  textMuted: '#9AA3AE',
  accent: '#D9A441',
  line: '#2A303A',
};

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 };

export const radius = { sm: 8, md: 14, lg: 24, full: 999 };

export const type = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 20, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text },
  caption: { fontSize: 13, color: colors.textMuted },
};

// Light-of-day tint for Replay. Designer replaces this ramp.
export function tintFor(hourOfDay: number, isGoldenHour?: boolean): string {
  if (isGoldenHour) return '#3A2A12';
  if (hourOfDay < 7 || hourOfDay >= 20) return '#0B1020';
  if (hourOfDay < 11) return '#1A2333';
  if (hourOfDay < 16) return '#1C2A30';
  return '#2A2218';
}
