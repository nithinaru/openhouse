import { v } from 'convex/values';
import { WhopClient, WhopEnvironment } from '@whop/sdk';
import { action, env, internalMutation, query } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { posterStyle, printSize } from './schema';

const PRICE_USD = { '12x16': 39, '18x24': 59 } as const;

function whop() {
  if (!env.WHOP_ENVIRONMENT) throw new Error('WHOP_ENVIRONMENT must be "sandbox" or "production"');
  return new WhopClient({
    token: env.WHOP_API_KEY,
    environment: env.WHOP_ENVIRONMENT === 'sandbox' ? WhopEnvironment.Sandbox : WhopEnvironment.Production,
  });
}

export const checkout = action({
  args: { userId: v.id('users'), tripId: v.id('trips'), style: posterStyle, size: printSize },
  handler: async (ctx, args): Promise<{ purchaseUrl: string; orderId: Id<'orders'> }> => {
    const client = whop();
    const orderId: Id<'orders'> = await ctx.runMutation(internal.orders.create, args);
    const config = await client.checkoutConfigurations.create({
      mode: 'payment',
      metadata: { orderId },
      variant: {
        title: `Framed print ${args.size}`,
        billing_type: 'one_time',
        currency: 'usd',
        initial_price: PRICE_USD[args.size],
      },
    });
    if (!config.purchase_url) throw new Error(`Whop checkout ${config.id} has no purchase_url`);
    await ctx.runMutation(internal.orders.setCheckout, { orderId, whopCheckoutId: config.id });
    return { purchaseUrl: config.purchase_url, orderId };
  },
});

export const create = internalMutation({
  args: { userId: v.id('users'), tripId: v.id('trips'), style: posterStyle, size: printSize },
  handler: async (ctx, { userId, tripId, style, size }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip || trip.userId !== userId) throw new Error('Trip not found for this user');
    const posterId = await ctx.db.insert('posters', { tripId, style });
    return await ctx.db.insert('orders', { posterId, userId, size, status: 'pending' });
  },
});

export const setCheckout = internalMutation({
  args: { orderId: v.id('orders'), whopCheckoutId: v.string() },
  handler: async (ctx, { orderId, whopCheckoutId }) => {
    await ctx.db.patch(orderId, { whopCheckoutId });
  },
});

export const markPaid = internalMutation({
  args: { orderId: v.optional(v.string()), whopCheckoutId: v.optional(v.string()) },
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
    if (order.status !== 'paid') await ctx.db.patch(order._id, { status: 'paid' });
    return order._id;
  },
});

export const get = query({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    const poster = await ctx.db.get(order.posterId);
    return { status: order.status, size: order.size, style: poster?.style ?? null };
  },
});
