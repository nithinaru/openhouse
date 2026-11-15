// Sticker sheet. Front: die-cut stickers of the stops and the people on a white sheet, pink
// with dashed edges like the app's own tags. Back: the backing paper with the kiss-cut
// outlines where each sticker peels from.

import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Path, Rect, Text as SvgText } from 'react-native-svg';

import { colors } from '@/theme';

import { MONO, Pill, RouteGlyph, SANS_BOLD, starD, useSvgIds, type DesignProps } from './shared';

export const STICKERS_BOX = { w: 200, h: 250 };

const FACES = [
  { x: 48, y: 84, r: 17, rot: -6 },
  { x: 100, y: 92, r: 19, rot: 3 },
  { x: 152, y: 82, r: 16, rot: 7 },
];
const STOPS = [
  { x: 64, y: 206, rot: -6 },
  { x: 142, y: 196, rot: 5 },
  { x: 130, y: 224, rot: -3 },
  { x: 58, y: 228, rot: 4 },
];

export function Stickers({ art, side, edition, width }: DesignProps & { width: number }) {
  const ids = useSvgIds('face');
  const ghost = side === 'back';
  const edge = 'rgba(10,10,10,0.18)';
  const ink = art.ink.dark;
  const names = Array.from(new Set(art.stops.map((s) => s.name))).filter((n) => n !== art.venueName).slice(0, STOPS.length);
  const people = art.people.slice(0, FACES.length);
  const headline = edition === 'was_there' ? 'i was there' : art.eventTitle;

  return (
    <Svg width={width} height={(width * STICKERS_BOX.h) / STICKERS_BOX.w} viewBox={`0 0 ${STICKERS_BOX.w} ${STICKERS_BOX.h}`}>
      <Rect x={8} y={8} width={184} height={234} rx={8} fill={ghost ? '#F3F2EE' : colors.bg} stroke="rgba(10,10,10,0.08)" strokeWidth={0.8} />

      <Pill x={100} y={38} label={headline} size={headline.length > 12 ? 8 : 11} rotate={-5} ghost={ghost} />

      {people.map((p, i) => {
        const f = FACES[i];
        const cid = `${ids.face}${i}`;
        return (
          <G key={p.id} transform={`rotate(${f.rot} ${f.x} ${f.y})`}>
            {ghost ? (
              <Circle cx={f.x} cy={f.y} r={f.r + 3} fill="none" stroke={edge} strokeWidth={0.8} strokeDasharray="2 1.4" />
            ) : (
              <>
                <Defs>
                  <ClipPath id={cid}>
                    <Circle cx={f.x} cy={f.y} r={f.r} />
                  </ClipPath>
                </Defs>
                <Circle cx={f.x} cy={f.y} r={f.r + 3} fill={colors.pink} stroke={colors.pinkEdge} strokeWidth={0.9} strokeDasharray="2 1.4" />
                <Circle cx={f.x} cy={f.y} r={f.r + 0.6} fill={colors.bg} />
                {p.uri ? (
                  <SvgImage
                    href={{ uri: p.uri }}
                    x={f.x - f.r}
                    y={f.y - f.r}
                    width={f.r * 2}
                    height={p.aspect < 0.7 ? (f.r * 2) / p.aspect : f.r * 2}
                    preserveAspectRatio="xMidYMin slice"
                    clipPath={`url(#${cid})`}
                  />
                ) : (
                  <Circle cx={f.x} cy={f.y} r={f.r} fill={colors.skyHaze} />
                )}
              </>
            )}
            <Pill x={f.x} y={f.y + f.r + 7} label={p.name} size={5} rotate={-f.rot - 3} ghost={ghost} />
          </G>
        );
      })}

      {/* route sticker */}
      <G transform="rotate(4 69 157)">
        <Rect
          x={30}
          y={128}
          width={78}
          height={58}
          rx={10}
          fill={ghost ? 'none' : colors.bg}
          stroke={ghost ? edge : colors.ink}
          strokeWidth={0.9}
          strokeDasharray="2.2 1.4"
        />
        {!ghost ? (
          <>
            <RouteGlyph art={art} box={{ x: 38, y: 134, w: 62, h: 38 }} color={ink} accent={art.ink.accent} stroke={1.1} dot={1.3} />
            <SvgText x={69} y={181} fontSize={3.6} fontFamily={MONO} fill={ink} textAnchor="middle" letterSpacing={0.3}>
              {art.dateStamp}
            </SvgText>
          </>
        ) : null}
      </G>

      {/* venue star */}
      <G transform="rotate(-8 150 150)">
        {!ghost ? <Path d={starD(150, 150, 28, 0.62)} fill={colors.bg} /> : null}
        <Path
          d={starD(150, 150, 25, 0.62)}
          fill={ghost ? 'none' : art.ink.accent}
          stroke={ghost ? edge : colors.ink}
          strokeOpacity={ghost ? 1 : 0.2}
          strokeWidth={0.8}
          strokeDasharray={ghost ? '2 1.4' : undefined}
        />
        {!ghost ? (
          <SvgText x={150} y={154} fontSize={art.venueName.length > 4 ? 6 : 11} fontFamily={SANS_BOLD} fill={colors.ink} textAnchor="middle" letterSpacing={-0.4}>
            {art.venueName}
          </SvgText>
        ) : null}
      </G>

      <Pill x={162} y={116} label={art.dateStamp} size={4.6} rotate={8} tone="paper" ghost={ghost} />

      {names.map((n, i) => (
        <Pill key={n} x={STOPS[i].x} y={STOPS[i].y} label={n} size={6} rotate={STOPS[i].rot} tone={i === 1 ? 'paper' : 'pink'} ghost={ghost} />
      ))}

      {ghost ? (
        <SvgText x={100} y={238} fontSize={3.6} fontFamily={MONO} fill="rgba(10,10,10,0.4)" textAnchor="middle" letterSpacing={0.6}>
          {`openhouse · the drop · ${art.dateStamp} · peel slowly`}
        </SvgText>
      ) : null}
    </Svg>
  );
}
