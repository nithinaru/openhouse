import { useMemo, type ReactNode } from 'react';
import { Platform } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  Line,
  Path,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import type { Person, Trip } from '@/lib/types';
import { colors } from '@/theme';

import { fitProjector, pathMiles } from './geo';

// Poster canvas in its own units; the SVG scales to `width` and keeps 3:4.
const W = 300;
const H = 400;
const MARGIN = 24;
const MAP = { x: MARGIN, y: 88, w: W - MARGIN * 2, h: 210 };
const MAP_PAD = 16;

const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export type PosterVariant = 'minimal' | 'night' | 'field';

export const POSTER_VARIANTS: { id: PosterVariant; label: string }[] = [
  { id: 'minimal', label: 'Minimal light' },
  { id: 'night', label: 'Night map' },
  { id: 'field', label: 'Field notes' },
];

type Props = {
  trip: Trip;
  /** Rendered width in px. Height is width * 4/3. */
  width: number;
  /** Visual style. Defaults to 'minimal'. */
  variant?: PosterVariant;
};

export function posterStats(trip: Trip) {
  const stops = [...trip.moments].sort((a, b) => a.order - b.order);
  const miles = pathMiles(stops);
  const people = trip.people.length;
  return {
    miles,
    stops: stops.length,
    people,
    line: `${miles.toFixed(1)} mi · ${stops.length} ${stops.length === 1 ? 'stop' : 'stops'} · ${people} ${people === 1 ? 'person' : 'people'}`,
  };
}

function formatDate(startAt: number, endAt: number): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  const a = new Date(startAt).toLocaleDateString('en-US', opts);
  const b = new Date(endAt).toLocaleDateString('en-US', opts);
  return a === b ? a : `${a} – ${b}`;
}

function formatCoord(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;
}

/** Pure presentational trip poster. Colors come from the trip palette, falling back to theme tokens. */
export function Poster({ trip, width, variant = 'minimal' }: Props) {
  const { stops, points, faces, stats } = useMemo(() => {
    const stops = [...trip.moments].sort((a, b) => a.order - b.order);
    const inner = { x: MAP.x + MAP_PAD, y: MAP.y + MAP_PAD, w: MAP.w - MAP_PAD * 2, h: MAP.h - MAP_PAD * 2 };
    const project = fitProjector([...stops, ...trip.pairings], inner);
    const byId = new Map<string, Person>(trip.people.map((p) => [p.id, p]));
    const faces = trip.pairings
      .map((pr) => {
        const friendId = pr.userA === trip.userId ? pr.userB : pr.userA;
        const person = byId.get(friendId);
        return person ? { id: pr.id, person, ...project(pr) } : null;
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);
    return { stops, points: stops.map((s) => project(s)), faces, stats: posterStats(trip) };
  }, [trip]);

  const id = `${variant}-${trip.id}`; // keeps clip ids unique when several posters render at once
  const shared = { trip, stops, points, faces, stats, id };

  return (
    <Svg width={width} height={(width * H) / W} viewBox={`0 0 ${W} ${H}`}>
      {variant === 'night' ? <Night {...shared} /> : variant === 'field' ? <Field {...shared} /> : <Minimal {...shared} />}
    </Svg>
  );
}

type Shared = {
  trip: Trip;
  stops: Trip['moments'];
  points: { x: number; y: number }[];
  faces: { id: string; person: Person; x: number; y: number }[];
  stats: ReturnType<typeof posterStats>;
  id: string;
};

const FACE_R = 10;

function Faces({ faces, id, ring, paper, ink }: { faces: Shared['faces']; id: string; ring: string; paper: string; ink: string }) {
  return (
    <>
      <Defs>
        {faces.map((f) => (
          <ClipPath key={f.id} id={`face-${id}-${f.id}`}>
            <Circle cx={f.x} cy={f.y - FACE_R - 4} r={FACE_R} />
          </ClipPath>
        ))}
      </Defs>
      {faces.map((f) => {
        const cy = f.y - FACE_R - 4; // sit just above the stop so the dot stays visible
        return (
          <G key={f.id}>
            <Circle cx={f.x} cy={cy} r={FACE_R + 1.5} fill={paper} stroke={ring} strokeWidth={1.2} />
            {f.person.avatarUri ? (
              <SvgImage
                href={{ uri: f.person.avatarUri }}
                x={f.x - FACE_R}
                y={cy - FACE_R}
                width={FACE_R * 2}
                height={FACE_R * 2}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#face-${id}-${f.id})`}
              />
            ) : (
              <SvgText x={f.x} y={cy + 3.5} fill={ink} fontSize={10} fontWeight="600" textAnchor="middle">
                {f.person.name.slice(0, 1).toUpperCase()}
              </SvgText>
            )}
          </G>
        );
      })}
    </>
  );
}

const pts = (points: Shared['points']) => points.map((p) => `${p.x},${p.y}`).join(' ');

// ── Minimal light: paper, one ink, one route color. ──────────────────────────
function Minimal({ trip, stops, points, faces, stats, id }: Shared) {
  const paper = trip.palette[2] ?? colors.bg;
  const ink = trip.palette[0] ?? colors.ink;
  const route = trip.palette[4] ?? colors.pinkEdge;
  const muted = trip.palette[3] ?? colors.textMuted;
  const swatch = 14;

  return (
    <>
      <Rect x={0} y={0} width={W} height={H} fill={paper} />
      <SvgText x={MARGIN} y={48} fill={ink} fontSize={22} fontWeight="700">
        {trip.title}
      </SvgText>
      <SvgText x={MARGIN} y={68} fill={muted} fontSize={10}>
        {formatDate(trip.startAt, trip.endAt)}
      </SvgText>
      <Line x1={MARGIN} y1={78} x2={W - MARGIN} y2={78} stroke={ink} strokeOpacity={0.15} strokeWidth={0.6} />

      {points.length > 1 && (
        <Polyline points={pts(points)} fill="none" stroke={route} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {points.map((p, i) => (
        <Circle key={stops[i].id} cx={p.x} cy={p.y} r={3.5} fill={ink} />
      ))}
      <Faces faces={faces} id={id} ring={ink} paper={paper} ink={ink} />

      <SvgText x={MARGIN} y={H - 52} fill={ink} fontSize={11}>
        {stats.line}
      </SvgText>
      {trip.palette.slice(0, 5).map((c, i) => (
        <Rect key={`${c}-${i}`} x={MARGIN + i * (swatch + 4)} y={H - 38} width={swatch} height={swatch} fill={c} />
      ))}
    </>
  );
}

// ── Night map: dark sheet, faint grid, glowing route. ────────────────────────
function Night({ trip, stops, points, faces, stats, id }: Shared) {
  const paper = '#0D1424';
  const ink = '#EDE6D6';
  const glow = trip.palette[1] ?? '#D9A441';
  const muted = '#7E8AA3';
  const first = stops[0];

  const grid: ReactNode[] = [];
  for (let x = MAP.x; x <= MAP.x + MAP.w + 0.1; x += 21) {
    grid.push(<Line key={`gx${x}`} x1={x} y1={MAP.y} x2={x} y2={MAP.y + MAP.h} stroke={ink} strokeOpacity={0.06} strokeWidth={0.5} />);
  }
  for (let y = MAP.y; y <= MAP.y + MAP.h + 0.1; y += 21) {
    grid.push(<Line key={`gy${y}`} x1={MAP.x} y1={y} x2={MAP.x + MAP.w} y2={y} stroke={ink} strokeOpacity={0.06} strokeWidth={0.5} />);
  }

  return (
    <>
      <Rect x={0} y={0} width={W} height={H} fill={paper} />
      {grid}
      <SvgText x={W / 2} y={44} fill={ink} fontSize={15} fontWeight="600" letterSpacing={3} textAnchor="middle">
        {trip.title.toUpperCase()}
      </SvgText>
      <SvgText x={W / 2} y={62} fill={muted} fontSize={7.5} fontFamily={MONO} letterSpacing={1} textAnchor="middle">
        {first ? formatCoord(first.lat, first.lng) : formatDate(trip.startAt, trip.endAt)}
      </SvgText>

      {points.length > 1 && (
        <>
          <Polyline points={pts(points)} fill="none" stroke={glow} strokeOpacity={0.12} strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />
          <Polyline points={pts(points)} fill="none" stroke={glow} strokeOpacity={0.3} strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round" />
          <Polyline points={pts(points)} fill="none" stroke="#FFE7B0" strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
      {points.map((p, i) => (
        <G key={stops[i].id}>
          <Circle cx={p.x} cy={p.y} r={7} fill={glow} fillOpacity={0.18} />
          <Circle cx={p.x} cy={p.y} r={2.6} fill="#FFF4D6" />
        </G>
      ))}
      <Faces faces={faces} id={id} ring={glow} paper={paper} ink={ink} />

      <Line x1={MARGIN} y1={H - 66} x2={W - MARGIN} y2={H - 66} stroke={ink} strokeOpacity={0.15} strokeWidth={0.5} />
      <SvgText x={W / 2} y={H - 46} fill={ink} fontSize={9} fontFamily={MONO} letterSpacing={1.2} textAnchor="middle">
        {stats.line.toUpperCase()}
      </SvgText>
      <SvgText x={W / 2} y={H - 30} fill={muted} fontSize={7.5} letterSpacing={2} textAnchor="middle">
        {formatDate(trip.startAt, trip.endAt).toUpperCase()}
      </SvgText>
    </>
  );
}

// ── Field notes: kraft paper, serif, dashed route, numbered stops. ───────────
function Field({ trip, stops, points, faces, stats, id }: Shared) {
  const paper = '#EADFC8';
  const ink = '#3B2F22';
  const route = trip.palette[4] ?? '#A2472B';
  const muted = '#8A7558';
  const nx = MAP.x + MAP.w - 14;
  const ny = MAP.y + 18;
  const legend = stops.slice(0, 6);

  return (
    <>
      <Rect x={0} y={0} width={W} height={H} fill={paper} />
      <Rect x={10} y={10} width={W - 20} height={H - 20} fill="none" stroke={ink} strokeOpacity={0.35} strokeWidth={0.6} />
      <SvgText x={MARGIN} y={50} fill={ink} fontSize={24} fontFamily={SERIF} fontStyle="italic">
        {trip.title}
      </SvgText>
      <SvgText x={MARGIN} y={68} fill={muted} fontSize={9} fontFamily={SERIF}>
        {formatDate(trip.startAt, trip.endAt)}
      </SvgText>

      <Rect x={MAP.x} y={MAP.y} width={MAP.w} height={MAP.h} fill="none" stroke={ink} strokeOpacity={0.4} strokeWidth={0.6} strokeDasharray="1.5 2.5" />
      {/* Compass */}
      <Path d={`M${nx} ${ny - 9} L${nx + 3.5} ${ny + 3} L${nx} ${ny + 1} L${nx - 3.5} ${ny + 3} Z`} fill={ink} />
      <SvgText x={nx} y={ny + 13} fill={ink} fontSize={7} fontFamily={SERIF} textAnchor="middle">
        N
      </SvgText>

      {points.length > 1 && (
        <Polyline points={pts(points)} fill="none" stroke={route} strokeWidth={1.6} strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {points.map((p, i) => (
        <G key={stops[i].id}>
          <Circle cx={p.x} cy={p.y} r={6} fill={paper} stroke={ink} strokeWidth={1} />
          <SvgText x={p.x} y={p.y + 2.6} fill={ink} fontSize={7} fontFamily={SERIF} fontWeight="700" textAnchor="middle">
            {i + 1}
          </SvgText>
        </G>
      ))}
      <Faces faces={faces} id={id} ring={ink} paper={paper} ink={ink} />

      {legend.map((s, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        return (
          <SvgText key={s.id} x={MARGIN + col * 128} y={318 + row * 13} fill={ink} fontSize={8} fontFamily={SERIF}>
            {`${i + 1}  ${s.placeName ?? 'Stop'}`}
          </SvgText>
        );
      })}

      <Line x1={MARGIN} y1={H - 44} x2={W - MARGIN} y2={H - 44} stroke={ink} strokeOpacity={0.3} strokeWidth={0.5} />
      <SvgText x={MARGIN} y={H - 28} fill={ink} fontSize={9} fontFamily={SERIF} fontStyle="italic">
        {stats.line}
      </SvgText>
    </>
  );
}
