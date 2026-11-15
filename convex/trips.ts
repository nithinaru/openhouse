import { v } from 'convex/values';
import { mutation, query, type QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { Pairing, Person, Photo, Trip } from '../src/lib/types';

const url = async (ctx: QueryCtx, id: Id<'_storage'> | undefined) => (id ? ((await ctx.storage.getUrl(id)) ?? undefined) : undefined);

function tripFields(trip: Doc<'trips'>) {
  return {
    id: trip._id,
    userId: trip.userId,
    title: trip.title,
    startAt: trip.startAt,
    endAt: trip.endAt,
    palette: trip.palette,
    story: trip.story,
    status: trip.status,
  };
}

async function momentPhotos(ctx: QueryCtx, momentId: Id<'moments'>): Promise<Photo[]> {
  const docs = await ctx.db
    .query('photos')
    .withIndex('by_momentId', (q) => q.eq('momentId', momentId))
    .collect();
  return Promise.all(
    docs.map(async ({ _id, _creationTime, thumbStorageId, thumbUrl, ...p }) => ({
      ...p,
      id: _id,
      uri: (await url(ctx, thumbStorageId)) ?? thumbUrl ?? '',
    })),
  );
}

export const list = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const trips = await ctx.db
      .query('trips')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .collect();
    return trips.map(tripFields);
  },
});

export const get = query({
  args: { id: v.id('trips') },
  handler: async (ctx, { id }): Promise<Trip | null> => {
    const trip = await ctx.db.get(id);
    if (!trip) return null;

    const momentDocs = await ctx.db
      .query('moments')
      .withIndex('by_tripId', (q) => q.eq('tripId', id))
      .collect();
    const moments = await Promise.all(
      momentDocs.map(async ({ _id, _creationTime, ambientVideoStorageId, ...m }) => {
        const world = await ctx.db
          .query('worlds')
          .withIndex('by_momentId', (q) => q.eq('momentId', _id))
          .filter((q) => q.eq(q.field('status'), 'ready'))
          .first();
        return {
          ...m,
          id: _id,
          photos: await momentPhotos(ctx, _id),
          ambientUri: await url(ctx, ambientVideoStorageId),
          worldViewerUrl: world?.viewerUrl,
          worldSplatUrl: world?.splatUrl,
        };
      }),
    );

    const inWindow = (q: any, field: 'userA' | 'userB') =>
      q.eq(field, trip.userId).gte('at', trip.startAt).lte('at', trip.endAt);
    const pairingDocs = [
      ...(await ctx.db.query('pairings').withIndex('by_userA', (q) => inWindow(q, 'userA')).collect()),
      ...(await ctx.db.query('pairings').withIndex('by_userB', (q) => inWindow(q, 'userB')).collect()),
    ];

    const pairings: Pairing[] = [];
    const theirAngles: Record<string, Photo[]> = {};
    const friendIds = new Set<Id<'users'>>();
    for (const p of pairingDocs) {
      const mine = p.userA === trip.userId;
      const myMoment = mine ? p.momentA : p.momentB;
      const theirMoment = mine ? p.momentB : p.momentA;
      friendIds.add(mine ? p.userB : p.userA);
      pairings.push({ id: p._id, userA: p.userA, userB: p.userB, at: p.at, lat: p.lat, lng: p.lng, momentId: myMoment });
      if (myMoment && theirMoment) {
        theirAngles[myMoment] = [...(theirAngles[myMoment] ?? []), ...(await momentPhotos(ctx, theirMoment))];
      }
    }

    const people: Person[] = [];
    for (const friendId of friendIds) {
      const user = await ctx.db.get(friendId);
      if (user) {
        people.push({ id: user._id, name: user.name, shareCode: user.shareCode, avatarUri: await url(ctx, user.avatarStorageId) });
      }
    }

    return { ...tripFields(trip), moments, people, pairings, theirAngles };
  },
});

export const create = mutation({
  args: {
    userId: v.id('users'),
    title: v.string(),
    startAt: v.number(),
    endAt: v.number(),
    palette: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { palette, ...trip }) => {
    if (!(await ctx.db.get(trip.userId))) throw new Error('User not found');
    return await ctx.db.insert('trips', { ...trip, palette: palette ?? [], status: 'ingesting' });
  },
});
