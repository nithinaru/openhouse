import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { weather } from './schema';

const momentInput = v.object({
  id: v.optional(v.id('moments')),
  startAt: v.number(),
  endAt: v.number(),
  lat: v.number(),
  lng: v.number(),
  placeName: v.optional(v.string()),
  headingDeg: v.optional(v.number()),
  altitudeM: v.optional(v.number()),
  avgIso: v.optional(v.number()),
  isGoldenHour: v.optional(v.boolean()),
  weather: v.optional(weather),
  order: v.number(),
});

export const upsertMany = mutation({
  args: { tripId: v.id('trips'), moments: v.array(momentInput) },
  handler: async (ctx, { tripId, moments }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip) throw new Error('Trip not found');
    const ids = [];
    for (const { id, ...fields } of moments) {
      if (id) {
        const existing = await ctx.db.get(id);
        if (!existing || existing.tripId !== tripId) throw new Error(`Moment ${id} is not in this trip`);
        await ctx.db.patch(id, fields);
        ids.push(id);
      } else {
        ids.push(await ctx.db.insert('moments', { ...fields, tripId, userId: trip.userId }));
      }
    }
    return ids;
  },
});
