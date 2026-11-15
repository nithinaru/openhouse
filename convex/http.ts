import { httpRouter } from 'convex/server';
import { unwrapWebhook } from '@whop/sdk/helpers';
import { env, httpAction } from './_generated/server';
import { internal } from './_generated/api';

type WhopEvent = {
  type: string;
  data?: { id?: string; metadata?: Record<string, unknown> | null; checkout_configuration_id?: string | null };
};

const http = httpRouter();

http.route({
  path: '/whop',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const key = env.WHOP_WEBHOOK_SECRET;
    if (!key) return new Response('WHOP_WEBHOOK_SECRET is not set', { status: 500 });

    let event: WhopEvent;
    try {
      event = unwrapWebhook<WhopEvent>(await req.text(), { headers: Object.fromEntries(req.headers), key });
    } catch {
      return new Response('Invalid signature', { status: 401 });
    }

    if (event.type !== 'payment.succeeded') return new Response('Ignored', { status: 200 });

    const metadataOrderId = event.data?.metadata?.orderId;
    const orderId = await ctx.runMutation(internal.orders.markPaid, {
      orderId: typeof metadataOrderId === 'string' ? metadataOrderId : undefined,
      whopCheckoutId: event.data?.checkout_configuration_id ?? undefined,
    });
    if (!orderId) console.warn('[whop] payment.succeeded with no matching order', event.data?.id);
    return new Response('OK', { status: 200 });
  }),
});

export default http;
