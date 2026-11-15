import { defineApp } from 'convex/server';
import { v } from 'convex/values';

const app = defineApp({
  env: {
    WHOP_API_KEY: v.optional(v.string()),
    WHOP_ENVIRONMENT: v.optional(v.union(v.literal('sandbox'), v.literal('production'))),
    WHOP_WEBHOOK_SECRET: v.optional(v.string()),
    WHOP_PLUS_PRODUCT_ID: v.optional(v.string()),
  },
});

export default app;
