import { v } from 'convex/values';
import { action, env, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { whop } from './whop';

const COMMISSION_PERCENT = 10;

type LinkView = { url: string; earnedCents: number; clicks: number; sales: number };

type Prepared =
  | { existing: LinkView }
  | { new: { tripId: Id<'trips'>; whopProductId: string; whopUserId: string } };

const linkUrl = (tripId: Id<'trips'>, code: string) => `openhouse://drop/${tripId}?ref=${encodeURIComponent(code)}`;

export const prepare = internalQuery({
  args: { userId: v.id('users'), dropId: v.id('drops') },
  handler: async (ctx, { userId, dropId }): Promise<Prepared> => {
    const drop = await ctx.db.get(dropId);
    if (!drop) throw new Error('Drop not found');
    const existing = await ctx.db
      .query('referrers')
      .withIndex('by_userId_and_dropId', (q) => q.eq('userId', userId).eq('dropId', dropId))
      .unique();
    if (existing) {
      return {
        existing: { url: linkUrl(drop.tripId, existing.code), earnedCents: existing.earnedCents, clicks: 0, sales: existing.sales },
      };
    }
    const user = await ctx.db.get(userId);
    if (!user) throw new Error('User not found');
    if (!user.whopUserId) throw new Error('connect whop first');
    return { new: { tripId: drop.tripId, whopProductId: drop.whopProductId, whopUserId: user.whopUserId } };
  },
});

export const insert = internalMutation({
  args: {
    userId: v.id('users'),
    dropId: v.id('drops'),
    code: v.string(),
    whopAffiliateId: v.string(),
    whopOverrideId: v.string(),
  },
  handler: async (ctx, args): Promise<{ code: string; earnedCents: number; sales: number }> => {
    const existing = await ctx.db
      .query('referrers')
      .withIndex('by_userId_and_dropId', (q) => q.eq('userId', args.userId).eq('dropId', args.dropId))
      .unique();
    if (existing) return existing;
    await ctx.db.insert('referrers', { ...args, sales: 0, earnedCents: 0 });
    return { code: args.code, earnedCents: 0, sales: 0 };
  },
});

export const link = action({
  args: { userId: v.id('users'), dropId: v.id('drops') },
  handler: async (ctx, args): Promise<LinkView> => {
    const prepared: Prepared = await ctx.runQuery(internal.referrals.prepare, args);
    if ('existing' in prepared) return prepared.existing;
    const { tripId, whopProductId, whopUserId } = prepared.new;
    const companyId = env.WHOP_COMPANY_ID;
    if (!companyId) throw new Error('WHOP_COMPANY_ID is not set');

    const client = whop();
    const affiliate = await client.affiliates.create({ account_id: companyId, user_identifier: whopUserId });
    const code = affiliate.user.username;
    if (!code) throw new Error('set a whop username first');
    const override = await client.affiliates.overrides.create({
      id: affiliate.id,
      body: {
        override_type: 'rev_share',
        id: affiliate.id,
        product_id: whopProductId,
        commission_type: 'percentage',
        commission_value: COMMISSION_PERCENT,
      },
    });
    const saved: { code: string; earnedCents: number; sales: number } = await ctx.runMutation(internal.referrals.insert, {
      ...args,
      code,
      whopAffiliateId: affiliate.id,
      whopOverrideId: override.id,
    });
    return { url: linkUrl(tripId, saved.code), earnedCents: saved.earnedCents, clicks: 0, sales: saved.sales };
  },
});
