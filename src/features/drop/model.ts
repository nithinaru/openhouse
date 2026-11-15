// The drop: a limited merch collection designed from one day, sold as a Whop drop.
// Everything a design needs is derived here from the trip, so the SVG pieces stay pure:
// venue, coordinates, date stamp, the route through the stops, the trip palette, the
// people as standees, and one narration line as the pull quote.

import { Image } from 'react-native';

import { fitProjector, haversineMiles, type LatLng } from '@/features/poster/geo';
import { isDemoTripId } from '@/lib/data/trips';
import { getHousePerson, VENUE } from '@/lib/demo/demoHouse';
import { DEMO_TRIP_ID } from '@/lib/demo/demoTrip';
import type { Moment, Trip } from '@/lib/types';
import { colors } from '@/theme';
import { formatClock as formatClockSafe } from '@/theme/ui';

// ---------------------------------------------------------------------------------------------
// Pieces live in ./catalog.ts (one file to edit when real product photos land).

export { BUNDLE_CENTS, PIECE_ORDER, PIECES, PIECES_TOTAL_CENTS } from './catalog';
export type { Edition, PieceId, PieceInfo, Side } from './catalog';

/** Organizer revenue share shown on the screen and sent as Whop application_fee_amount. */
export const HOST_SHARE = 0.1;

// ---------------------------------------------------------------------------------------------
// Art: what every design draws from

export type ArtStop = { id: string; name: string; time: string; x: number; y: number };

export type ArtPerson = { id: string; name: string; uri?: string; /** w / h of the image */ aspect: number };

export type DropArt = {
  eventTitle: string; // "yc hackathon day"
  venueName: string; // "yc"
  address: string; // "560 20th st"
  city: string; // "san francisco"
  lat: number;
  lng: number;
  coords: string; // "37.7608° n  122.3876° w"
  dateStamp: string; // "11.15.26"
  dateLong: string; // "nov 15 2026"
  hours: string; // "8:00 am – 8:00 pm"
  /** Stops projected into a unit box (0..1), in order. */
  stops: ArtStop[];
  /** Smooth route path through the stops in unit coordinates; scale with `routeIn`. */
  route: { x: number; y: number }[];
  /** Index of the stop at the venue (gets the star). */
  venueIndex: number;
  people: ArtPerson[];
  quote: string;
  ink: { dark: string; light: string; accent: string; mid: string };
};

export type Venue = { name: string; address: string; city: string; lat: number; lng: number };

const lower = (s: string) => s.toLowerCase();

function shortPlace(name?: string): string {
  if (!name) return 'a stop';
  return lower(name.split(',')[0].replace(/^the /i, 'the ').trim());
}

/** The event venue: YC for the demo trip, otherwise the stop with the most photos (then the longest). */
export function venueFor(trip: Trip): Venue {
  if (isDemoTripId(trip.id) || trip.id === DEMO_TRIP_ID || /yc hackathon/i.test(trip.title)) {
    return { name: VENUE.name, address: '560 20th st', city: 'san francisco', lat: VENUE.lat, lng: VENUE.lng };
  }
  const ranked = [...trip.moments].sort(
    (a, b) => b.photos.length - a.photos.length || b.endAt - b.startAt - (a.endAt - a.startAt),
  );
  const m = ranked[0];
  if (!m) return { name: lower(trip.title), address: lower(trip.title), city: '', lat: 0, lng: 0 };
  const parts = (m.placeName ?? trip.title).split(',').map((s) => s.trim());
  return { name: lower(parts[0]), address: lower(parts[1] ?? parts[0]), city: lower(parts[2] ?? ''), lat: m.lat, lng: m.lng };
}

export function formatCoords(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'n' : 's'}  ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'e' : 'w'}`;
}

function dateStamp(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}.${p(d.getDate())}.${String(d.getFullYear()).slice(2)}`;
}

function dateLong(ms: number): string {
  return lower(new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', ''));
}

/** First sentence of the most vivid narration, lowercased and trimmed for a pull quote. */
function pullQuote(stops: Moment[]): string {
  const lines = stops.map((m) => m.narration).filter((n): n is string => !!n);
  const pick = lines.find((l) => /sol wrote|napkin/i.test(l)) ?? lines[Math.min(2, lines.length - 1)] ?? '';
  if (!pick) return 'a day worth wearing.';
  const sentences = pick.split(/(?<=\.)\s+/);
  const s = sentences.length > 1 ? sentences[sentences.length - 1] : sentences[0];
  let clean = lower(s).replace(/[’]/g, "'");
  // Long sentence: keep its last clause ("…, and sol wrote your idea on a napkin.").
  if (clean.length > 72 && clean.includes(',')) clean = clean.slice(clean.lastIndexOf(',') + 1).trim().replace(/^and /, '');
  return clean.length > 96 ? `${clean.slice(0, 93).trim()}…` : clean;
}

const assetUri = (n: number): string | undefined => Image.resolveAssetSource(n)?.uri;

function peopleFor(trip: Trip): ArtPerson[] {
  return trip.people.slice(0, 5).map((p) => {
    const house = getHousePerson(p.name.toLowerCase());
    if (house) return { id: p.id, name: lower(p.name), uri: assetUri(house.cutout), aspect: house.aspect };
    return { id: p.id, name: lower(p.name), uri: p.avatarUri, aspect: 1 };
  });
}

// Palette: darkest for heavy garments, lightest for natural ones, the most saturated as accent.
function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const luma = (c: [number, number, number]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
function sat(c: [number, number, number]) {
  const max = Math.max(...c);
  const min = Math.min(...c);
  const l = (max + min) / 2;
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
}

function inksFor(palette: string[]): DropArt['ink'] {
  const parsed = palette.map((hex) => ({ hex, c: rgb(hex) })).filter((p): p is { hex: string; c: [number, number, number] } => !!p.c);
  const byLuma = [...parsed].sort((a, b) => luma(a.c) - luma(b.c));
  const darkest = byLuma[0];
  const lightest = byLuma[byLuma.length - 1];
  const dark = darkest && luma(darkest.c) < 0.3 ? darkest.hex : '#1F2A44';
  const light = lightest && luma(lightest.c) > 0.72 ? lightest.hex : '#ECE6DA';
  const rest = parsed.filter((p) => p.hex !== dark && p.hex !== light);
  const accent = [...rest].sort((a, b) => sat(b.c) - sat(a.c))[0]?.hex ?? '#D9A441';
  const mid = rest.filter((p) => p.hex !== accent).sort((a, b) => sat(a.c) - sat(b.c))[0]?.hex ?? '#7A8B99';
  return { dark, light, accent, mid };
}

/** Catmull-Rom through the points, as a dense polyline (keeps every design's route identical). */
function smooth(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length < 3) return points;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let t = 0; t < 1; t += 0.125) {
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

export function artFor(trip: Trip): DropArt {
  const venue = venueFor(trip);
  const ordered = [...trip.moments].sort((a, b) => a.order - b.order);
  const project = fitProjector(ordered, { x: 0.06, y: 0.06, w: 0.88, h: 0.88 });
  const stops: ArtStop[] = ordered.map((m) => {
    const p = project(m);
    return { id: m.id, name: shortPlace(m.placeName), time: formatClockSafe(m.startAt).replace(' ', ''), x: p.x, y: p.y };
  });
  // Drop near-duplicate points so the curve doesn't knot inside one building.
  const routePts = stops.filter((s, i) => i === 0 || Math.hypot(s.x - stops[i - 1].x, s.y - stops[i - 1].y) > 0.015);
  const near = ordered.map((m) => haversineMiles(m, venue));
  const venueIndex = Math.max(0, near.indexOf(Math.min(...near)));
  const start = ordered[0]?.startAt ?? trip.startAt;
  const end = ordered[ordered.length - 1]?.endAt ?? trip.endAt;
  return {
    eventTitle: lower(trip.title),
    venueName: venue.name,
    address: venue.address,
    city: venue.city,
    lat: venue.lat,
    lng: venue.lng,
    coords: formatCoords(venue.lat, venue.lng),
    dateStamp: dateStamp(start),
    dateLong: dateLong(start),
    hours: `${formatClockSafe(start)} – ${formatClockSafe(end)}`,
    stops,
    route: smooth(routePts),
    venueIndex,
    people: peopleFor(trip),
    quote: pullQuote(ordered),
    ink: inksFor(trip.palette.length ? trip.palette : [colors.ink]),
  };
}

// ---------------------------------------------------------------------------------------------
// Presence: "was there" is only for people whose own photos put them at the venue.

export const PRESENCE_RADIUS_M = 300;

export type Presence = { qualifies: boolean; reason: string; at?: number; meters?: number };

export function presenceFor(trip: Trip, venue: Venue = venueFor(trip)): Presence {
  const v: LatLng = venue;
  type Hit = { at: number; m: number; place?: string };
  const hits: Hit[] = [];
  for (const m of trip.moments) {
    const geo = m.photos.filter((p) => p.lat != null && p.lng != null);
    if (geo.length) {
      for (const p of geo) {
        const d = haversineMiles({ lat: p.lat!, lng: p.lng! }, v) * 1609.34;
        if (d <= PRESENCE_RADIUS_M) hits.push({ at: p.takenAt, m: d, place: m.placeName });
      }
    } else {
      const d = haversineMiles(m, v) * 1609.34;
      if (d <= PRESENCE_RADIUS_M) hits.push({ at: m.startAt, m: d, place: m.placeName });
    }
  }
  hits.sort((a, b) => a.at - b.at);
  const first = hits[0];
  const demo = isDemoTripId(trip.id) || trip.id === DEMO_TRIP_ID;
  if (first) {
    return {
      qualifies: true,
      at: first.at,
      meters: Math.round(first.m),
      reason: `verified by your photos at ${venue.address} · ${formatClockSafe(first.at)}`,
    };
  }
  if (demo) {
    const at = trip.moments[0]?.startAt ?? trip.startAt;
    return { qualifies: true, at, reason: `verified by your photos at ${venue.address} · ${formatClockSafe(at)}` };
  }
  return {
    qualifies: false,
    reason: `“was there” is for people at ${venue.address}. none of your photos are within ${PRESENCE_RADIUS_M} m of it`,
  };
}
