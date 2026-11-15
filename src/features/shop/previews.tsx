// Live previews of each product, drawn from the trip itself: the same photos, narration,
// times, places and route the buyer just watched in Replay.

import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { collagePhotos, timeLabel } from '@/features/home/tripMeta';
import { fitProjector } from '@/features/poster/geo';
import { Poster } from '@/features/poster/Poster';
import type { Moment, Photo, Trip } from '@/lib/types';
import { colors, fonts, radius, shadow, space, type } from '@/theme';
import { PlayIcon } from '@/theme/icons';

export const orderedStops = (trip: Trip): Moment[] => [...trip.moments].sort((a, b) => a.order - b.order);
export const heroOf = (m?: Moment): Photo | undefined => m?.photos.find((p) => p.id === m.heroPhotoId) ?? m?.photos[0];

/** "lunch on 3rd st" style short date: "nov 15" */
export function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase();
}

// ---------------------------------------------------------------------------------------------
// Route mini map

export function RouteMini({
  trip,
  width,
  height,
  highlight,
  color = colors.text,
}: {
  trip: Trip;
  width: number;
  height: number;
  highlight?: string;
  color?: string;
}) {
  const { pts, stops } = useMemo(() => {
    const stops = orderedStops(trip);
    const pad = 6;
    const project = fitProjector(stops, { x: pad, y: pad, w: width - pad * 2, h: height - pad * 2 });
    return { stops, pts: stops.map((s) => ({ id: s.id, ...project(s) })) };
  }, [trip, width, height]);
  if (!stops.length) return null;
  return (
    <Svg width={width} height={height}>
      <Polyline
        points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="3 3"
      />
      {pts.map((p) => (
        <Circle key={p.id} cx={p.x} cy={p.y} r={p.id === highlight ? 4 : 2.5} fill={p.id === highlight ? colors.pinkEdge : color} />
      ))}
    </Svg>
  );
}

// ---------------------------------------------------------------------------------------------
// Framed print

export function PrintPreview({ trip, width, style }: { trip: Trip; width: number; style?: 'minimal' | 'night' | 'field' }) {
  return (
    <View style={[styles.printFrame, shadow.print]}>
      <Poster trip={trip} width={width} variant={style ?? 'minimal'} />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Postcards: stop photo front; narration, time, place and a mini route on the back.

export function PostcardFront({ moment, width }: { moment: Moment; width: number }) {
  const photo = heroOf(moment);
  const h = Math.round(width / 1.5);
  return (
    <View style={[styles.card, { width, height: h }, shadow.print]}>
      {photo ? <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
      <View style={styles.frontTag}>
        <Text style={styles.frontTagText} numberOfLines={1}>
          {(moment.placeName ?? 'a stop').toLowerCase()}
        </Text>
      </View>
    </View>
  );
}

export function PostcardBack({ trip, moment, width }: { trip: Trip; moment: Moment; width: number }) {
  const h = Math.round(width / 1.5);
  const s = width / 300; // scale everything from a 300pt design
  return (
    <View style={[styles.card, styles.back, { width, height: h, padding: 12 * s }, shadow.print]}>
      <View style={{ flex: 1.3, paddingRight: 10 * s, borderRightWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong }}>
        <Text style={[styles.backNarration, { fontSize: 10.5 * s, lineHeight: 14 * s }]} numberOfLines={6}>
          {(moment.narration ?? moment.caption ?? trip.title).toLowerCase()}
        </Text>
      </View>
      <View style={{ flex: 1, paddingLeft: 10 * s, justifyContent: 'space-between' }}>
        <View style={[styles.stampBox, { width: 34 * s, height: 40 * s }]}>
          <Text style={[styles.stampText, { fontSize: 7 * s }]}>oh</Text>
        </View>
        <View>
          <Text style={[styles.backMeta, { fontSize: 9 * s, lineHeight: 12 * s }]} numberOfLines={1}>
            {timeLabel(moment.startAt).toLowerCase()} · {shortDate(moment.startAt)}
          </Text>
          <Text style={[styles.backPlace, { fontSize: 10 * s, lineHeight: 13 * s }]} numberOfLines={2}>
            {(moment.placeName ?? 'a stop').toLowerCase()}
          </Text>
        </View>
        <RouteMini trip={trip} width={Math.round(100 * s)} height={Math.round(44 * s)} highlight={moment.id} color={colors.textMuted} />
      </View>
    </View>
  );
}

/** Front on top, back peeking out behind it, tilted like two cards on a table. */
export function PostcardPreview({ trip, moment, width }: { trip: Trip; moment?: Moment; width: number }) {
  const stop = moment ?? orderedStops(trip)[0];
  if (!stop) return null;
  const cardW = Math.round(width * 0.78);
  const h = Math.round(cardW / 1.5);
  return (
    <View style={{ width, height: h + 34, alignItems: 'center' }}>
      <View style={{ position: 'absolute', top: 0, right: 0, transform: [{ rotate: '5deg' }] }}>
        <PostcardBack trip={trip} moment={stop} width={cardW} />
      </View>
      <View style={{ position: 'absolute', bottom: 0, left: 0, transform: [{ rotate: '-4deg' }] }}>
        <PostcardFront moment={stop} width={cardW} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Zine: a cover and one page per stop.

export function ZinePreview({ trip, width }: { trip: Trip; width: number }) {
  const stops = orderedStops(trip);
  const [cover] = collagePhotos(trip, 1);
  const pageW = Math.round(width * 0.36);
  const pageH = Math.round(pageW * 1.35);
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
      <View style={[styles.page, { width: pageW, height: pageH }, shadow.print]}>
        {cover ? <Image source={{ uri: cover.uri }} style={{ flex: 1, borderRadius: 3 }} contentFit="cover" /> : <View style={{ flex: 1 }} />}
        <Text style={styles.zineTitle} numberOfLines={2}>
          {trip.title.toLowerCase()}
        </Text>
        <Text style={styles.zineMeta}>{shortDate(trip.startAt)} · {stops.length} stops</Text>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {stops.slice(0, 6).map((m) => {
          const p = heroOf(m);
          const w = Math.round((width - pageW - space.sm - 8) / 3);
          return (
            <View key={m.id} style={[styles.miniPage, { width: w, height: Math.round(w * 1.35) }]}>
              {p ? <Image source={{ uri: p.uri }} style={{ height: '55%', borderRadius: 2 }} contentFit="cover" /> : null}
              <Text style={styles.miniPlace} numberOfLines={2}>
                {(m.placeName ?? 'stop').toLowerCase()}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Narrated film: a letterboxed frame with the first line of narration as a subtitle.

export function FilmPreview({ trip, width }: { trip: Trip; width: number }) {
  const stops = orderedStops(trip);
  const [cover] = collagePhotos(trip, 1);
  const h = Math.round((width * 9) / 16);
  const line = stops.find((m) => m.narration)?.narration ?? trip.title;
  const seconds = Math.max(30, stops.length * 14);
  return (
    <View style={[styles.film, { width, height: h }]}>
      {cover ? <Image source={{ uri: cover.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <View style={[styles.letterbox, { top: 0 }]} />
      <View style={[styles.letterbox, { bottom: 0 }]} />
      <View style={styles.play}>
        <PlayIcon size={16} color={colors.text} />
      </View>
      <Text style={styles.subtitle} numberOfLines={2}>
        {line.toLowerCase()}
      </Text>
      <Text style={styles.runtime}>
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  printFrame: { padding: 6, backgroundColor: colors.bg, borderRadius: 2 },
  card: { borderRadius: 6, overflow: 'hidden', backgroundColor: colors.elevated },
  back: { backgroundColor: colors.bg, flexDirection: 'row' },
  frontTag: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.pink,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.pinkEdge,
    transform: [{ rotate: '-3deg' }],
  },
  frontTagText: { fontFamily: fonts.bold, fontSize: 11, color: colors.text },
  backNarration: { fontFamily: fonts.medium, color: colors.text },
  stampBox: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.pinkEdge,
    backgroundColor: colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampText: { fontFamily: fonts.bold, color: colors.text },
  backMeta: { fontFamily: fonts.semibold, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  backPlace: { fontFamily: fonts.bold, color: colors.text },
  page: { backgroundColor: colors.bg, padding: 6, gap: 4, borderRadius: 4 },
  zineTitle: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 13, color: colors.text, letterSpacing: -0.3 },
  zineMeta: { ...type.caption, fontSize: 9, lineHeight: 11 },
  miniPage: { backgroundColor: colors.bg, padding: 3, gap: 2, borderRadius: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  miniPlace: { fontFamily: fonts.semibold, fontSize: 7, lineHeight: 8, color: colors.text },
  film: { borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.ink, justifyContent: 'center', alignItems: 'center' },
  letterbox: { position: 'absolute', left: 0, right: 0, height: '11%', backgroundColor: colors.ink },
  play: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  subtitle: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: '14%',
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 15,
    color: colors.onMedia,
    textShadowColor: colors.shade,
    textShadowRadius: 6,
  },
  runtime: {
    position: 'absolute',
    right: 8,
    top: '13%',
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.onMedia,
    fontVariant: ['tabular-nums'],
  },
});
