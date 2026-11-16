// Supermemory (v5 API) for "ask your day" (docs/CAPY.md Thread 9). Server-side only.
//
//   Base URL  https://api.supermemory.ai           Auth  Authorization: Bearer <SUPERMEMORY_API_KEY>
//   Add       POST /ns/{namespace}/document        body { content, id?, metadata?, dreaming?, taskType? }
//                                                  -> { id, status: 'queued' }
//   Search    POST /ns/{namespace}/search          body { query, searchMode?, limit?, threshold?, filter? }
//                                                  -> { results: [{ id, memory? | chunk?, similarity, metadata }], searchTime }
//
// The namespace (formerly "container tag") lives in the URL path and is the per-user isolation
// boundary: one namespace per trip owner, `openhouse_user_<userId>`. The trip id rides in metadata
// so a search can filter to one trip. Sending the same document `id` again updates instead of
// duplicating, so indexTrip is safe to re-run.

import { v } from 'convex/values';
import { api } from './_generated/api';
import { action, env, internalAction } from './_generated/server';
import type { Moment, Trip } from '../src/lib/types';

const API_BASE = 'https://api.supermemory.ai';

// SUPERMEMORY_API_KEY isn't declared in convex.config.ts (not ours to edit), so read it untyped.
function apiKey(): string | undefined {
  const key = (env as unknown as Record<string, string | undefined>).SUPERMEMORY_API_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

export const namespaceFor = (userId: string) => `openhouse_user_${userId}`.replace(/[^A-Za-z0-9_:-]/g, '_').slice(0, 100);

export type MemoryHit = { id: string; text: string; similarity: number; metadata: Record<string, unknown> };

async function smFetch(path: string, body: unknown): Promise<any> {
  const key = apiKey();
  if (!key) throw new Error('SUPERMEMORY_API_KEY not set');
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`supermemory ${path.split('/').pop()} ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });

function momentText(trip: Trip, m: Moment): string {
  const met = trip.pairings
    .filter((p) => p.momentId === m.id)
    .map((p) => trip.people.find((person) => person.id === (p.userA === trip.userId ? p.userB : p.userA))?.name)
    .filter(Boolean);
  const lines = [
    `On "${trip.title}", stop ${m.order + 1}: ${m.placeName ?? 'an unnamed place'} at ${clock(m.startAt)}-${clock(m.endAt)} (Pacific).`,
    m.caption && `Caption: ${m.caption}`,
    m.narration && `Narration: ${m.narration}`,
    m.weather && `Weather: ${m.weather.tempF}°F, ${m.weather.summary}.`,
    m.isGoldenHour && 'This was during golden hour.',
    m.fact && `Fact about the place: ${m.fact}`,
    m.sceneTags?.length && `Scene: ${m.sceneTags.join(', ')}.`,
    met.length && `Met: ${met.join(', ')}.`,
  ];
  return lines.filter(Boolean).join('\n');
}

export async function searchMemories(userId: string, query: string, opts: { tripId?: string; limit?: number } = {}): Promise<MemoryHit[]> {
  const body: Record<string, unknown> = { query, searchMode: 'hybrid', limit: opts.limit ?? 6, threshold: 0.3 };
  if (opts.tripId) body.filter = { operator: 'and', operands: [{ field: 'tripId', operator: 'eq', value: opts.tripId }] };
  const data = await smFetch(`/ns/${namespaceFor(userId)}/search`, body);
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  return results
    .map((r) => ({
      id: String(r.id ?? ''),
      text: String(r.memory ?? r.chunk ?? ''),
      similarity: typeof r.similarity === 'number' ? r.similarity : 0,
      metadata: r.metadata && typeof r.metadata === 'object' ? r.metadata : {},
    }))
    .filter((r) => r.text);
}

export const indexTrip = action({
  args: { tripId: v.id('trips') },
  returns: v.object({ namespace: v.string(), added: v.number(), failed: v.number() }),
  handler: async (ctx, { tripId }) => {
    const trip = (await ctx.runQuery(api.trips.get, { id: tripId })) as Trip | null;
    if (!trip) throw new Error('Trip not found');
    const namespace = namespaceFor(trip.userId);
    let added = 0;
    let failed = 0;
    for (const m of trip.moments) {
      try {
        await smFetch(`/ns/${namespace}/document`, {
          id: `openhouse_moment_${m.id}`,
          content: momentText(trip, m),
          dreaming: 'instant',
          metadata: {
            source: 'openhouse',
            userId: trip.userId,
            tripId: trip.id,
            momentId: m.id,
            order: m.order,
            startAt: m.startAt,
            ...(m.placeName ? { placeName: m.placeName } : {}),
          },
        });
        added++;
      } catch (e) {
        failed++;
        console.warn(`indexTrip: moment ${m.id} failed: ${(e as Error).message}`);
      }
    }
    return { namespace, added, failed };
  },
});

export const search = internalAction({
  args: { userId: v.string(), query: v.string(), tripId: v.optional(v.string()) },
  returns: v.array(v.object({ id: v.string(), text: v.string(), similarity: v.number(), metadata: v.any() })),
  handler: async (_ctx, { userId, query, tripId }) => searchMemories(userId, query, { tripId }),
});
