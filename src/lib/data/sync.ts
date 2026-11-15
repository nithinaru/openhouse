// Best-effort upload of a freshly ingested trip to Convex. Never throws, never blocks the UI:
// call it fire-and-forget after ingest. If the backend is down or a function isn't deployed,
// it stops quietly and the app keeps using the local trip.
//
// Steps: users:ensure -> trips:create -> moments:upsertMany -> per thumbnail
// files:generateUploadUrl + POST bytes -> photos:addMany -> splats:buildForMoment per stop and
// memories:indexTrip (both fire-and-forget; not deployed yet, so they no-op for now).

import { File } from 'expo-file-system';

import type { Moment, Photo, Trip } from '../types';
import { backendStatus, tryCall } from './convexHttp';
import { ensureRemoteUser } from './identity';
import { FN } from './paths';

export type UploadStage = 'user' | 'trip' | 'moments' | 'photos' | 'pipeline' | 'done' | 'skipped' | 'failed';
export type UploadProgress = { stage: UploadStage; done: number; total: number; remoteTripId?: string; reason?: string };

// local trip id -> Convex trip id, for this app session (the ingest store is per-session too).
const remoteIds = new Map<string, string>();
const inFlight = new Map<string, Promise<string | undefined>>();
const listeners = new Set<() => void>();

export function getRemoteTripId(localId: string): string | undefined {
  return remoteIds.get(localId);
}

/** Local trip ids that have a Convex copy, keyed by remote id. */
export function localIdForRemote(remoteId: string): string | undefined {
  for (const [local, remote] of remoteIds) if (remote === remoteId) return local;
  return undefined;
}

export function onRemoteIdsChange(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const UPLOAD_CONCURRENCY = 3;
const UPLOAD_TIMEOUT_MS = 20_000;

/** Only local files can be uploaded; ph:// asset uris (no thumbnail made) are skipped. */
const isUploadable = (uri: string) => uri.startsWith('file://');

async function uploadThumb(uri: string): Promise<string | undefined> {
  const urlRes = await tryCall<string>('filesGenerateUploadUrl');
  if (!urlRes.ok || typeof urlRes.value !== 'string') return undefined;
  const uploadUrl = urlRes.value;

  // Preferred path: native upload straight from the file (no JS blob in memory).
  try {
    const res = await new File(uri).upload(uploadUrl, {
      httpMethod: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      mimeType: 'image/jpeg',
      sessionType: 'foreground',
    });
    if (res.status >= 200 && res.status < 300) {
      const { storageId } = JSON.parse(res.body) as { storageId?: string };
      if (storageId) return storageId;
    }
  } catch {
    // fall through to fetch
  }

  // Fallback: fetch the local uri as a blob and POST it (Convex docs' upload flow).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const blob = await (await fetch(uri)).blob();
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'image/jpeg' },
      body: blob,
      signal: controller.signal,
    });
    if (!res.ok) return undefined;
    const { storageId } = (await res.json()) as { storageId?: string };
    return storageId;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

/** NaN/Infinity would serialize as null and fail Convex validation; send undefined instead. */
const num = (n: number | undefined) => (n !== undefined && Number.isFinite(n) ? n : undefined);

// Argument builders: exactly the validator fields in convex/moments.ts and convex/photos.ts.
function momentInput(m: Moment) {
  return {
    startAt: m.startAt,
    endAt: m.endAt,
    lat: m.lat,
    lng: m.lng,
    placeName: m.placeName,
    headingDeg: num(m.headingDeg),
    altitudeM: num(m.altitudeM),
    avgIso: num(m.avgIso),
    isGoldenHour: m.isGoldenHour,
    weather: m.weather,
    order: m.order,
  };
}

function photoInput(p: Photo, momentId: string, thumbStorageId: string) {
  return {
    momentId,
    takenAt: p.takenAt,
    lat: num(p.lat),
    lng: num(p.lng),
    headingDeg: num(p.headingDeg),
    altitudeM: num(p.altitudeM),
    lens: p.lens,
    subtypes: p.subtypes,
    isFavorite: p.isFavorite,
    thumbStorageId,
    w: Math.round(p.w),
    h: Math.round(p.h),
  };
}

async function run(trip: Trip, onProgress: (p: UploadProgress) => void): Promise<string | undefined> {
  const report = (p: UploadProgress) => {
    try {
      onProgress(p);
    } catch {
      // progress UI must not break upload
    }
  };

  report({ stage: 'user', done: 0, total: 1 });
  const me = await ensureRemoteUser();
  if (!me.userId) {
    report({ stage: 'skipped', done: 0, total: 0, reason: 'backend offline' });
    return undefined;
  }

  report({ stage: 'trip', done: 0, total: 1 });
  const created = await tryCall<string>('tripsCreate', {
    userId: me.userId,
    title: trip.title,
    startAt: trip.startAt,
    endAt: trip.endAt,
    palette: trip.palette,
  });
  if (!created.ok) {
    report({ stage: 'failed', done: 0, total: 0, reason: created.error.message });
    return undefined;
  }
  const remoteTripId = created.value;
  remoteIds.set(trip.id, remoteTripId);
  listeners.forEach((l) => l());

  const moments = [...trip.moments]
    .sort((a, b) => a.order - b.order)
    .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
  report({ stage: 'moments', done: 0, total: moments.length, remoteTripId });
  const upserted = await tryCall<string[]>('momentsUpsertMany', { tripId: remoteTripId, moments: moments.map(momentInput) });
  if (!upserted.ok || !Array.isArray(upserted.value) || upserted.value.length !== moments.length) {
    report({ stage: 'failed', done: 0, total: moments.length, remoteTripId, reason: 'moments' });
    return remoteTripId;
  }
  const momentIds = upserted.value;
  report({ stage: 'moments', done: moments.length, total: moments.length, remoteTripId });

  // Photos: only those with a local thumbnail (≤3 per stop, made during ingest); never full-res.
  const jobs = moments.flatMap((m, i) =>
    m.photos.filter((p) => isUploadable(p.uri)).map((p) => ({ photo: p, momentId: momentIds[i] })),
  );
  const ready: ReturnType<typeof photoInput>[] = [];
  let done = 0;
  report({ stage: 'photos', done, total: jobs.length, remoteTripId });
  await pool(jobs, UPLOAD_CONCURRENCY, async ({ photo, momentId }) => {
    const storageId = await uploadThumb(photo.uri);
    if (storageId) ready.push(photoInput(photo, momentId, storageId));
    done += 1;
    report({ stage: 'photos', done, total: jobs.length, remoteTripId });
  });
  if (ready.length) await tryCall('photosAddMany', { photos: ready }, { timeoutMs: 15_000 });

  // Server pipeline: fire and forget. Long actions keep running server-side after our timeout.
  report({ stage: 'pipeline', done: 0, total: momentIds.length + 1, remoteTripId });
  if (backendStatus.worthTrying(FN.splatsBuildForMoment.path)) {
    for (const momentId of momentIds) void tryCall('splatsBuildForMoment', { momentId }, { timeoutMs: 4000 });
  }
  void tryCall('memoriesIndexTrip', { tripId: remoteTripId }, { timeoutMs: 4000 });

  report({ stage: 'done', done: 1, total: 1, remoteTripId });
  return remoteTripId;
}

/**
 * Uploads `trip` once per session. Resolves with the Convex trip id, or undefined when the
 * backend is unavailable. Never rejects.
 */
export function uploadTrip(trip: Trip, onProgress: (p: UploadProgress) => void = () => {}): Promise<string | undefined> {
  const existing = remoteIds.get(trip.id);
  if (existing) return Promise.resolve(existing);
  const pending = inFlight.get(trip.id);
  if (pending) return pending;
  const p = run(trip, onProgress)
    .catch(() => undefined)
    .finally(() => inFlight.delete(trip.id));
  inFlight.set(trip.id, p);
  return p;
}
