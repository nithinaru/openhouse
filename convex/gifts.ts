import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { heroThumbUrl, shipsInDays } from './orders';

export const forUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const gifts = await ctx.db
      .query('gifts')
      .withIndex('by_toUserId', (q) => q.eq('toUserId', userId))
      .order('desc')
      .take(50);
    const out = [];
    for (const gift of gifts) {
      const order = await ctx.db.get(gift.orderId);
      if (!order || (order.status !== 'paid' && order.status !== 'fulfilled')) continue;
      const from = await ctx.db.get(gift.fromUserId);
      const trip = order.tripId ? await ctx.db.get(order.tripId) : null;
      const moment = gift.momentId ? await ctx.db.get(gift.momentId) : null;
      let previewUrl = await heroThumbUrl(ctx, moment);
      if (!previewUrl && trip) {
        const stops = await ctx.db
          .query('moments')
          .withIndex('by_tripId', (q) => q.eq('tripId', trip._id))
          .take(20);
        previewUrl = await heroThumbUrl(ctx, stops.find((m) => m.heroPhotoId) ?? null);
      }
      const product = order.product ?? 'print';
      const variant = order.variant ?? order.size ?? null;
      out.push({
        giftId: gift._id,
        orderId: order._id,
        fromName: from?.name ?? 'a friend',
        product,
        variant,
        tripTitle: trip?.title ?? 'your day',
        placeName: moment?.placeName ?? null,
        previewUrl,
        downloadUrl:
          order.status === 'fulfilled' && order.downloadStorageId ? await ctx.storage.getUrl(order.downloadStorageId) : null,
        shipsInDays: shipsInDays(product, variant),
        createdAt: gift._creationTime,
        seen: gift.seen,
      });
    }
    return out;
  },
});

export const markSeen = mutation({
  args: { giftId: v.id('gifts') },
  handler: async (ctx, { giftId }) => {
    await ctx.db.patch(giftId, { seen: true });
    return null;
  },
});
