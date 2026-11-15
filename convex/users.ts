import { v } from 'convex/values';
import { mutation, type MutationCtx } from './_generated/server';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function newShareCode(ctx: MutationCtx): Promise<string> {
  for (;;) {
    const code = Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
    const taken = await ctx.db
      .query('users')
      .withIndex('by_shareCode', (q) => q.eq('shareCode', code))
      .unique();
    if (!taken) return code;
  }
}

export const ensure = mutation({
  args: { deviceId: v.string(), name: v.string() },
  handler: async (ctx, { deviceId, name }) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_deviceId', (q) => q.eq('deviceId', deviceId))
      .unique();
    if (existing) return { userId: existing._id, name: existing.name, shareCode: existing.shareCode };
    const shareCode = await newShareCode(ctx);
    const userId = await ctx.db.insert('users', { deviceId, name, shareCode });
    return { userId, name, shareCode };
  },
});
