import { v } from 'convex/values';
import { action, internalMutation, internalQuery, query } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { heroThumbUrl } from './orders';
import { dollars, purchaseUrlOf, whop } from './whop';

const MIN_PRICE_CENTS = 100;
const MAX_PRICE_CENTS = 1000;
const PLATFORM_FEE = 0.1;

const shareUrl = (listingId: Id<'listings'>) => `openhouse://listing/${listingId}`;

export const create = action({
  args: { userId: v.id('users'), tripId: v.id('trips'), title: v.string(), priceCents: v.number() },
  handler: async (ctx, args): Promise<{ listingId: Id<'listings'>; shareUrl: string }> => {
    const title = args.title.trim();
    if (!title) throw new Error('A guide needs a title');
    if (!Number.isInteger(args.priceCents) || args.priceCents < MIN_PRICE_CENTS || args.priceCents > MAX_PRICE_CENTS) {
      throw new Error(`Price must be a whole number of cents from ${MIN_PRICE_CENTS} to ${MAX_PRICE_CENTS}`);
    }
    const owns: boolean = await ctx.runQuery(internal.listings.ownsTrip, { userId: args.userId, tripId: args.tripId });
    if (!owns) throw new Error('Trip not found for this user');

    const client = whop();
    const product = await client.products.create({ title, metadata: { tripId: args.tripId, sellerUserId: args.userId } });
    const variant = await client.variants.create({
      product_id: product.id,
      title,
      billing_type: 'one_time',
      currency: 'usd',
      initial_price: dollars(args.priceCents),
    });
    const listingId: Id<'listings'> = await ctx.runMutation(internal.listings.insert, {
      userId: args.userId,
      tripId: args.tripId,
      title,
      priceCents: args.priceCents,
      whopProductId: product.id,
      whopPlanId: variant.id,
    });
    return { listingId, shareUrl: shareUrl(listingId) };
  },
});

export const ownsTrip = internalQuery({
  args: { userId: v.id('users'), tripId: v.id('trips') },
  handler: async (ctx, { userId, tripId }) => (await ctx.db.get(tripId))?.userId === userId,
});

export const insert = internalMutation({
  args: {
    userId: v.id('users'),
    tripId: v.id('trips'),
    title: v.string(),
    priceCents: v.number(),
    whopProductId: v.string(),
    whopPlanId: v.string(),
  },
  handler: async (ctx, args) => await ctx.db.insert('listings', { ...args, sales: 0, earningsCents: 0 }),
});

export const forSeller = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const listings = await ctx.db
      .query('listings')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(100);
    return listings.map((l) => ({
      listingId: l._id,
      title: l.title,
      priceCents: l.priceCents,
      sales: l.sales,
      earningsCents: l.earningsCents,
      shareUrl: shareUrl(l._id),
      tripId: l.tripId,
    }));
  },
});

export const get = query({
  args: { listingId: v.id('listings') },
  handler: async (ctx, { listingId }) => {
    const listing = await ctx.db.get(listingId);
    if (!listing) return null;
    const seller = await ctx.db.get(listing.userId);
    const stops = await ctx.db
      .query('moments')
      .withIndex('by_tripId', (q) => q.eq('tripId', listing.tripId))
      .take(500);
    const previewUrls: string[] = [];
    for (const stop of stops) {
      if (previewUrls.length === 4) break;
      const url = await heroThumbUrl(ctx, stop);
      if (url) previewUrls.push(url);
    }
    return {
      listingId,
      title: listing.title,
      priceCents: listing.priceCents,
      sellerName: seller?.name ?? 'someone',
      tripId: listing.tripId,
      stops: stops.length,
      previewUrls,
    };
  },
});

export const checkout = action({
  args: { listingId: v.id('listings'), buyerUserId: v.id('users') },
  handler: async (ctx, args): Promise<{ purchaseUrl: string; orderId: string }> => {
    const { purchaseId, whopPlanId }: { purchaseId: Id<'purchases'>; whopPlanId: string } = await ctx.runMutation(
      internal.listings.startPurchase,
      args,
    );
    const config = await whop().checkoutConfigurations.create({
      mode: 'payment',
      variant_id: whopPlanId,
      metadata: { purchaseId },
    });
    const purchaseUrl = purchaseUrlOf(config);
    await ctx.runMutation(internal.listings.setCheckout, { purchaseId, whopCheckoutId: config.id });
    return { purchaseUrl, orderId: purchaseId };
  },
});

export const startPurchase = internalMutation({
  args: { listingId: v.id('listings'), buyerUserId: v.id('users') },
  handler: async (ctx, { listingId, buyerUserId }) => {
    const listing = await ctx.db.get(listingId);
    if (!listing) throw new Error('This guide is not available');
    if (!(await ctx.db.get(buyerUserId))) throw new Error('User not found');
    if (listing.userId === buyerUserId) throw new Error('This is your own guide');
    const owned = await ctx.db
      .query('purchases')
      .withIndex('by_listingId_and_buyerUserId', (q) => q.eq('listingId', listingId).eq('buyerUserId', buyerUserId))
      .filter((q) => q.eq(q.field('status'), 'paid'))
      .first();
    if (owned) throw new Error('You already have this guide');
    const purchaseId = await ctx.db.insert('purchases', { listingId, buyerUserId, status: 'pending' });
    return { purchaseId, whopPlanId: listing.whopPlanId };
  },
});

export const setCheckout = internalMutation({
  args: { purchaseId: v.id('purchases'), whopCheckoutId: v.string() },
  handler: async (ctx, { purchaseId, whopCheckoutId }) => {
    await ctx.db.patch(purchaseId, { whopCheckoutId });
  },
});

export const hasAccess = query({
  args: { listingId: v.id('listings'), userId: v.id('users') },
  handler: async (ctx, { listingId, userId }) => {
    const listing = await ctx.db.get(listingId);
    if (!listing) return { access: false, tripId: null };
    const paid =
      listing.userId === userId ||
      (await ctx.db
        .query('purchases')
        .withIndex('by_listingId_and_buyerUserId', (q) => q.eq('listingId', listingId).eq('buyerUserId', userId))
        .filter((q) => q.eq(q.field('status'), 'paid'))
        .first()) !== null;
    return paid ? { access: true, tripId: listing.tripId } : { access: false, tripId: null };
  },
});

export const markPaid = internalMutation({
  args: {
    purchaseId: v.optional(v.string()),
    whopCheckoutId: v.optional(v.string()),
    whopPaymentId: v.optional(v.string()),
    afterFeesCents: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<'purchases'> | null> => {
    const id = args.purchaseId ? ctx.db.normalizeId('purchases', args.purchaseId) : null;
    const purchase: Doc<'purchases'> | null =
      (id ? await ctx.db.get(id) : null) ??
      (args.whopCheckoutId
        ? await ctx.db
            .query('purchases')
            .withIndex('by_whopCheckoutId', (q) => q.eq('whopCheckoutId', args.whopCheckoutId))
            .unique()
        : null);
    if (!purchase) return null;
    if (purchase.status !== 'pending') return purchase._id;
    const listing = await ctx.db.get(purchase.listingId);
    if (!listing) return null;
    const netCents = Math.max(0, (args.afterFeesCents ?? listing.priceCents) - Math.round(listing.priceCents * PLATFORM_FEE));
    await ctx.db.patch(purchase._id, { status: 'paid', whopPaymentId: args.whopPaymentId, netCents });
    await ctx.db.patch(listing._id, { sales: listing.sales + 1, earningsCents: listing.earningsCents + netCents });
    return purchase._id;
  },
});

export const markRefunded = internalMutation({
  args: { whopPaymentId: v.string() },
  handler: async (ctx, { whopPaymentId }): Promise<Id<'purchases'> | null> => {
    const purchase = await ctx.db
      .query('purchases')
      .withIndex('by_whopPaymentId', (q) => q.eq('whopPaymentId', whopPaymentId))
      .unique();
    if (!purchase) return null;
    if (purchase.status !== 'paid') return purchase._id;
    await ctx.db.patch(purchase._id, { status: 'refunded' });
    const listing = await ctx.db.get(purchase.listingId);
    if (listing) {
      await ctx.db.patch(listing._id, {
        sales: Math.max(0, listing.sales - 1),
        earningsCents: Math.max(0, listing.earningsCents - (purchase.netCents ?? 0)),
      });
    }
    return purchase._id;
  },
});
