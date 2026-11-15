// Route-map tee. Front: a small left-chest mark (route glyph, venue, date). Back: the whole
// day as a map print — pull quote on top, the route through every stop, the stop list with
// times, and a mono venue line at the hem.

import Svg, { G, Path, Text as SvgText } from 'react-native-svg';

import { colors } from '@/theme';

import { EditionPatch, FabricShade, Folds, Lines, MONO, RouteGlyph, SANS, SANS_BOLD, useSvgIds, wrap, type DesignProps } from './shared';

export const TEE_BOX = { w: 200, h: 210 };

const BODY =
  'M74 18 Q100 30 126 18 L158 28 Q170 32 176 42 L196 76 L170 92 L156 78 L156 196 Q156 202 150 202 L50 202 Q44 202 44 196 L44 78 L30 92 L4 76 L24 42 Q30 32 42 28 Z';
const FOLDS = ['M62 120 Q70 150 64 190', 'M140 110 Q132 140 138 186', 'M90 196 Q100 186 112 197', 'M46 80 Q50 60 44 34', 'M154 80 Q150 60 156 34'];

export function Tee({ art, side, edition, serial, width }: DesignProps & { width: number }) {
  const ids = useSvgIds('shade');
  const cloth = art.ink.light;
  const ink = art.ink.dark;
  const accent = art.ink.accent;
  const front = side === 'front';

  return (
    <Svg width={width} height={(width * TEE_BOX.h) / TEE_BOX.w} viewBox={`0 0 ${TEE_BOX.w} ${TEE_BOX.h}`}>
      <Path d={BODY} fill={cloth} />
      <Folds paths={FOLDS} />
      {/* collar rib */}
      <Path
        d={front ? 'M74 18 Q100 38 126 18' : 'M76 18 Q100 25 124 18'}
        stroke={ink}
        strokeOpacity={0.14}
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
      />
      {/* sleeve hems */}
      <Path d="M8 70 L32 86 M192 70 L168 86" stroke="#000" strokeOpacity={0.08} strokeWidth={1} />

      {front ? (
        <G>
          <RouteGlyph art={art} box={{ x: 112, y: 52, w: 26, h: 20 }} color={ink} accent={accent} stroke={0.9} dot={0.9} />
          <SvgText x={112} y={81} fontSize={6.4} fontFamily={SANS_BOLD} fill={ink} letterSpacing={-0.2}>
            {art.venueName}
          </SvgText>
          <SvgText x={112} y={87.5} fontSize={3.4} fontFamily={MONO} fill={ink} fillOpacity={0.75}>
            {art.dateStamp}
          </SvgText>
        </G>
      ) : (
        <G>
          <Lines lines={wrap(`“${art.quote}”`, 34, 2)} x={100} y={44} size={5} lh={6.6} fill={ink} family={SANS} />
          <RouteGlyph art={art} box={{ x: 58, y: 60, w: 84, h: 70 }} color={ink} accent={accent} stroke={1.5} dot={1.8} numbers />
          <SvgText x={100} y={144} fontSize={9.5} fontFamily={SANS_BOLD} fill={ink} textAnchor="middle" letterSpacing={-0.4}>
            {art.eventTitle}
          </SvgText>
          {art.stops.slice(0, 6).map((s, i) => {
            // One column: number + time right-aligned, place left-aligned, so nothing collides.
            const y = 154 + i * 5.6;
            return (
              <G key={s.id}>
                <SvgText x={86} y={y} fontSize={3.6} fontFamily={MONO} fill={ink} fillOpacity={0.7} textAnchor="end">
                  {`${String(i + 1).padStart(2, '0')}  ${s.time}`}
                </SvgText>
                <SvgText x={90} y={y} fontSize={4} fontFamily={SANS} fill={ink}>
                  {s.name.length > 18 ? `${s.name.slice(0, 17)}…` : s.name}
                </SvgText>
              </G>
            );
          })}
          <SvgText x={100} y={190} fontSize={3.6} fontFamily={MONO} fill={ink} fillOpacity={0.75} textAnchor="middle" letterSpacing={0.4}>
            {`${art.address} · ${art.dateStamp}`}
          </SvgText>
        </G>
      )}

      {edition === 'was_there' && !front ? <EditionPatch x={140} y={196} serial={serial} /> : null}
      <FabricShade id={ids.shade} d={BODY} />
      <Path d={BODY} fill="none" stroke={colors.ink} strokeOpacity={0.08} strokeWidth={0.8} />
    </Svg>
  );
}
