import { v, type Infer } from 'convex/values';
import { action, internalMutation, query, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { posterStyle, printSize, product as productValidator } from './schema';
import { applyDropPayment, whopPromoFields } from './drops';
import { hasPlus } from './memberships';
import { dollars, purchaseUrlOf, whop } from './whop';

type Product = Infer<typeof productValidator>;
type PrintSize = Infer<typeof printSize>;

const PRICE_CENTS: Record<Exclude<Product, 'drop'>, Record<string, number>> = {
  print: { '12x16': 3900, '18x24': 5900 },
  postcards: { '': 1800 },
  zine: { digital: 1200, printed: 2900 },
  film: { '': 600 },
};

const PLUS_STYLES = new Set(['night', 'field']);

export function shipsInDays(product: Product, variant: string | null): [number, number] | null {
  if (product === 'print') return [3, 5];
  if (product === 'postcards') return [4, 6];
  if (product === 'zine' && variant === 'printed') return [5, 7];
  return null;
}

export async function heroThumbUrl(ctx: QueryCtx, moment: Doc<'moments'> | null): Promise<string | null> {
  const photo = moment?.heroPhotoId ? await ctx.db.get(moment.heroPhotoId) : null;
  if (!photo) return null;
  return (photo.thumbStorageId ? await ctx.storage.getUrl(photo.thumbStorageId) : null) ?? photo.thumbUrl ?? null;
}

function checkoutTitle(product: Exclude<Product, 'drop'>, variant: string | null, giftName: string | null) {
  const base =
    product === 'print'
      ? `Framed print ${variant}`
      : product === 'postcards'
        ? 'Postcard pack'
        : product === 'zine'
          ? `Trip zine (${variant})`
          : 'Narrated film';
  return giftName ? `${base} (gift for ${giftName})` : base;
}

const checkoutArgs = {
  userId: v.id('users'),
  tripId: v.id('trips'),
  product: v.optional(productValidator),
  variant: v.optional(v.string()),
  style: v.optional(posterStyle),
  size: v.optional(printSize),
  momentId: v.optional(v.id('moments')),
  giftToShareCode: v.optional(v.string()),
};

type CreatedOrder = { orderId: Id<'orders'>; title: string; priceCents: number };

export const checkout = action({
  args: checkoutArgs,
  handler: async (ctx, args): Promise<{ purchaseUrl: string; orderId: Id<'orders'> }> => {
    const client = whop();
    const { orderId, title, priceCents }: CreatedOrder = await ctx.runMutation(internal.orders.create, args);
    const config = await client.checkoutConfigurations.create({
      mode: 'payment',
      metadata: { orderId },
      variant: {
        title,
        billing_type: 'one_time',
        currency: 'usd',
        initial_price: dollars(priceCents),
      },
    });
    const purchaseUrl = purchaseUrlOf(config);
    await ctx.runMutation(internal.orders.setCheckout, { orderId, whopCheckoutId: config.id });
    return { purchaseUrl, orderId };
  },
});

export const create = internalMutation({
  args: checkoutArgs,
  handler: async (ctx, args): Promise<CreatedOrder> => {
    const { userId, tripId, momentId } = args;
    const product = args.product ?? 'print';
    if (product === 'drop') throw new Error('Drop orders go through drops:checkout');
    const trip = await ctx.db.get(tripId);
    if (!trip || trip.userId !== userId) throw new Error('Trip not found for this user');
    if (momentId) {
      const moment = await ctx.db.get(momentId);
      if (!moment || moment.tripId !== tripId) throw new Error('Stop not found in this trip');
    }

    let variant = args.variant ?? null;
    let size: PrintSize | undefined;
    let posterId: Id<'posters'> | undefined;
    if (product === 'print') {
      size = args.size ?? (args.variant === '12x16' || args.variant === '18x24' ? args.variant : undefined);
      if (!args.style || !size) throw new Error('A print needs a style and a size');
      if (args.variant && args.variant !== size) throw new Error('Print variant must match its size');
      if (PLUS_STYLES.has(args.style) && !(await hasPlus(ctx, userId))) {
        throw new Error(`The ${args.style} style needs Openhouse+`);
      }
      variant = size;
      posterId = await ctx.db.insert('posters', { tripId, style: args.style });
    } else if (args.style || args.size) {
      throw new Error('Style and size apply to prints only');
    }
    const priceCents = PRICE_CENTS[product][variant ?? ''];
    if (priceCents === undefined) throw new Error(`Unknown ${product} variant: ${variant}`);

    let giftTo: Doc<'users'> | null = null;
    if (args.giftToShareCode) {
      const code = args.giftToShareCode.trim().toUpperCase();
      giftTo = await ctx.db
        .query('users')
        .withIndex('by_shareCode', (q) => q.eq('shareCode', code))
        .unique();
      if (!giftTo) throw new Error('No one has that code');
      if (giftTo._id === userId) throw new Error("That's your own code");
    }

    const orderId = await ctx.db.insert('orders', {
      userId,
      tripId,
      product,
      variant: variant ?? undefined,
      posterId,
      size,
      momentId,
      giftToUserId: giftTo?._id,
      status: 'pending',
    });
    return { orderId, title: checkoutTitle(product, variant, giftTo?.name ?? null), priceCents };
  },
});

export const setCheckout = internalMutation({
  args: { orderId: v.id('orders'), whopCheckoutId: v.string() },
  handler: async (ctx, { orderId, whopCheckoutId }) => {
    await ctx.db.patch(orderId, { whopCheckoutId });
  },
});

export const markPaid = internalMutation({
  args: {
    orderId: v.optional(v.string()),
    whopCheckoutId: v.optional(v.string()),
    whopPaymentId: v.optional(v.string()),
    whopPromoCodeId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<'orders'> | null> => {
    const id = args.orderId ? ctx.db.normalizeId('orders', args.orderId) : null;
    const order =
      (id ? await ctx.db.get(id) : null) ??
      (args.whopCheckoutId
        ? await ctx.db
            .query('orders')
            .withIndex('by_whopCheckoutId', (q) => q.eq('whopCheckoutId', args.whopCheckoutId))
            .unique()
        : null);
    if (!order) return null;
    if (order.status !== 'pending') return order._id;
    const fields = {
      status: 'paid' as const,
      whopPaymentId: args.whopPaymentId,
      paidAt: Date.now(),
      ...(await whopPromoFields(ctx, order, args.whopPromoCodeId)),
    };
    await ctx.db.patch(order._id, fields);
    await applyDropPayment(ctx, { ...order, ...fields }, 1);
    if (order.giftToUserId) {
      await ctx.db.insert('gifts', {
        orderId: order._id,
        fromUserId: order.userId,
        toUserId: order.giftToUserId,
        momentId: order.momentId,
        seen: false,
      });
    }
    return order._id;
  },
});

export const markRefunded = internalMutation({
  args: { whopPaymentId: v.string() },
  handler: async (ctx, { whopPaymentId }): Promise<Id<'orders'> | null> => {
    const order = await ctx.db
      .query('orders')
      .withIndex('by_whopPaymentId', (q) => q.eq('whopPaymentId', whopPaymentId))
      .unique();
    if (!order) return null;
    if (order.status === 'refunded') return order._id;
    await ctx.db.patch(order._id, { status: 'refunded' });
    if (order.status === 'paid' || order.status === 'fulfilled') await applyDropPayment(ctx, order, -1);
    return order._id;
  },
});

export const attachDownload = internalMutation({
  args: { orderId: v.id('orders'), storageId: v.id('_storage') },
  handler: async (ctx, { orderId, storageId }) => {
    const order = await ctx.db.get(orderId);
    if (!order || order.status !== 'paid') throw new Error('Only a paid order can be fulfilled');
    await ctx.db.patch(orderId, { downloadStorageId: storageId, status: 'fulfilled' });
  },
});

export const get = query({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    const product = order.product ?? 'print';
    const variant = order.variant ?? order.size ?? null;
    const poster = order.posterId ? await ctx.db.get(order.posterId) : null;
    const giftTo = order.giftToUserId ? await ctx.db.get(order.giftToUserId) : null;
    return {
      status: order.status,
      product,
      variant,
      style: poster?.style ?? null,
      size: order.size ?? null,
      shipsInDays: shipsInDays(product, variant),
      downloadUrl:
        order.status === 'fulfilled' && order.downloadStorageId ? await ctx.storage.getUrl(order.downloadStorageId) : null,
      giftTo: giftTo ? { name: giftTo.name } : null,
    };
  },
});
