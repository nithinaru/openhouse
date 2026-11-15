// Clustering + hero pick (docs/BUILD.md §5.2). Pure TS, unit-tested with node:test.
// Self-contained on purpose: Node runs it directly (type stripping), and the project tsconfig
// does not allow value imports ending in .ts, so only the type-only import below crosses files.

import type { Moment, Photo, Trip } from '../types.ts';

// ---- geo ----

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance in meters. */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Circular mean of compass headings in degrees, normalized to [0, 360).
 * Returns undefined when empty or when headings cancel out (no clear direction).
 */
export function circularMeanDeg(degrees: number[]): number | undefined {
  if (degrees.length === 0) return undefined;
  let sin = 0;
  let cos = 0;
  for (const d of degrees) {
    sin += Math.sin(toRad(d));
    cos += Math.cos(toRad(d));
  }
  sin /= degrees.length;
  cos /= degrees.length;
  if (Math.hypot(sin, cos) < 1e-6) return undefined;
  const mean = toDeg(Math.atan2(sin, cos));
  return ((mean % 360) + 360) % 360;
}

// ---- clustering ----

export const GAP_MS = 90 * 60_000;
export const MAX_JUMP_M = 1_000;
/** Shots this close together count as one burst for hero picking. */
export const BURST_MS = 10_000;

/** Photo plus ingest-only fields that feed moment aggregates but are not stored on Photo. */
export type ClusterPhoto = Photo & { iso?: number };

function hasLoc(p: Photo): p is Photo & LatLng {
  return typeof p.lat === 'number' && typeof p.lng === 'number';
}

/** favorite > panorama > first photo of the largest burst (size >= 2) > first photo. */
export function pickHero(photos: Photo[]): Photo | undefined {
  if (photos.length === 0) return undefined;
  const fav = photos.find((p) => p.isFavorite);
  if (fav) return fav;
  const pano = photos.find((p) => p.subtypes.includes('panorama'));
  if (pano) return pano;

  const sorted = [...photos].sort((a, b) => a.takenAt - b.takenAt);
  let best: Photo[] = [];
  let run: Photo[] = [];
  for (const p of sorted) {
    if (run.length && p.takenAt - run[run.length - 1].takenAt > BURST_MS) run = [];
    run.push(p);
    if (run.length > best.length) best = [...run];
  }
  if (best.length >= 2) return best[0];
  return sorted[0];
}

/**
 * Splits photos into moments. A new moment starts when the time gap to the previous
 * photo exceeds 90 min, or the photo is more than 1 km from the previous geotagged photo
 * in the current moment. Photos without location join the current moment; a moment with
 * no geotagged photo at all is dropped (it has no place to put on the map).
 *
 * Moment ids are provisional (`m0`, `m1`, ...) with an empty tripId; buildTrip restamps them.
 */
export function clusterPhotos(photos: ClusterPhoto[], opts: { userId?: string } = {}): Moment[] {
  const userId = opts.userId ?? 'me';
  const sorted = [...photos].sort((a, b) => a.takenAt - b.takenAt);

  const groups: ClusterPhoto[][] = [];
  let current: ClusterPhoto[] = [];
  let lastLoc: LatLng | undefined;
  for (const p of sorted) {
    const prev = current[current.length - 1];
    const timeBreak = prev !== undefined && p.takenAt - prev.takenAt > GAP_MS;
    const distBreak = hasLoc(p) && lastLoc !== undefined && haversineM(lastLoc, p) > MAX_JUMP_M;
    if (current.length && (timeBreak || distBreak)) {
      groups.push(current);
      current = [];
      lastLoc = undefined;
    }
    current.push(p);
    if (hasLoc(p)) lastLoc = { lat: p.lat, lng: p.lng };
  }
  if (current.length) groups.push(current);

  const moments: Moment[] = [];
  for (const group of groups) {
    const located = group.filter(hasLoc);
    if (located.length === 0) continue;
    const order = moments.length;
    const id = `m${order}`;
    const cleanPhotos: Photo[] = group.map(({ iso: _iso, ...rest }) => ({ ...rest, momentId: id }));
    const isos = group.map((p) => p.iso).filter((v): v is number => typeof v === 'number');
    const headings = group.map((p) => p.headingDeg).filter((v): v is number => typeof v === 'number');
    const alts = group.map((p) => p.altitudeM).filter((v): v is number => typeof v === 'number');
    const hero = pickHero(cleanPhotos);

    moments.push({
      id,
      tripId: '',
      userId,
      startAt: group[0].takenAt,
      endAt: group[group.length - 1].takenAt,
      lat: median(located.map((p) => p.lat))!,
      lng: median(located.map((p) => p.lng))!,
      headingDeg: circularMeanDeg(headings),
      altitudeM: median(alts),
      avgIso: isos.length ? isos.reduce((s, v) => s + v, 0) / isos.length : undefined,
      heroPhotoId: hero?.id,
      order,
      photos: cleanPhotos,
    });
  }
  return moments;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Local calendar day key, e.g. "2026-11-15". */
export function localDayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function localDayTitle(ms: number): string {
  const d = new Date(ms);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export type BuildTripOptions = {
  userId?: string;
  /** Override the day grouping (tests pass a UTC key so they do not depend on the machine TZ). */
  dayKey?: (ms: number) => string;
  /** Override the title for a day's first moment start time. */
  title?: (startAt: number) => string;
};

/** Groups moments by day into trips (oldest first), restamping trip/moment ids and order. */
export function buildTrips(moments: Moment[], opts: BuildTripOptions = {}): Trip[] {
  const dayKey = opts.dayKey ?? localDayKey;
  const title = opts.title ?? localDayTitle;
  const sorted = [...moments].sort((a, b) => a.startAt - b.startAt);

  const byDay = new Map<string, Moment[]>();
  for (const m of sorted) {
    const key = dayKey(m.startAt);
    const list = byDay.get(key);
    if (list) list.push(m);
    else byDay.set(key, [m]);
  }

  const trips: Trip[] = [];
  for (const [key, dayMoments] of byDay) {
    const tripId = `trip-${key}`;
    const userId = opts.userId ?? dayMoments[0].userId;
    const restamped = dayMoments.map((m, order): Moment => {
      const id = `${tripId}-m${order}`;
      const photos = m.photos.map((p) => ({ ...p, momentId: id }));
      return { ...m, id, tripId, userId, order, photos };
    });
    trips.push({
      id: tripId,
      userId,
      title: title(restamped[0].startAt),
      startAt: restamped[0].startAt,
      endAt: restamped[restamped.length - 1].endAt,
      palette: [],
      status: 'ingesting',
      moments: restamped,
      people: [],
      pairings: [],
    });
  }
  return trips;
}

/** The most recent day's trip ("today is one trip" for the demo), or undefined if no moments. */
export function buildTrip(moments: Moment[], opts: BuildTripOptions = {}): Trip | undefined {
  const trips = buildTrips(moments, opts);
  return trips[trips.length - 1];
}
