import { v } from 'convex/values';
import { action, env, internalMutation, internalQuery, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { dollars, purchaseUrlOf, whop } from './whop';

const PLUS_PRICE_CENTS = 500;

export async function entitlementsFor(ctx: QueryCtx, userId: Id<'users'>) {
  const rows = await ctx.db
    .query('memberships')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .take(20);
  const active = rows.filter((m) => m.status === 'active');
  const renewals = active.map((m) => m.renewsAt).filter((t): t is number => t !== undefined);
  return { plus: active.length > 0, renewsAt: renewals.length ? Math.max(...renewals) : null };
}

export async function hasPlus(ctx: QueryCtx, userId: Id<'users'>) {
  return (await entitlementsFor(ctx, userId)).plus;
}

export const checkout = action({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }): Promise<{ purchaseUrl: string; checkoutId: string }> => {
    const state: { exists: boolean; plus: boolean } = await ctx.runQuery(internal.memberships.userState, { userId });
    if (!state.exists) throw new Error('User not found');
    if (state.plus) throw new Error('You already have Openhouse+');
    const config = await whop().checkoutConfigurations.create({
      mode: 'payment',
      metadata: { userId },
      variant: {
        title: 'Wish You Were Here Plus',
        product_id: env.WHOP_PLUS_PRODUCT_ID,
        billing_type: 'renewal',
        billing_period: 30,
        currency: 'usd',
        renewal_price: dollars(PLUS_PRICE_CENTS),
      },
    });
    return { purchaseUrl: purchaseUrlOf(config), checkoutId: config.id };
  },
});

export const userState = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => ({
    exists: (await ctx.db.get(userId)) !== null,
    plus: await hasPlus(ctx, userId),
  }),
});

export const sync = internalMutation({
  args: {
    whopMembershipId: v.string(),
    userId: v.optional(v.string()),
    active: v.boolean(),
    renewsAt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<'memberships'> | null> => {
    const status = args.active ? 'active' : 'inactive';
    const existing = await ctx.db
      .query('memberships')
      .withIndex('by_whopMembershipId', (q) => q.eq('whopMembershipId', args.whopMembershipId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { status, renewsAt: args.renewsAt ?? existing.renewsAt });
      return existing._id;
    }
    const userId = args.userId ? ctx.db.normalizeId('users', args.userId) : null;
    if (!userId || !(await ctx.db.get(userId))) return null;
    return await ctx.db.insert('memberships', {
      userId,
      whopMembershipId: args.whopMembershipId,
      status,
      renewsAt: args.renewsAt,
    });
  },
});
