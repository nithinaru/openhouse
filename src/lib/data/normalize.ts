// Pure helpers that turn Convex answers into the client shapes in src/lib/types.ts.
// trips:get already returns the Trip shape; this only guards against missing arrays and
// header-only rows (trips:list), so screens can trust `trip.moments` etc.

import type { Moment, Photo, Trip } from '../types';

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null;
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const idOf = (r: Raw): string | undefined =>
  typeof r.id === 'string' ? r.id : typeof r._id === 'string' ? r._id : undefined;

function normalizePhoto(raw: unknown, momentId: string): Photo | undefined {
  if (!isObj(raw)) return undefined;
  const id = idOf(raw);
  if (!id) return undefined;
  return {
    ...(raw as Partial<Photo>),
    id,
    momentId: typeof raw.momentId === 'string' ? raw.momentId : momentId,
    userId: String(raw.userId ?? ''),
    takenAt: Number(raw.takenAt ?? 0),
    subtypes: arr<string>(raw.subtypes),
    isFavorite: Boolean(raw.isFavorite),
    uri: typeof raw.uri === 'string' ? raw.uri : '',
    w: Number(raw.w ?? 0),
    h: Number(raw.h ?? 0),
  };
}

function normalizeMoment(raw: unknown, tripId: string, index: number): Moment | undefined {
  if (!isObj(raw)) return undefined;
  const id = idOf(raw);
  if (!id) return undefined;
  const photos = arr<unknown>(raw.photos)
    .map((p) => normalizePhoto(p, id))
    .filter((p): p is Photo => p !== undefined && p.uri !== '');
  return {
    ...(raw as Partial<Moment>),
    id,
    tripId,
    userId: String(raw.userId ?? ''),
    startAt: Number(raw.startAt ?? 0),
    endAt: Number(raw.endAt ?? raw.startAt ?? 0),
    lat: Number(raw.lat ?? 0),
    lng: Number(raw.lng ?? 0),
    order: typeof raw.order === 'number' ? raw.order : index,
    photos,
  };
}

export function normalizeTrip(raw: unknown): Trip | undefined {
  if (!isObj(raw)) return undefined;
  const id = idOf(raw);
  if (!id) return undefined;
  const moments = arr<unknown>(raw.moments)
    .map((m, i) => normalizeMoment(m, id, i))
    .filter((m): m is Moment => m !== undefined)
    .sort((a, b) => a.order - b.order);
  const status = raw.status === 'ingesting' || raw.status === 'enriching' ? raw.status : 'ready';
  return {
    ...(raw as Partial<Trip>),
    id,
    userId: String(raw.userId ?? ''),
    title: typeof raw.title === 'string' && raw.title ? raw.title : 'Your day',
    startAt: Number(raw.startAt ?? 0),
    endAt: Number(raw.endAt ?? raw.startAt ?? 0),
    palette: arr<string>(raw.palette),
    status,
    moments,
    people: arr(raw.people),
    pairings: arr(raw.pairings),
  };
}

/** Enrichment fields the backend may add to a stop after upload. */
const ENRICHED: (keyof Moment)[] = [
  'placeName',
  'isGoldenHour',
  'weather',
  'fact',
  'caption',
  'sceneTags',
  'narration',
  'narrationUri',
  'ambientUri',
  'worldViewerUrl',
  'worldSplatUrl',
];

/**
 * Keeps the local (just-ingested, full-photo) trip and folds in whatever the backend has added
 * since upload: per-stop captions, narration, weather, splats, plus people and pairings.
 * Stops are matched by `order`, which upload preserves.
 */
export function mergeEnrichment(local: Trip, live: Trip): Trip {
  const byOrder = new Map(live.moments.map((m) => [m.order, m]));
  const moments = local.moments.map((m) => {
    const remote = byOrder.get(m.order);
    if (!remote) return m;
    const patch: Partial<Moment> = {};
    for (const k of ENRICHED) {
      if (remote[k] !== undefined && remote[k] !== null) (patch as Record<string, unknown>)[k] = remote[k];
    }
    return Object.keys(patch).length ? { ...m, ...patch } : m;
  });
  return {
    ...local,
    title: live.title || local.title,
    palette: live.palette.length ? live.palette : local.palette,
    story: live.story ?? local.story,
    people: live.people.length ? live.people : local.people,
    pairings: live.pairings.length ? live.pairings : local.pairings,
    moments,
  };
}

/** Cheap structural equality so polling doesn't re-render (and restart Replay) on identical data. */
export function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
