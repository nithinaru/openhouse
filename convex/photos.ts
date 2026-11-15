import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { lens } from './schema';

const photoInput = v.object({
  momentId: v.id('moments'),
  takenAt: v.number(),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  headingDeg: v.optional(v.number()),
  altitudeM: v.optional(v.number()),
  lens: v.optional(lens),
  subtypes: v.array(v.string()),
  isFavorite: v.boolean(),
  thumbStorageId: v.id('_storage'),
  w: v.number(),
  h: v.number(),
});

export const addMany = mutation({
  args: { photos: v.array(photoInput) },
  handler: async (ctx, { photos }) => {
    const ids = [];
    for (const photo of photos) {
      const moment = await ctx.db.get(photo.momentId);
      if (!moment) throw new Error(`Moment ${photo.momentId} not found`);
      ids.push(await ctx.db.insert('photos', { ...photo, userId: moment.userId }));
    }
    return ids;
  },
});
