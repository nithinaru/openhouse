import { v } from 'convex/values';
import { action, env, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { whop } from './whop';

const PERCENT_OFF = 20;
const SUFFIX = '-WASTHERE';
const BASE_LEN = 12;

type PromoView = { code: string; percentOff: number; expiresAt: number };

type Prepared =
  | { existing: PromoView }
  | { new: { friendUserId: Id<'users'>; code: string; expiresAt: number; whopProductId: string } };

export const prepare = internalQuery({
  args: { userId: v.id('users'), friendShareCode: v.string(), dropId: v.id('drops') },
  handler: async (ctx, { userId, friendShareCode, dropId }): Promise<Prepared> => {
    const drop = await ctx.db.get(dropId);
    if (!drop) throw new Error('Drop not found');
    const friend = await ctx.db
      .query('users')
      .withIndex('by_shareCode', (q) => q.eq('shareCode', friendShareCode.trim().toUpperCase()))
      .unique();
    if (!friend || friend._id === userId) throw new Error('not paired');

    const pairedAsA = await ctx.db
      .query('pairings')
      .withIndex('by_userA', (q) => q.eq('userA', userId))
      .filter((q) => q.eq(q.field('userB'), friend._id))
      .first();
    const paired =
      pairedAsA ??
      (await ctx.db
        .query('pairings')
        .withIndex('by_userB', (q) => q.eq('userB', userId))
        .filter((q) => q.eq(q.field('userA'), friend._id))
        .first());
    if (!paired) throw new Error('not paired');

    const existing = await ctx.db
      .query('promos')
      .withIndex('by_dropId_and_friendUserId', (q) => q.eq('dropId', dropId).eq('friendUserId', friend._id))
      .first();
    if (existing) return { existing: { code: existing.code, percentOff: PERCENT_OFF, expiresAt: drop.closesAt } };
    if (Date.now() >= drop.closesAt) throw new Error('closed');

    const base =
      friend.name
        .normalize('NFKD')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase()
        .slice(0, BASE_LEN) || 'FRIEND';
    for (let n = 1; ; n++) {
      const tag = n === 1 ? '' : String(n);
      const code = `${base.slice(0, BASE_LEN - tag.length)}${tag}${SUFFIX}`;
      const taken = await ctx.db
        .query('promos')
        .withIndex('by_code', (q) => q.eq('code', code))
        .first();
      if (!taken) {
        return { new: { friendUserId: friend._id, code, expiresAt: drop.closesAt, whopProductId: drop.whopProductId } };
      }
    }
  },
});

export const insert = internalMutation({
  args: {
    dropId: v.id('drops'),
    friendUserId: v.id('users'),
    issuerUserId: v.id('users'),
    code: v.string(),
    whopPromoCodeId: v.string(),
  },
  handler: async (ctx, args): Promise<{ code: string; inserted: boolean }> => {
    const existing = await ctx.db
      .query('promos')
      .withIndex('by_dropId_and_friendUserId', (q) => q.eq('dropId', args.dropId).eq('friendUserId', args.friendUserId))
      .first();
    if (existing) return { code: existing.code, inserted: false };
    const taken = await ctx.db
      .query('promos')
      .withIndex('by_code', (q) => q.eq('code', args.code))
      .first();
    if (taken) throw new Error(`Promo code ${args.code} was just taken, try again`);
    await ctx.db.insert('promos', args);
    return { code: args.code, inserted: true };
  },
});

export const forFriend = action({
  args: { userId: v.id('users'), friendShareCode: v.string(), dropId: v.id('drops') },
  handler: async (ctx, args): Promise<PromoView> => {
    const prepared: Prepared = await ctx.runQuery(internal.promos.prepare, args);
    if ('existing' in prepared) return prepared.existing;
    const { friendUserId, code, expiresAt, whopProductId } = prepared.new;
    const companyId = env.WHOP_COMPANY_ID;
    if (!companyId) throw new Error('WHOP_COMPANY_ID is not set');

    const client = whop();
    const promo = await client.promoCodes.create({
      account_id: companyId,
      code,
      promo_type: 'percentage',
      amount_off: PERCENT_OFF,
      base_currency: 'usd',
      new_users_only: false,
      one_per_customer: true,
      promo_duration_months: 1,
      stock: 1,
      unlimited_stock: false,
      expires_at: new Date(expiresAt).toISOString(),
      product_id: whopProductId,
    });
    const saved: { code: string; inserted: boolean } = await ctx.runMutation(internal.promos.insert, {
      dropId: args.dropId,
      friendUserId,
      issuerUserId: args.userId,
      code,
      whopPromoCodeId: promo.id,
    });
    if (!saved.inserted) await client.promoCodes.deactivate({ id: promo.id });
    return { code: saved.code, percentOff: PERCENT_OFF, expiresAt };
  },
});
