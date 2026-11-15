// Dad cap. Front: a small embroidered mark (route + venue + date) in satin-stitch style.
// Back: the strap opening with the address stitched above it.

import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { colors } from '@/theme';

import { FabricShade, MONO, RouteGlyph, SANS_BOLD, useSvgIds, type DesignProps } from './shared';

export const CAP_BOX = { w: 200, h: 160 };

const CROWN = 'M30 112 Q28 44 100 38 Q172 44 170 112 Z';
const BRIM = 'M22 110 Q100 96 178 110 Q192 114 186 124 Q100 152 14 124 Q8 114 22 110 Z';

export function Cap({ art, side, width }: DesignProps & { width: number }) {
  const ids = useSvgIds('shade', 'brim');
  const twill = art.ink.mid;
  const thread = art.ink.light;
  const accent = art.ink.accent;
  const front = side === 'front';

  return (
    <Svg width={width} height={(width * CAP_BOX.h) / CAP_BOX.w} viewBox={`0 0 ${CAP_BOX.w} ${CAP_BOX.h}`}>
      <Path d={CROWN} fill={twill} />
      {/* panel seams */}
      <Path d="M100 40 Q70 60 62 112 M100 40 Q130 60 138 112" stroke="#000" strokeOpacity={0.22} strokeWidth={0.9} fill="none" />
      <Path d="M100 40 Q70 60 62 112 M100 40 Q130 60 138 112" stroke="#FFF" strokeOpacity={0.08} strokeWidth={0.6} fill="none" strokeDasharray="1.2 1.2" transform="translate(1.4 0)" />
      {/* eyelets */}
      <Circle cx={74} cy={62} r={1.6} fill="#000" fillOpacity={0.3} />
      <Circle cx={126} cy={62} r={1.6} fill="#000" fillOpacity={0.3} />
      <Circle cx={100} cy={39} r={3.4} fill={twill} stroke="#000" strokeOpacity={0.25} strokeWidth={0.8} />

      {front ? (
        <G>
          {/* embroidery: a thick under-stroke for raised thread, then the stitch on top */}
          <G opacity={0.35}>
            <RouteGlyph art={art} box={{ x: 86, y: 58, w: 28, h: 22 }} color="#000" accent="#000" stroke={2.6} dot={1.6} />
          </G>
          <RouteGlyph art={art} box={{ x: 85.6, y: 57.4, w: 28, h: 22 }} color={thread} accent={accent} stroke={1.8} dot={1.4} dash="1.2 0.5" />
          <SvgText x={100} y={94} fontSize={9} fontFamily={SANS_BOLD} fill="#000" fillOpacity={0.35} textAnchor="middle" letterSpacing={-0.3}>
            {art.venueName}
          </SvgText>
          <SvgText x={99.6} y={93.4} fontSize={9} fontFamily={SANS_BOLD} fill={thread} textAnchor="middle" letterSpacing={-0.3}>
            {art.venueName}
          </SvgText>
          <SvgText x={100} y={101} fontSize={3.6} fontFamily={MONO} fill={thread} fillOpacity={0.85} textAnchor="middle" letterSpacing={0.6}>
            {art.dateStamp}
          </SvgText>
        </G>
      ) : (
        <G>
          <SvgText x={100} y={82} fontSize={4.4} fontFamily={MONO} fill={thread} textAnchor="middle" letterSpacing={0.8}>
            {art.address}
          </SvgText>
          {/* strap opening + strap + buckle */}
          <Path d="M76 112 Q78 88 100 86 Q122 88 124 112 Z" fill="#000" fillOpacity={0.45} />
          <Rect x={80} y={100} width={40} height={6} rx={1.5} fill={twill} stroke="#000" strokeOpacity={0.25} strokeWidth={0.6} />
          <Rect x={104} y={98.5} width={8} height={9} rx={1} fill="none" stroke={accent} strokeWidth={1.4} />
        </G>
      )}

      <FabricShade id={ids.shade} d={CROWN} strength={1.5} />
      {front ? (
        <G>
          <Path d={BRIM} fill={twill} />
          <Path d="M20 116 Q100 102 180 116" stroke="#000" strokeOpacity={0.2} strokeWidth={0.8} fill="none" strokeDasharray="1.4 1.2" />
          <Path d="M24 121 Q100 108 176 121" stroke="#000" strokeOpacity={0.15} strokeWidth={0.8} fill="none" strokeDasharray="1.4 1.2" />
          <FabricShade id={ids.brim} d={BRIM} strength={1.6} />
        </G>
      ) : (
        <Path d="M32 112 Q100 120 168 112" stroke="#000" strokeOpacity={0.25} strokeWidth={2} fill="none" />
      )}
      <Path d={CROWN} fill="none" stroke={colors.ink} strokeOpacity={0.2} strokeWidth={0.8} />
    </Svg>
  );
}
