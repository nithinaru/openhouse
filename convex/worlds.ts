// World Labs (Marble) world generation for one stop: several photos of a room -> one
// Gaussian-splat world you can walk into.
//
// Live mode (WORLDLABS_API_KEY set in the Convex env):
//   POST https://api.worldlabs.ai/marble/v1/worlds:generate   (header WLT-Api-Key)
//     world_prompt { type: 'multi-image', reconstruct_images: true, multi_image_prompt: [...up to 8 uri images] }
//   -> long-running operation; worlds.poll GETs /marble/v1/operations/{id} every 10 s (up to ~10 min).
//   On done the world carries assets.splats.spz_urls { 100k, 500k, full_res } and world_marble_url.
//   Docs: https://docs.worldlabs.ai/api (generation takes ~5 min).
//
// DEMO MODE (no key): nothing is sent to World Labs. A row is inserted with
// operationId "demo:<ts>" and flips to ready after DEMO_MS with the public sample splat the
// Walk in viewer already uses. Every return value says mode: 'demo' so the UI can label it.
//
// The schema can't change (Capy owns it), so the demo marker lives in operationId.

import { makeFunctionReference } from 'convex/server';
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { action, env, internalAction, internalMutation, internalQuery, query } from './_generated/server';

const API_BASE = 'https://api.worldlabs.ai/marble/v1';
const MAX_IMAGES = 8;
const POLL_EVERY_MS = 10_000;
const POLL_GIVE_UP_MS = 10 * 60_000;
const LIVE_EXPECTED_MS = 5 * 60_000;

// Demo mode: same sample splat as src/features/walkin/WalkInViewer.tsx (SAMPLE_SPLAT_URL).
const DEMO_PREFIX = 'demo:';
const DEMO_MS = 25_000;
const DEMO_SPLAT_URL = 'https://sparkjs.dev/assets/splats/valley.spz';

const isDemo = (operationId: string) => operationId.startsWith(DEMO_PREFIX);

// WORLDLABS_API_KEY is not declared in convex.config.ts (not ours to edit), so read it untyped.
// At runtime `env` is process.env.
function apiKey(): string | undefined {
  const key = (env as unknown as Record<string, string | undefined>).WORLDLABS_API_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

// References to this file's internal functions. Built by name instead of via
// `internal` from ./_generated/api so this file typechecks before the next codegen
// (the generated module list is regenerated on deploy).
const ref = {
  getRow: makeFunctionReference<'query', { worldId: Id<'worlds'> }, Doc<'worlds'> | null>('worlds:getRow'),
  latestForMoment: makeFunctionReference<'query', { momentId: Id<'moments'> }, Doc<'worlds'> | null>('worlds:latestForMoment'),
  momentInputs: makeFunctionReference<'query', { momentId: Id<'moments'> }, { placeName?: string; urls: string[] } | null>(
    'worlds:momentInputs',
  ),
  insertRow: makeFunctionReference<'mutation', { momentId: Id<'moments'>; operationId: string }, Id<'worlds'>>('worlds:insertRow'),
  markReady: makeFunctionReference<'mutation', { worldId: Id<'worlds'>; splatUrl?: string; viewerUrl?: string }, null>(
    'worlds:markReady',
  ),
  markFailed: makeFunctionReference<'mutation', { worldId: Id<'worlds'> }, null>('worlds:markFailed'),
  finishDemo: makeFunctionReference<'mutation', { worldId: Id<'worlds'> }, null>('worlds:finishDemo'),
  poll: makeFunctionReference<'action', { worldId: Id<'worlds'> }, null>('worlds:poll'),
};

const modeV = v.union(v.literal('live'), v.literal('demo'));
const statusV = v.union(v.literal('pending'), v.literal('ready'), v.literal('failed'));

// ---------------------------------------------------------------------------------------------
// Internal reads / writes

export const getRow = internalQuery({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, { worldId }) => await ctx.db.get(worldId),
});

/** Latest world row for a moment (newest first). */
export const latestForMoment = internalQuery({
  args: { momentId: v.id('moments') },
  handler: async (ctx, { momentId }) =>
    await ctx.db
      .query('worlds')
      .withIndex('by_momentId', (q) => q.eq('momentId', momentId))
      .order('desc')
      .first(),
});

/** Public image URLs + place name for a moment, used when the client sends none. */
export const momentInputs = internalQuery({
  args: { momentId: v.id('moments') },
  handler: async (ctx, { momentId }) => {
    const moment = await ctx.db.get(momentId);
    if (!moment) return null;
    const photos = await ctx.db
      .query('photos')
      .withIndex('by_momentId', (q) => q.eq('momentId', momentId))
      .take(64);
    // Auto layout wants same-size images: keep the most common w x h.
    const counts = new Map<string, number>();
    for (const p of photos) counts.set(`${p.w}x${p.h}`, (counts.get(`${p.w}x${p.h}`) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const urls: string[] = [];
    for (const p of photos) {
      if (top && `${p.w}x${p.h}` !== top) continue;
      const url = (p.thumbStorageId ? await ctx.storage.getUrl(p.thumbStorageId) : null) ?? p.thumbUrl;
      if (url && /^https?:\/\//.test(url)) urls.push(url);
      if (urls.length >= MAX_IMAGES) break;
    }
    return { placeName: moment.placeName, urls };
  },
});

export const insertRow = internalMutation({
  args: { momentId: v.id('moments'), operationId: v.string() },
  handler: async (ctx, args) => await ctx.db.insert('worlds', { ...args, status: 'pending' }),
});

export const markReady = internalMutation({
  args: { worldId: v.id('worlds'), splatUrl: v.optional(v.string()), viewerUrl: v.optional(v.string()) },
  handler: async (ctx, { worldId, splatUrl, viewerUrl }) => {
    const row = await ctx.db.get(worldId);
    if (!row || row.status !== 'pending') return null;
    await ctx.db.patch(worldId, { status: 'ready', splatUrl, viewerUrl });
    // A real world replaces any earlier demo world for the same moment, so trips.get
    // (which takes the first ready row) serves the real one.
    if (!isDemo(row.operationId)) {
      const others = await ctx.db
        .query('worlds')
        .withIndex('by_momentId', (q) => q.eq('momentId', row.momentId))
        .take(50);
      for (const o of others) if (o._id !== worldId && isDemo(o.operationId)) await ctx.db.delete(o._id);
    }
    return null;
  },
});

export const markFailed = internalMutation({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, { worldId }) => {
    const row = await ctx.db.get(worldId);
    if (row && row.status === 'pending') await ctx.db.patch(worldId, { status: 'failed' });
    return null;
  },
});

/** DEMO MODE: flips a demo row to ready with the sample splat. Never touches World Labs. */
export const finishDemo = internalMutation({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, { worldId }) => {
    const row = await ctx.db.get(worldId);
    if (!row || row.status !== 'pending' || !isDemo(row.operationId)) return null;
    await ctx.db.patch(worldId, { status: 'ready', splatUrl: DEMO_SPLAT_URL });
    return null;
  },
});

// ---------------------------------------------------------------------------------------------
// Public: build + status

/**
 * Starts (or reuses) a world for a moment. Returns { worldId, mode }.
 * Reuses a ready or in-flight row so a double tap never pays for two generations; a demo
 * world is not reused once a key is set.
 */
export const build = action({
  args: { momentId: v.id('moments'), imageUrls: v.array(v.string()) },
  returns: v.object({ worldId: v.id('worlds'), mode: modeV, reused: v.boolean() }),
  handler: async (ctx, { momentId, imageUrls }): Promise<{ worldId: Id<'worlds'>; mode: 'live' | 'demo'; reused: boolean }> => {
    const key = apiKey();
    const existing: Doc<'worlds'> | null = await ctx.runQuery(ref.latestForMoment, { momentId });
    if (existing && existing.status !== 'failed') {
      const existingDemo = isDemo(existing.operationId);
      const stale = existing.status === 'pending' && Date.now() - existing._creationTime > POLL_GIVE_UP_MS + 60_000;
      if (!stale && (!existingDemo || !key)) {
        return { worldId: existing._id, mode: existingDemo ? 'demo' : 'live', reused: true };
      }
    }

    if (!key) {
      // DEMO MODE: no World Labs call. Flips to ready after DEMO_MS with the sample splat.
      const worldId: Id<'worlds'> = await ctx.runMutation(ref.insertRow, {
        momentId,
        operationId: `${DEMO_PREFIX}${Date.now()}`,
      });
      await ctx.scheduler.runAfter(DEMO_MS, ref.finishDemo, { worldId });
      return { worldId, mode: 'demo', reused: false };
    }

    // LIVE: World Labs needs publicly fetchable images.
    const inputs: { placeName?: string; urls: string[] } | null = await ctx.runQuery(ref.momentInputs, { momentId });
    if (!inputs) throw new Error('moment not found');
    const fromClient = imageUrls.filter((u) => /^https?:\/\//.test(u));
    const urls = [...new Set(fromClient.length ? fromClient : inputs.urls)].slice(0, MAX_IMAGES);
    if (urls.length === 0) throw new Error('no public photo urls for this stop');

    const res = await fetch(`${API_BASE}/worlds:generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'WLT-Api-Key': key },
      body: JSON.stringify({
        display_name: `openhouse · ${inputs.placeName ?? 'a stop'}`.slice(0, 64),
        world_prompt: {
          type: 'multi-image',
          // Reconstruction mode: up to 8 images, auto layout (no azimuth).
          reconstruct_images: true,
          multi_image_prompt: urls.map((uri) => ({ content: { source: 'uri', uri } })),
        },
      }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`world labs generate failed (${res.status}): ${text.slice(0, 300)}`);
    let operationId: string | undefined;
    try {
      const body = JSON.parse(text) as { operation_id?: string; id?: string };
      operationId = body.operation_id ?? body.id;
    } catch {
      // fall through
    }
    if (!operationId) throw new Error(`world labs returned no operation_id: ${text.slice(0, 300)}`);

    const worldId: Id<'worlds'> = await ctx.runMutation(ref.insertRow, { momentId, operationId });
    await ctx.scheduler.runAfter(POLL_EVERY_MS, ref.poll, { worldId });
    return { worldId, mode: 'live', reused: false };
  },
});

type MarbleWorld = {
  world_id?: string;
  id?: string;
  world_marble_url?: string | null;
  assets?: { splats?: { spz_urls?: Record<string, string> | null } | null } | null;
};

type MarbleOperation = {
  done?: boolean;
  error?: { code?: number; message?: string } | string | null;
  metadata?: { world_id?: string; progress?: { status?: string; description?: string } } | null;
  response?: MarbleWorld | null;
};

function pickSpz(world: MarbleWorld | null | undefined): string | undefined {
  const spz = world?.assets?.splats?.spz_urls;
  if (!spz) return undefined;
  // 500k is the phone sweet spot; full_res is huge, 100k is mushy.
  return spz['500k'] ?? spz['100k'] ?? spz['full_res'] ?? Object.values(spz)[0];
}

/** Polls the World Labs operation until done, then saves the splat + viewer URLs. */
export const poll = internalAction({
  args: { worldId: v.id('worlds') },
  returns: v.null(),
  handler: async (ctx, { worldId }): Promise<null> => {
    const row: Doc<'worlds'> | null = await ctx.runQuery(ref.getRow, { worldId });
    if (!row || row.status !== 'pending' || isDemo(row.operationId)) return null;
    const key = apiKey();
    if (!key) {
      await ctx.runMutation(ref.markFailed, { worldId });
      return null;
    }

    const again = async () => {
      if (Date.now() - row._creationTime > POLL_GIVE_UP_MS) {
        await ctx.runMutation(ref.markFailed, { worldId });
      } else {
        await ctx.scheduler.runAfter(POLL_EVERY_MS, ref.poll, { worldId });
      }
      return null;
    };

    let op: MarbleOperation;
    try {
      const res = await fetch(`${API_BASE}/operations/${encodeURIComponent(row.operationId)}`, {
        headers: { 'WLT-Api-Key': key },
      });
      if (res.status === 404 || res.status === 401 || res.status === 403) {
        console.log(`world labs operation ${row.operationId}: http ${res.status}`);
        await ctx.runMutation(ref.markFailed, { worldId });
        return null;
      }
      if (!res.ok) return await again();
      op = (await res.json()) as MarbleOperation;
    } catch {
      return await again(); // transient network error
    }

    if (!op.done) return await again();
    if (op.error) {
      console.log(`world labs operation ${row.operationId} failed: ${JSON.stringify(op.error).slice(0, 300)}`);
      await ctx.runMutation(ref.markFailed, { worldId });
      return null;
    }

    let world = op.response ?? null;
    if (!pickSpz(world)) {
      // Some operations return a thin response; fetch the full world.
      const id = world?.world_id ?? world?.id ?? op.metadata?.world_id;
      if (id) {
        try {
          const res = await fetch(`${API_BASE}/worlds/${encodeURIComponent(id)}`, { headers: { 'WLT-Api-Key': key } });
          if (res.ok) {
            const body = (await res.json()) as MarbleWorld & { world?: MarbleWorld };
            world = body.world ?? body;
          }
        } catch {
          // keep what we have
        }
      }
    }

    const splatUrl = pickSpz(world);
    const viewerUrl = world?.world_marble_url ?? undefined;
    if (!splatUrl && !viewerUrl) {
      await ctx.runMutation(ref.markFailed, { worldId });
      return null;
    }
    await ctx.runMutation(ref.markReady, { worldId, splatUrl, viewerUrl });
    return null;
  },
});

/** Latest world for a moment, or null. The client polls this every 3 s while building. */
export const forMoment = query({
  args: { momentId: v.id('moments') },
  returns: v.union(
    v.null(),
    v.object({
      worldId: v.id('worlds'),
      status: statusV,
      splatUrl: v.optional(v.string()),
      viewerUrl: v.optional(v.string()),
      mode: modeV,
      startedAt: v.number(),
      expectedMs: v.number(),
    }),
  ),
  handler: async (ctx, { momentId }) => {
    const row = await ctx.db
      .query('worlds')
      .withIndex('by_momentId', (q) => q.eq('momentId', momentId))
      .order('desc')
      .first();
    if (!row) return null;
    const demo = isDemo(row.operationId);
    return {
      worldId: row._id,
      status: row.status,
      splatUrl: row.splatUrl,
      viewerUrl: row.viewerUrl,
      mode: demo ? ('demo' as const) : ('live' as const),
      startedAt: row._creationTime,
      expectedMs: demo ? DEMO_MS : LIVE_EXPECTED_MS,
    };
  },
});
