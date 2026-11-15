// Shared drawing pieces for the drop designs: type, the route glyph, sticker pills, the
// fabric shade, and wrapped text. Every design is a pure SVG of the trip's art.

import { useId, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { colors, fonts } from '@/theme';

import type { DropArt, Edition, Side } from '../model';

export const SANS_BOLD = fonts.bold;
export const SANS_SEMI = fonts.semibold;
export const SANS = fonts.medium;
export const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export type DesignProps = { art: DropArt; side: Side; edition: Edition; /** "nº 113 / 180" on was-there pieces */ serial?: string };

/** SVG ids must be plain; React's useId has colons. */
export function useSvgIds<const K extends string>(...keys: K[]): Record<K, string> {
  const base = useId().replace(/[^a-zA-Z0-9]/g, '');
  const out = {} as Record<K, string>;
  for (const k of keys) out[k] = `${k}${base}`;
  return out;
}

export type Box = { x: number; y: number; w: number; h: number };

export function routeD(route: { x: number; y: number }[], box: Box): string {
  return route
    .map((p, i) => `${i ? 'L' : 'M'}${(box.x + p.x * box.w).toFixed(2)} ${(box.y + p.y * box.h).toFixed(2)}`)
    .join(' ');
}

export function starD(cx: number, cy: number, r: number, inner = 0.45): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inner : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

/** The route through every stop, stop dots, and a star at the venue. */
export function RouteGlyph({
  art,
  box,
  color,
  accent,
  stroke = 1.4,
  dot = 1.6,
  numbers,
  dash,
}: {
  art: DropArt;
  box: Box;
  color: string;
  accent: string;
  stroke?: number;
  dot?: number;
  /** Draw stop numbers next to the dots (big back prints only). */
  numbers?: boolean;
  /** Stitch look for embroidery. */
  dash?: string;
}) {
  const seen = new Set<string>();
  return (
    <G>
      <Path
        d={routeD(art.route, box)}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash}
      />
      {art.stops.map((s, i) => {
        const x = box.x + s.x * box.w;
        const y = box.y + s.y * box.h;
        const key = `${Math.round(x / 3)}:${Math.round(y / 3)}`;
        const dup = seen.has(key);
        seen.add(key);
        if (i === art.venueIndex) return <Path key={s.id} d={starD(x, y, dot * 2.6)} fill={accent} />;
        return (
          <G key={s.id}>
            <Circle cx={x} cy={y} r={dot} fill={accent} stroke={color} strokeWidth={stroke * 0.5} />
            {numbers && !dup ? (
              <SvgText x={x + dot + 1.6} y={y + dot * 0.9} fontSize={dot * 2.6} fontFamily={MONO} fill={color}>
                {i + 1}
              </SvgText>
            ) : null}
          </G>
        );
      })}
    </G>
  );
}

/** Approximate advance width of Inter Tight at `size`, for sizing pills. */
export const textW = (s: string, size: number, k = 0.56) => s.length * size * k;

/** A die-cut sticker pill: pink fill, dashed pink edge, ink label. */
export function Pill({
  x,
  y,
  label,
  size = 7,
  rotate = 0,
  tone = 'pink',
  ghost,
}: {
  /** Center. */
  x: number;
  y: number;
  label: string;
  size?: number;
  rotate?: number;
  tone?: 'pink' | 'paper' | 'ink';
  /** Backing-paper ghost: just the kiss-cut outline. */
  ghost?: boolean;
}) {
  const h = size * 2.1;
  const w = textW(label, size) + h * 0.9;
  const fill = ghost ? 'none' : tone === 'pink' ? colors.pink : tone === 'ink' ? colors.ink : colors.bg;
  const edge = ghost ? 'rgba(10,10,10,0.18)' : tone === 'paper' ? colors.ink : colors.pinkEdge;
  return (
    <G transform={`rotate(${rotate} ${x} ${y})`}>
      {!ghost ? <Rect x={x - w / 2 - 2} y={y - h / 2 - 2} width={w + 4} height={h + 4} rx={(h + 4) / 2} fill={colors.bg} /> : null}
      <Rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={h / 2}
        fill={fill}
        stroke={edge}
        strokeWidth={size * 0.13}
        strokeDasharray={`${size * 0.42} ${size * 0.3}`}
      />
      {!ghost ? (
        <SvgText
          x={x}
          y={y + size * 0.36}
          fontSize={size}
          fontFamily={SANS_BOLD}
          fill={tone === 'ink' ? colors.bg : colors.ink}
          textAnchor="middle"
          letterSpacing={-size * 0.02}
        >
          {label}
        </SvgText>
      ) : null}
    </G>
  );
}

/** Soft light-to-shadow wash over a garment, clipped to its outline by reusing the path. */
export function FabricShade({ id, d, strength = 1 }: { id: string; d: string; strength?: number }) {
  return (
    <>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.16 * strength} />
          <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.16 * strength} />
        </LinearGradient>
      </Defs>
      <Path d={d} fill={`url(#${id})`} />
    </>
  );
}

/** Soft fold lines so flat garments read as cloth. */
export function Folds({ paths, dark }: { paths: string[]; dark?: boolean }) {
  return (
    <G>
      {paths.map((p) => (
        <Path key={p} d={p} stroke={dark ? '#FFFFFF' : '#000000'} strokeOpacity={dark ? 0.06 : 0.07} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      ))}
    </G>
  );
}

/** Greedy wrap by character count (Inter Tight is close enough to monospace at this scale). */
export function wrap(text: string, perLine: number, maxLines = 3): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > perLine && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.,;]?$/, '')}…`;
    return kept;
  }
  return lines;
}

export function Lines({
  lines,
  x,
  y,
  size,
  lh,
  fill,
  family = SANS,
  anchor = 'middle',
  spacing,
}: {
  lines: string[];
  x: number;
  y: number;
  size: number;
  lh: number;
  fill: string;
  family?: string;
  anchor?: 'start' | 'middle' | 'end';
  spacing?: number;
}) {
  return (
    <G>
      {lines.map((l, i) => (
        <SvgText key={`${i}-${l}`} x={x} y={y + i * lh} fontSize={size} fontFamily={family} fill={fill} textAnchor={anchor} letterSpacing={spacing}>
          {l}
        </SvgText>
      ))}
    </G>
  );
}

/** Woven hem patch for the was-there edition. */
export function EditionPatch({ x, y, serial, rotate = 0 }: { x: number; y: number; serial?: string; rotate?: number }) {
  const label = serial ? `was there · ${serial}` : 'was there';
  const w = textW(label, 4.4, 0.6) + 8;
  return (
    <G transform={`rotate(${rotate} ${x} ${y})`}>
      <Rect x={x - w / 2} y={y - 5} width={w} height={10} rx={1.5} fill={colors.pink} stroke={colors.pinkEdge} strokeWidth={0.6} strokeDasharray="1.4 1" />
      <SvgText x={x} y={y + 1.6} fontSize={4.4} fontFamily={MONO} fill={colors.ink} textAnchor="middle">
        {label}
      </SvgText>
    </G>
  );
}

export function Group({ children }: { children: ReactNode }) {
  return <G>{children}</G>;
}
