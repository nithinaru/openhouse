// World Labs worlds for a stop, over the Convex HTTP API (convex/worlds.ts).
//
// Server modes: 'live' (WORLDLABS_API_KEY set, real Marble generation, ~5 min) and 'demo'
// (no key: flips to ready after ~25 s with the sample splat). If the backend can't run the
// build at all (functions not deployed yet, offline, or a local-only stop whose id is not a
// Convex id), this falls back to a LOCAL demo world simulated on the device, also labeled demo.

import { call, tryCall } from '@/lib/data/convexHttp';
import type { Moment } from '@/lib/types';

import { SAMPLE_SPLAT_URL } from '../walkin/WalkInViewer';

export type WorldMode = 'live' | 'demo';
export type WorldStatus = 'pending' | 'ready' | 'failed';

export type World = {
  worldId: string;
  status: WorldStatus;
  splatUrl?: string;
  viewerUrl?: string;
  mode: WorldMode;
  startedAt: number;
  expectedMs: number;
  /** Simulated on this device; the backend was not involved. */
  local?: boolean;
};

export const MAX_WORLD_PHOTOS = 8;
const LOCAL_DEMO_MS = 25_000;

// Convex document ids are ~32 lowercase base32 chars; demo stop ids look like "m1".
export const isConvexId = (id: string) => /^[a-z0-9]{25,40}$/.test(id);

/**
 * Up to 8 public photo URLs for World Labs. Auto layout wants same-size images, so keep the
 * most common w x h. Local file:// photos can't be fetched by World Labs and are dropped.
 */
export function worldPhotoUrls(moment: Moment): string[] {
  const remote = moment.photos.filter((p) => /^https?:\/\//.test(p.uri));
  const counts = new Map<string, number>();
  for (const p of remote) counts.set(`${p.w}x${p.h}`, (counts.get(`${p.w}x${p.h}`) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return remote
    .filter((p) => `${p.w}x${p.h}` === top)
    .map((p) => p.uri)
    .slice(0, MAX_WORLD_PHOTOS);
}

// --- local demo (device-only) -------------------------------------------------------------

const localWorlds = new Map<string, { startedAt: number }>();

function localWorld(momentId: string): World | null {
  const w = localWorlds.get(momentId);
  if (!w) return null;
  const ready = Date.now() - w.startedAt >= LOCAL_DEMO_MS;
  return {
    worldId: `local:${momentId}`,
    status: ready ? 'ready' : 'pending',
    splatUrl: ready ? SAMPLE_SPLAT_URL : undefined,
    mode: 'demo',
    startedAt: w.startedAt,
    expectedMs: LOCAL_DEMO_MS,
    local: true,
  };
}

function startLocal(momentId: string): World {
  if (!localWorlds.has(momentId)) localWorlds.set(momentId, { startedAt: Date.now() });
  return localWorld(momentId)!;
}

// --- public -------------------------------------------------------------------------------

/** Latest world for a stop, or null. Never throws. */
export async function fetchWorld(momentId: string): Promise<World | null> {
  const local = localWorld(momentId);
  if (local || !isConvexId(momentId)) return local;
  const r = await tryCall<World | null>('worldsForMoment', { momentId }, { timeoutMs: 6000 });
  return r.ok ? r.value : null;
}

export type BuildResult = { worldId: string; mode: WorldMode; local: boolean; error?: string };

/**
 * Starts (or reuses) a world for the stop. Falls back to a local demo world when the backend
 * can't take it, so the flow always runs. A live-mode error (bad key, no public photos) is
 * returned as `error` instead of being hidden behind a demo.
 */
export async function buildWorld(moment: Moment): Promise<BuildResult> {
  if (!isConvexId(moment.id)) {
    const w = startLocal(moment.id);
    return { worldId: w.worldId, mode: 'demo', local: true };
  }
  try {
    const r = await call<{ worldId: string; mode: WorldMode }>(
      'worldsBuild',
      { momentId: moment.id, imageUrls: worldPhotoUrls(moment) },
      { timeoutMs: 30_000 },
    );
    return { worldId: r.worldId, mode: r.mode, local: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Server answered with a real error in live mode: surface it.
    if (/world labs|no public photo/i.test(message)) {
      return { worldId: '', mode: 'live', local: false, error: message };
    }
    const w = startLocal(moment.id);
    return { worldId: w.worldId, mode: 'demo', local: true };
  }
}

/** True when the splat came from World Labs (Marble CDN) rather than SHARP or the sample. */
export const isWorldLabsUrl = (url?: string) => !!url && /worldlabs\.ai/i.test(url);
