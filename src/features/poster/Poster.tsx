import { useMemo } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import type { Person, Trip } from '@/lib/types';
import { colors } from '@/theme';

import { fitProjector, pathMiles } from './geo';

// Poster canvas in its own units; the SVG scales to `width` and keeps 3:4.
const W = 300;
const H = 400;
const MARGIN = 24;
const MAP = { x: MARGIN, y: 88, w: W - MARGIN * 2, h: 210 };
const MAP_PAD = 16;

type Props = {
  trip: Trip;
  /** Rendered width in px. Height is width * 4/3. */
  width: number;
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

/** Pure presentational trip poster. Colors come from the trip palette, falling back to theme tokens. */
export function Poster({ trip, width }: Props) {
  const paper = trip.palette[2] ?? colors.text;
  const ink = trip.palette[0] ?? colors.bg;
  const route = trip.palette[4] ?? colors.accent;
  const muted = trip.palette[3] ?? colors.textMuted;

  const { stops, project, faces, stats } = useMemo(() => {
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
    return { stops, project, faces, stats: posterStats(trip) };
  }, [trip]);

  const points = stops.map((s) => project(s));
  const FACE_R = 10;
  const swatch = 14;

  return (
    <Svg width={width} height={(width * H) / W} viewBox={`0 0 ${W} ${H}`}>
      <Rect x={0} y={0} width={W} height={H} fill={paper} />

      <SvgText x={MARGIN} y={48} fill={ink} fontSize={22} fontWeight="700">
        {trip.title}
      </SvgText>
      <SvgText x={MARGIN} y={68} fill={muted} fontSize={10}>
        {formatDate(trip.startAt, trip.endAt)}
      </SvgText>

      {points.length > 1 && (
        <Polyline
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={route}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {points.map((p, i) => (
        <Circle key={stops[i].id} cx={p.x} cy={p.y} r={3.5} fill={ink} />
      ))}

      <Defs>
        {faces.map((f) => (
          <ClipPath key={f.id} id={`face-${f.id}`}>
            <Circle cx={f.x} cy={f.y - FACE_R - 4} r={FACE_R} />
          </ClipPath>
        ))}
      </Defs>
      {faces.map((f) => {
        const cy = f.y - FACE_R - 4; // sit just above the stop so the dot stays visible
        return (
          <G key={f.id}>
            <Circle cx={f.x} cy={cy} r={FACE_R + 1.5} fill={paper} stroke={ink} strokeWidth={1} />
            {f.person.avatarUri ? (
              <SvgImage
                href={{ uri: f.person.avatarUri }}
                x={f.x - FACE_R}
                y={cy - FACE_R}
                width={FACE_R * 2}
                height={FACE_R * 2}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#face-${f.id})`}
              />
            ) : (
              <SvgText x={f.x} y={cy + 3.5} fill={ink} fontSize={10} fontWeight="600" textAnchor="middle">
                {f.person.name.slice(0, 1).toUpperCase()}
              </SvgText>
            )}
          </G>
        );
      })}

      <SvgText x={MARGIN} y={H - 52} fill={ink} fontSize={11}>
        {stats.line}
      </SvgText>

      {trip.palette.slice(0, 5).map((c, i) => (
        <Rect key={`${c}-${i}`} x={MARGIN + i * (swatch + 4)} y={H - 38} width={swatch} height={swatch} fill={c} />
      ))}
    </Svg>
  );
}
