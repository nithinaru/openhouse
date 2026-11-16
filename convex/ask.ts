// "Ask your day" (docs/CAPY.md Thread 9): answer a question about a trip with Claude, grounded in
// the trip's moments (trips.get) plus Supermemory search results for the trip owner.
// Never throws to the client for model or memory failures: it returns a graceful answer instead
// (src/features/ask/askBackend.ts still falls back on-device if the call itself fails).

import { v } from 'convex/values';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action, env } from './_generated/server';
import type { Trip } from '../src/lib/types';
import { searchMemories, type MemoryHit } from './memories';

const MODEL = 'claude-sonnet-5-5';
const MAX_TOKENS = 400;

function anthropicKey(): string | undefined {
  const key = (env as unknown as Record<string, string | undefined>).ANTHROPIC_API_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });

function tripContext(trip: Trip): string {
  const nameOf = (id: string) => trip.people.find((p) => p.id === id)?.name ?? 'a friend';
  const moments = [...trip.moments]
    .sort((a, b) => a.order - b.order)
    .map((m) => {
      const met = trip.pairings
        .filter((p) => p.momentId === m.id)
        .map((p) => `${nameOf(p.userA === trip.userId ? p.userB : p.userA)} at ${clock(p.at)}`);
      return {
        id: m.id,
        order: m.order + 1,
        time: `${clock(m.startAt)}-${clock(m.endAt)}`,
        place: m.placeName,
        caption: m.caption,
        narration: m.narration,
        weather: m.weather ? `${m.weather.tempF}°F, ${m.weather.summary}` : undefined,
        goldenHour: m.isGoldenHour || undefined,
        fact: m.fact,
        scene: m.sceneTags?.length ? m.sceneTags.join(', ') : undefined,
        met: met.length ? met : undefined,
      };
    });
  const pairings = trip.pairings.map((p) => ({
    with: nameOf(p.userA === trip.userId ? p.userB : p.userA),
    time: clock(p.at),
    momentId: p.momentId,
  }));
  return JSON.stringify(
    { title: trip.title, story: trip.story, timezone: 'America/Los_Angeles', moments, peopleMet: pairings },
    null,
    1,
  );
}

const SYSTEM = `You answer questions about one person's day, using only the trip context and memories given.
Write one or two warm, specific sentences in second person ("you"), lowercase-friendly and casual, with no exclamation marks.
Mention concrete details (time, place, weather, who) when they answer the question. If the context doesn't say, admit it gently.
Reply with strict JSON only, no prose around it: {"answer": "...", "momentIds": ["..."]}
momentIds lists the ids of the moments your answer refers to, copied exactly from the context's moments[].id (empty array if none).`;

function extractJson(text: string): { answer?: unknown; momentIds?: unknown } | null {
  // Try every '{' that opens an object with an "answer" key, last complete one wins.
  const starts = [...text.matchAll(/\{\s*"answer"/g)].map((m) => m.index ?? 0);
  for (const start of starts.reverse()) {
    const end = text.lastIndexOf('}');
    if (end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        /* try the next candidate */
      }
    }
  }
  // Truncated JSON: salvage the answer string and any ids seen so far.
  const answer = text.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (answer) {
    let decoded = answer[1];
    try {
      decoded = JSON.parse(`"${answer[1]}"`);
    } catch {
      /* keep raw */
    }
    const ids = text.match(/"momentIds"\s*:\s*\[([^\]]*)/);
    return { answer: decoded, momentIds: ids ? [...ids[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [] };
  }
  return null;
}

const stripFences = (text: string) => text.replace(/```(?:json)?[\s\S]*?(```|$)/g, '').trim();

const result = v.object({ answer: v.string(), momentIds: v.array(v.string()), momentOrders: v.array(v.number()) });

export const question = action({
  // tripId stays a string so a bad id returns a graceful answer instead of a validator error.
  args: { tripId: v.string(), question: v.string() },
  returns: result,
  handler: async (ctx, { tripId, question }) => {
    const graceful = (answer: string) => ({ answer, momentIds: [] as string[], momentOrders: [] as number[] });

    let trip: Trip | null = null;
    try {
      trip = (await ctx.runQuery(api.trips.get, { id: tripId as Id<'trips'> })) as Trip | null;
    } catch {
      trip = null;
    }
    if (!trip) return graceful("i couldn't find that day, so i can't look it up just yet.");

    let memories: MemoryHit[] = [];
    try {
      memories = await searchMemories(trip.userId, question, { tripId: trip.id, limit: 6 });
    } catch (e) {
      console.warn(`ask: supermemory search skipped: ${(e as Error).message}`);
    }

    const key = anthropicKey();
    if (!key) return graceful("i can't think about your day right now, but every stop is still on the map.");

    const memoryBlock = memories.length
      ? memories.map((m) => `- ${m.text.replace(/\s+/g, ' ').slice(0, 500)}${m.metadata.momentId ? ` (momentId ${m.metadata.momentId})` : ''}`).join('\n')
      : '(none)';
    const userMsg = `Trip context:\n${tripContext(trip)}\n\nRelated memories:\n${memoryBlock}\n\nQuestion: ${question}\n\nRespond with only the JSON object, starting with { and nothing before or after it. Keep the answer under 45 words.`;

    let text = '';
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM, messages: [{ role: 'user', content: userMsg }] }),
      });
      const body = await res.json();
      if (!res.ok) {
        console.warn(`ask: anthropic ${res.status}: ${JSON.stringify(body?.error ?? body).slice(0, 300)}`);
        return graceful("i'm having trouble remembering right now, try asking again in a moment.");
      }
      text = (Array.isArray(body?.content) ? body.content : [])
        .filter((b: any) => b?.type === 'text')
        .map((b: any) => b.text)
        .join('')
        .trim();
    } catch (e) {
      console.warn(`ask: anthropic call failed: ${(e as Error).message}`);
      return graceful("i'm having trouble remembering right now, try asking again in a moment.");
    }
    if (!text) return graceful("i'm not sure about that one, but your stops are all on the map.");

    const known = new Map(trip.moments.map((m) => [m.id, m.order]));
    const parsed = extractJson(text);
    if (!parsed || typeof parsed.answer !== 'string' || !parsed.answer.trim()) return graceful(stripFences(text) || "i'm not sure about that one, but your stops are all on the map.");
    const momentIds = (Array.isArray(parsed.momentIds) ? parsed.momentIds : []).filter(
      (id): id is string => typeof id === 'string' && known.has(id),
    );
    return {
      answer: parsed.answer.trim(),
      momentIds,
      // Lets clients holding a local copy of the trip (different ids, same order) map citations.
      momentOrders: momentIds.map((id) => known.get(id)!),
    };
  },
});
