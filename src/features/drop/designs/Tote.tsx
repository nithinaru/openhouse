// Cutout tote. Front: everyone from the day as cardboard standees on one ground line, each
// with a pink name sticker. Back: the venue set big over a faint route.

import Svg, { ClipPath, Defs, G, Image as SvgImage, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { colors } from '@/theme';

import { EditionPatch, FabricShade, MONO, Pill, RouteGlyph, SANS, SANS_BOLD, useSvgIds, type DesignProps } from './shared';

export const TOTE_BOX = { w: 200, h: 230 };

const BAG = 'M30 72 L170 72 L174 222 Q174 226 170 226 L30 226 Q26 226 26 222 Z';
const CANVAS = '#EFE7D6';

export function Tote({ art, side, edition, serial, width }: DesignProps & { width: number }) {
  const ids = useSvgIds('shade', 'clip');
  const ink = art.ink.dark;
  const accent = art.ink.accent;
  const front = side === 'front';
  const people = art.people.length ? art.people : [{ id: 'you', name: 'you', aspect: 0.4 }];

  const H = people.length > 3 ? 56 : 66;
  const ground = 182;
  const span = 120;
  const slots = people.map((p) => Math.max(22, Math.min(46, H * (p.aspect || 0.4))));
  const gap = Math.max(4, (span - slots.reduce((s, w) => s + w, 0)) / Math.max(1, people.length - 1));
  const start = 100 - (slots.reduce((s, w) => s + w, 0) + gap * (people.length - 1)) / 2;
  const xs = slots.map((_, i) => start + slots.slice(0, i).reduce((s, w) => s + w + gap, 0));

  return (
    <Svg width={width} height={(width * TOTE_BOX.h) / TOTE_BOX.w} viewBox={`0 0 ${TOTE_BOX.w} ${TOTE_BOX.h}`}>
      {/* handles: the back one first, slightly darker */}
      <Path d="M76 74 L76 30 Q76 14 92 14 L108 14 Q124 14 124 30 L124 74" stroke="#D9CFBA" strokeWidth={8} fill="none" />
      <Path d="M70 76 L70 36 Q70 20 86 20 L114 20 Q130 20 130 36 L130 76" stroke={CANVAS} strokeWidth={9} fill="none" />
      <Path d="M70 76 L70 36 Q70 20 86 20 L114 20 Q130 20 130 36 L130 76" stroke="#000" strokeOpacity={0.08} strokeWidth={9} fill="none" strokeDasharray="0.6 2.4" />
      <Path d={BAG} fill={CANVAS} />
      <Line x1={30} y1={80} x2={170} y2={80} stroke="#000" strokeOpacity={0.08} strokeWidth={0.8} strokeDasharray="2 1.6" />

      {front ? (
        <G>
          <SvgText x={100} y={100} fontSize={8.4} fontFamily={SANS_BOLD} fill={ink} textAnchor="middle" letterSpacing={-0.3}>
            everyone who was there
          </SvgText>
          <Line x1={44} y1={ground} x2={156} y2={ground} stroke={ink} strokeOpacity={0.35} strokeWidth={0.6} />
          {people.map((p, i) => {
            const w = slots[i];
            const x = xs[i];
            const h = H + (i % 2 ? -4 : 2);
            const y = ground - h - 3;
            const cid = `${ids.clip}${i}`;
            const tilt = i % 2 ? 2.5 : -2;
            return (
              <G key={p.id} transform={`rotate(${tilt} ${x + w / 2} ${ground})`}>
                <Defs>
                  <ClipPath id={cid}>
                    <Rect x={x} y={y} width={w} height={h} rx={w * 0.18} />
                  </ClipPath>
                </Defs>
                <Rect x={x - 2} y={y - 2} width={w + 4} height={h + 4} rx={w * 0.2} fill={colors.bg} />
                {p.uri ? (
                  <SvgImage
                    href={{ uri: p.uri }}
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    preserveAspectRatio={p.aspect < 0.7 ? 'xMidYMax meet' : 'xMidYMid slice'}
                    clipPath={`url(#${cid})`}
                  />
                ) : (
                  <Rect x={x} y={y} width={w} height={h} rx={w * 0.18} fill={colors.skyHaze} />
                )}
                {/* cardboard foot */}
                <Path d={`M${x + w / 2 - 6} ${ground} L${x + w / 2 + 6} ${ground} L${x + w / 2 + 4} ${ground - 3} L${x + w / 2 - 4} ${ground - 3} Z`} fill="#C9A878" />
                <Pill x={x + w / 2} y={ground + 10} label={p.name} size={4.6} rotate={i % 2 ? 4 : -5} />
              </G>
            );
          })}
          <SvgText x={100} y={212} fontSize={3.8} fontFamily={MONO} fill={ink} fillOpacity={0.75} textAnchor="middle" letterSpacing={0.5}>
            {`${art.eventTitle} · ${art.dateStamp}`}
          </SvgText>
        </G>
      ) : (
        <G>
          <G opacity={0.22}>
            <RouteGlyph art={art} box={{ x: 44, y: 92, w: 112, h: 104 }} color={ink} accent={accent} stroke={1.4} dot={1.8} />
          </G>
          <SvgText x={100} y={160} fontSize={art.venueName.length > 6 ? 22 : 46} fontFamily={SANS_BOLD} fill={ink} textAnchor="middle" letterSpacing={-2}>
            {art.venueName}
          </SvgText>
          <SvgText x={100} y={176} fontSize={6.4} fontFamily={SANS} fill={ink} textAnchor="middle">
            {art.address}
          </SvgText>
          <SvgText x={100} y={186} fontSize={4} fontFamily={MONO} fill={accent} textAnchor="middle" letterSpacing={0.3}>
            {art.coords}
          </SvgText>
          {edition === 'was_there' ? <EditionPatch x={100} y={210} serial={serial} /> : null}
        </G>
      )}

      <FabricShade id={ids.shade} d={BAG} strength={0.8} />
      <Path d={BAG} fill="none" stroke={colors.ink} strokeOpacity={0.1} strokeWidth={0.8} />
    </Svg>
  );
}
