import { httpRouter } from 'convex/server';
import { unwrapWebhook } from '@whop/sdk/helpers';
import { env, httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { whop } from './whop';

type Money = { amount?: string } | null;

type WhopEvent = {
  type: string;
  data?: {
    id?: string;
    status?: string;
    metadata?: Record<string, unknown> | null;
    checkout_configuration_id?: string | null;
    membership_id?: string | null;
    amount_after_fees?: Money;
    payment_id?: string;
    current_period_end?: string | null;
  };
};

const LIVE_MEMBERSHIP = new Set(['active', 'trialing', 'past_due']);
const FAILED_REFUND = new Set(['failed', 'canceled']);

const str = (value: unknown) => (typeof value === 'string' ? value : undefined);

function cents(money: Money | undefined) {
  const n = Number(money?.amount);
  return money?.amount !== undefined && Number.isFinite(n) ? Math.round(n * 100) : undefined;
}

function time(iso: string | null | undefined) {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : undefined;
}

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

    const data = event.data ?? {};
    const metadata = data.metadata ?? {};

    switch (event.type) {
      case 'payment.succeeded': {
        const whopCheckoutId = data.checkout_configuration_id ?? undefined;
        const whopPaymentId = data.id;
        const userId = str(metadata.userId);
        if (data.membership_id && userId) {
          const membership = await whop().memberships.retrieve({ id: data.membership_id });
          await ctx.runMutation(internal.memberships.sync, {
            whopMembershipId: membership.id,
            userId,
            active: LIVE_MEMBERSHIP.has(membership.status),
            renewsAt: time(membership.current_period_end),
          });
          break;
        }
        const purchase = { whopCheckoutId, whopPaymentId, afterFeesCents: cents(data.amount_after_fees) };
        const purchaseId = str(metadata.purchaseId);
        const paid = purchaseId
          ? await ctx.runMutation(internal.listings.markPaid, { ...purchase, purchaseId })
          : ((await ctx.runMutation(internal.orders.markPaid, { orderId: str(metadata.orderId), whopCheckoutId, whopPaymentId })) ??
            (await ctx.runMutation(internal.listings.markPaid, purchase)));
        if (!paid) console.warn('[whop] payment.succeeded with no matching order or purchase', data.id);
        break;
      }
      case 'membership.activated':
      case 'membership.went_valid':
      case 'membership.updated':
      case 'membership.deactivated':
      case 'membership.went_invalid': {
        if (!data.id) break;
        const active =
          event.type === 'membership.updated'
            ? LIVE_MEMBERSHIP.has(data.status ?? '')
            : event.type === 'membership.activated' || event.type === 'membership.went_valid';
        const synced = await ctx.runMutation(internal.memberships.sync, {
          whopMembershipId: data.id,
          userId: str(metadata.userId),
          active,
          renewsAt: time(data.current_period_end),
        });
        if (!synced) console.warn(`[whop] ${event.type} with no matching user`, data.id);
        break;
      }
      case 'refund.created': {
        if (!data.payment_id || FAILED_REFUND.has(data.status ?? '')) break;
        const refunded =
          (await ctx.runMutation(internal.orders.markRefunded, { whopPaymentId: data.payment_id })) ??
          (await ctx.runMutation(internal.listings.markRefunded, { whopPaymentId: data.payment_id }));
        if (!refunded) console.warn('[whop] refund.created with no matching order or purchase', data.payment_id);
        break;
      }
      default:
        return new Response('Ignored', { status: 200 });
    }
    return new Response('OK', { status: 200 });
  }),
});

export default http;
