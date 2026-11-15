import { v } from 'convex/values';
import { mutation, type MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';

const SHARED_WINDOW_MS = 2 * 3600_000;
const SHARED_RADIUS_M = 1000;

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(s));
}

async function sharedMoment(ctx: MutationCtx, userId: Id<'users'>, at: number, lat: number, lng: number) {
  const candidates = await ctx.db
    .query('moments')
    .withIndex('by_userId', (q) => q.eq('userId', userId).gte('startAt', at - 24 * 3600_000).lte('startAt', at + SHARED_WINDOW_MS))
    .collect();
  let best: { id: Id<'moments'>; d: number } | undefined;
  for (const m of candidates) {
    if (m.endAt + SHARED_WINDOW_MS < at) continue;
    const d = distanceM(lat, lng, m.lat, m.lng);
    if (d <= SHARED_RADIUS_M && (!best || d < best.d)) best = { id: m._id, d };
  }
  return best?.id;
}

export const pair = mutation({
  args: { userId: v.id('users'), code: v.string(), lat: v.number(), lng: v.number() },
  handler: async (ctx, { userId, code, lat, lng }) => {
    const friend = await ctx.db
      .query('users')
      .withIndex('by_shareCode', (q) => q.eq('shareCode', code.trim().toUpperCase()))
      .unique();
    if (!friend) throw new Error('No one has that code');
    if (friend._id === userId) throw new Error("That's your own code");
    if (!(await ctx.db.get(userId))) throw new Error('User not found');

    const at = Date.now();
    const pairingId = await ctx.db.insert('pairings', {
      userA: userId,
      userB: friend._id,
      at,
      lat,
      lng,
      momentA: await sharedMoment(ctx, userId, at, lat, lng),
      momentB: await sharedMoment(ctx, friend._id, at, lat, lng),
    });
    return { pairingId, friendName: friend.name, shareCode: friend.shareCode };
  },
});
