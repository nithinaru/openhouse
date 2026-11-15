import { v } from 'convex/values';
import { query } from './_generated/server';
import { entitlementsFor } from './memberships';

export const entitlements = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => await entitlementsFor(ctx, userId),
});
