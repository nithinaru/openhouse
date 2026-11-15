// "i was there" hoodie. Front: the headline, venue, coordinates and the date stamp above the
// pouch. Back: big type and the route. Public edition reads the event name instead: only
// people verified at the venue get to wear "i was there".

import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { colors } from '@/theme';

import { EditionPatch, FabricShade, Folds, MONO, RouteGlyph, SANS, SANS_BOLD, useSvgIds, type DesignProps } from './shared';

export const HOODIE_BOX = { w: 200, h: 220 };

const BODY =
  'M62 34 L40 42 Q26 48 22 64 L10 168 Q9 176 18 178 L34 180 Q40 180 41 172 L50 98 L50 196 Q50 204 58 204 L142 204 Q150 204 150 196 L150 98 L159 172 Q160 180 166 180 L182 178 Q191 176 190 168 L178 64 Q174 48 160 42 L138 34 Z';
const HOOD_FRONT = 'M62 36 Q62 8 100 6 Q138 8 138 36 Q120 50 100 50 Q80 50 62 36 Z';
const HOOD_OPENING = 'M74 36 Q76 18 100 17 Q124 18 126 36 Q114 46 100 46 Q86 46 74 36 Z';
const HOOD_BACK = 'M64 34 Q66 8 100 6 Q134 8 136 34 Q122 64 100 66 Q78 64 64 34 Z';
const POCKET = 'M66 150 L134 150 L144 188 L56 188 Z';
const FOLDS = ['M58 110 Q66 140 60 180', 'M142 110 Q134 140 140 182', 'M26 120 Q30 140 24 160', 'M174 120 Q170 140 176 160', 'M88 196 Q100 190 114 197'];

export function Hoodie({ art, side, edition, serial, width }: DesignProps & { width: number }) {
  const ids = useSvgIds('shade', 'hood');
  const cloth = art.ink.dark;
  const ink = art.ink.light;
  const accent = art.ink.accent;
  const front = side === 'front';
  const wasThere = edition === 'was_there';
  const headline = wasThere ? 'i was there' : art.eventTitle;
  const headSize = headline.length > 14 ? 11 : 15;

  return (
    <Svg width={width} height={(width * HOODIE_BOX.h) / HOODIE_BOX.w} viewBox={`0 0 ${HOODIE_BOX.w} ${HOODIE_BOX.h}`}>
      {front ? <Path d={HOOD_FRONT} fill={cloth} /> : null}
      <Path d={BODY} fill={cloth} />
      <Folds paths={FOLDS} dark />
      {/* cuffs and waistband rib */}
      <Rect x={50} y={194} width={100} height={10} rx={3} fill="#000" fillOpacity={0.14} />
      <Path d="M11 168 L41 172 M159 172 L189 168" stroke="#000" strokeOpacity={0.2} strokeWidth={4} />

      {front ? (
        <G>
          <Path d={HOOD_OPENING} fill="#000" fillOpacity={0.32} />
          <Path d={HOOD_FRONT} fill="none" stroke="#000" strokeOpacity={0.18} strokeWidth={1} />
          {/* drawstrings */}
          <Path d="M90 46 Q88 62 89 78 M110 46 Q112 62 111 78" stroke={ink} strokeOpacity={0.85} strokeWidth={1.6} strokeLinecap="round" fill="none" />
          <Rect x={87.6} y={77} width={3} height={5} rx={1} fill={accent} />
          <Rect x={109.6} y={77} width={3} height={5} rx={1} fill={accent} />
          <Path d={POCKET} fill="#000" fillOpacity={0.12} stroke="#000" strokeOpacity={0.22} strokeWidth={0.8} />

          <SvgText x={100} y={106} fontSize={headSize} fontFamily={SANS_BOLD} fill={ink} textAnchor="middle" letterSpacing={-headSize * 0.05}>
            {headline}
          </SvgText>
          <SvgText x={100} y={118} fontSize={6} fontFamily={SANS} fill={ink} textAnchor="middle" letterSpacing={-0.1}>
            {`${art.venueName} · ${art.address}`}
          </SvgText>
          <SvgText x={100} y={128} fontSize={4.2} fontFamily={MONO} fill={accent} textAnchor="middle" letterSpacing={0.3}>
            {art.coords}
          </SvgText>
          <SvgText x={100} y={136} fontSize={4.2} fontFamily={MONO} fill={ink} fillOpacity={0.7} textAnchor="middle" letterSpacing={0.6}>
            {art.dateStamp}
          </SvgText>
        </G>
      ) : (
        <G>
          <Path d={HOOD_BACK} fill={cloth} />
          <FabricShade id={ids.hood} d={HOOD_BACK} strength={1.4} />
          <Path d="M72 38 Q100 58 128 38" stroke="#000" strokeOpacity={0.22} strokeWidth={1} fill="none" />
          <SvgText x={100} y={88} fontSize={wasThere ? 19 : 13} fontFamily={SANS_BOLD} fill={ink} textAnchor="middle" letterSpacing={-0.9}>
            {wasThere ? 'i was there.' : art.eventTitle}
          </SvgText>
          <RouteGlyph art={art} box={{ x: 70, y: 96, w: 60, h: 48 }} color={ink} accent={accent} stroke={1.2} dot={1.5} />
          <SvgText x={100} y={158} fontSize={5.4} fontFamily={SANS_BOLD} fill={ink} textAnchor="middle">
            {`${art.venueName} · ${art.address}${art.city ? ` · ${art.city}` : ''}`}
          </SvgText>
          <SvgText x={100} y={167} fontSize={4} fontFamily={MONO} fill={accent} textAnchor="middle" letterSpacing={0.3}>
            {art.coords}
          </SvgText>
          <SvgText x={100} y={175} fontSize={4} fontFamily={MONO} fill={ink} fillOpacity={0.7} textAnchor="middle" letterSpacing={0.3}>
            {`${art.dateLong} · ${art.hours}`}
          </SvgText>
        </G>
      )}

      {wasThere ? <EditionPatch x={front ? 128 : 100} y={front ? 199 : 186} serial={front ? undefined : serial} /> : null}
      <FabricShade id={ids.shade} d={BODY} strength={1.3} />
      <Path d={BODY} fill="none" stroke={colors.ink} strokeOpacity={0.2} strokeWidth={0.8} />
    </Svg>
  );
}
