import { v, type Infer } from 'convex/values';
import { action, env, internalMutation, query, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { edition as editionValidator } from './schema';
import { dollars, whop } from './whop';

type Edition = Infer<typeof editionValidator>;

const HOST_SHARE = 0.1;
const RECENT = 12;
const MAX_DROPS = 50;
const MAX_MEMBERS = 1000;
const ALL_PIECES = 6;

type Recent = { who: string; item: string; edition?: Edition; amountCents: number; at: number };

function itemLabel(items: Doc<'orders'>['items']) {
  const pieces = new Set((items ?? []).map((i) => i.piece));
  if (pieces.size === ALL_PIECES) return 'the full drop';
  if (items?.length === 1) return `the ${items[0].piece}`;
  return `${items?.length ?? 0} pieces`;
}

async function hostedDrops(ctx: QueryCtx, userId: Id<'users'>) {
  return await ctx.db
    .query('drops')
    .withIndex('by_hostUserId', (q) => q.eq('hostUserId', userId))
    .order('desc')
    .take(MAX_DROPS);
}

async function ledger(ctx: QueryCtx, userId: Id<'users'>) {
  let gross = 0;
  let orders = 0;
  for await (const drop of ctx.db.query('drops').withIndex('by_hostUserId', (q) => q.eq('hostUserId', userId))) {
    gross += drop.grossCents;
    orders += drop.paidOrders;
  }
  let paidOut = 0;
  let pending: Doc<'payouts'> | null = null;
  for await (const payout of ctx.db.query('payouts').withIndex('by_hostUserId', (q) => q.eq('hostUserId', userId))) {
    if (payout.whopTransferId) paidOut += payout.amountCents;
    else pending = payout;
  }
  return { gross, orders, balance: Math.max(0, Math.round(gross * HOST_SHARE) - paidOut), pending };
}

export const stats = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const drops = await hostedDrops(ctx, userId);
    const { gross, orders, balance } = await ledger(ctx, userId);

    const paid: Doc<'orders'>[] = [];
    for (const drop of drops) {
      const rows = await ctx.db
        .query('orders')
        .withIndex('by_dropId_and_paidAt', (q) => q.eq('dropId', drop._id).gt('paidAt', 0))
        .order('desc')
        .take(RECENT * 2);
      paid.push(...rows.filter((o) => o.status === 'paid' || o.status === 'fulfilled'));
    }
    paid.sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0));
    const recent: Recent[] = [];
    for (const order of paid.slice(0, RECENT)) {
      const buyer = await ctx.db.get(order.userId);
      recent.push({
        who: (buyer?.name ?? 'someone').toLowerCase(),
        item: itemLabel(order.items),
        edition: order.edition,
        amountCents: order.priceCents ?? 0,
        at: order.paidAt ?? order._creationTime,
      });
    }

    const members = await ctx.db
      .query('memberships')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .take(MAX_MEMBERS);

    return {
      grossCents: gross,
      orders,
      members: members.length,
      drop: { editions: (drops[0]?.editions ?? []).map(({ edition, stock, claimed }) => ({ edition, stock, claimed })) },
      feeBalanceCents: balance,
      recent,
    };
  },
});

type StartedPayout = { payoutId: Id<'payouts'>; amountCents: number; destinationId: string; submitted: boolean };

export const startPayout = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }): Promise<StartedPayout | null> => {
    const host = await ctx.db.get(userId);
    if (!host) throw new Error('User not found');
    if (!host.whopUserId) throw new Error('host has no whop account');
    const { balance, pending } = await ledger(ctx, userId);
    const destinationId = host.whopUserId;
    if (pending?.submittedAt) return { payoutId: pending._id, amountCents: pending.amountCents, destinationId, submitted: true };
    if (balance <= 0) {
      if (pending) await ctx.db.delete(pending._id);
      return null;
    }
    if (pending) {
      await ctx.db.patch(pending._id, { amountCents: balance, at: Date.now() });
      return { payoutId: pending._id, amountCents: balance, destinationId, submitted: false };
    }
    const payoutId = await ctx.db.insert('payouts', { hostUserId: userId, amountCents: balance, at: Date.now() });
    return { payoutId, amountCents: balance, destinationId, submitted: false };
  },
});

export const submitPayout = internalMutation({
  args: { payoutId: v.id('payouts') },
  handler: async (ctx, { payoutId }) => {
    await ctx.db.patch(payoutId, { submittedAt: Date.now() });
  },
});

export const settlePayout = internalMutation({
  args: { payoutId: v.id('payouts'), whopTransferId: v.string() },
  handler: async (ctx, { payoutId, whopTransferId }) => {
    await ctx.db.patch(payoutId, { whopTransferId, at: Date.now() });
  },
});

export const payout = action({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }): Promise<{ transferId: string; amountCents: number }> => {
    const companyId = env.WHOP_COMPANY_ID;
    if (!companyId) throw new Error('WHOP_COMPANY_ID is not set');
    const started: StartedPayout | null = await ctx.runMutation(internal.host.startPayout, { userId });
    if (!started) throw new Error('nothing to pay out');
    const { payoutId, amountCents, destinationId, submitted } = started;

    const client = whop();
    if (!submitted) {
      const account = await client.ledgerAccounts.retrieve({ id: companyId });
      const usd = account.balances.find((b) => b.currency === 'usd')?.balance ?? 0;
      if (usd < dollars(amountCents)) throw new Error('balance not settled yet');
      await ctx.runMutation(internal.host.submitPayout, { payoutId });
    }

    const transfer = await client.transfers.create({
      type: 'balance',
      amount: dollars(amountCents),
      currency: 'usd',
      origin_id: companyId,
      destination_id: destinationId,
      idempotence_key: payoutId,
      notes: 'openhouse host fee',
      metadata: { payoutId },
    });
    await ctx.runMutation(internal.host.settlePayout, { payoutId, whopTransferId: transfer.id });
    return { transferId: transfer.id, amountCents };
  },
});
