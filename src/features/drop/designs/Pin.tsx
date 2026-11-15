// Enamel pin. Front: the venue in a round badge — gold rim, hard enamel field, address and
// date set on the ring, a ribbon across the middle. Back: the plated back with the butterfly
// clutch and the edition stamp.

import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Text as SvgText, TextPath } from 'react-native-svg';

import { colors } from '@/theme';

import { MONO, SANS_BOLD, SANS_SEMI, useSvgIds, type DesignProps } from './shared';

export const PIN_BOX = { w: 200, h: 200 };

const GOLD = ['#F7E6A8', '#D9A441', '#8F6A22'];
const RIBBON = 'M38 118 L162 118 L154 128 L162 138 L38 138 L46 128 Z';

export function Pin({ art, side, edition, serial, width }: DesignProps & { width: number }) {
  const ids = useSvgIds('gold', 'top', 'bottom', 'gloss');
  const front = side === 'front';
  const wasThere = edition === 'was_there';
  const field = art.ink.dark;
  const light = art.ink.light;
  const gold = `url(#${ids.gold})`;

  return (
    <Svg width={width} height={width} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id={ids.gold} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={GOLD[0]} />
          <Stop offset="0.5" stopColor={GOLD[1]} />
          <Stop offset="1" stopColor={GOLD[2]} />
        </LinearGradient>
        <LinearGradient id={ids.gloss} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.32} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
        <Path id={ids.top} d="M34 100 A66 66 0 0 1 166 100" />
        <Path id={ids.bottom} d="M26 100 A74 74 0 0 0 174 100" />
      </Defs>

      <Circle cx={100} cy={100} r={86} fill={gold} />
      <Circle cx={100} cy={100} r={86} fill="none" stroke="#000" strokeOpacity={0.18} strokeWidth={1} />

      {front ? (
        <G>
          <Circle cx={100} cy={100} r={80} fill={field} />
          <Circle cx={100} cy={100} r={60} fill="none" stroke={gold} strokeWidth={2.2} />
          <SvgText fontSize={8.6} fontFamily={SANS_SEMI} fill={light} letterSpacing={1.2} textAnchor="middle">
            <TextPath href={`#${ids.top}`} startOffset="50%">
              {`${art.address}${art.city ? ` · ${art.city}` : ''}`}
            </TextPath>
          </SvgText>
          <SvgText fontSize={7} fontFamily={MONO} fill={GOLD[0]} letterSpacing={1.6} textAnchor="middle">
            <TextPath href={`#${ids.bottom}`} startOffset="50%">
              {art.dateStamp}
            </TextPath>
          </SvgText>
          <SvgText x={100} y={108} fontSize={art.venueName.length > 4 ? 18 : 44} fontFamily={SANS_BOLD} fill={light} textAnchor="middle" letterSpacing={-2}>
            {art.venueName}
          </SvgText>
          <Path d={RIBBON} fill={wasThere ? colors.pink : art.ink.accent} stroke={gold} strokeWidth={2} strokeLinejoin="round" />
          <SvgText x={100} y={131.4} fontSize={9} fontFamily={SANS_BOLD} fill={colors.ink} textAnchor="middle" letterSpacing={-0.2}>
            {wasThere ? 'was there' : art.eventTitle.length > 18 ? art.dateStamp : art.eventTitle}
          </SvgText>
          {/* enamel gloss */}
          <Path d="M40 80 A62 62 0 0 1 150 52 Q100 60 40 80 Z" fill={`url(#${ids.gloss})`} />
        </G>
      ) : (
        <G>
          <Circle cx={100} cy={100} r={78} fill="#000" fillOpacity={0.06} />
          {[70, 56, 42].map((r) => (
            <Circle key={r} cx={100} cy={100} r={r} fill="none" stroke="#000" strokeOpacity={0.06} strokeWidth={0.8} />
          ))}
          <SvgText fontSize={7} fontFamily={MONO} fill="#5E4512" letterSpacing={1.4} textAnchor="middle">
            <TextPath href={`#${ids.top}`} startOffset="50%">
              wish you were here · the drop
            </TextPath>
          </SvgText>
          <SvgText fontSize={7} fontFamily={MONO} fill="#5E4512" letterSpacing={1.4} textAnchor="middle">
            <TextPath href={`#${ids.bottom}`} startOffset="50%">
              {wasThere ? `was there · ${serial ?? 'nº — / 180'}` : 'open edition'}
            </TextPath>
          </SvgText>
          {/* butterfly clutch */}
          <Path d="M76 90 Q100 80 124 90 L124 110 Q100 120 76 110 Z" fill={gold} stroke="#000" strokeOpacity={0.25} strokeWidth={0.8} />
          <Path d="M76 90 Q66 100 76 110 M124 90 Q134 100 124 110" stroke={gold} strokeWidth={4} fill="none" strokeLinecap="round" />
          <Circle cx={100} cy={100} r={5} fill={gold} stroke="#000" strokeOpacity={0.3} strokeWidth={0.8} />
        </G>
      )}
    </Svg>
  );
}
