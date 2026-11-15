// Whop checkout for a framed print (BUILD.md §5.8).
// Paid state comes only from the Convex order record the /whop webhook writes,
// never from the browser closing.

import { tryCall } from '@/lib/data/convexHttp';
import { ensureRemoteUser } from '@/lib/data/identity';
import { DEMO_REMOTE_TRIP_ID, DEMO_REMOTE_USER_ID } from '@/lib/data/paths';
import { isDemoTripId } from '@/lib/data/trips';

export type CheckoutStart = { url: string; orderId: string };
export type OrderStatus = 'pending' | 'paid';

type CheckoutResponse = {
  purchaseUrl?: string;
  purchase_url?: string;
  url?: string;
  orderId?: string;
} | null;

/**
 * Calls orders:checkout { userId, tripId, style, size }. Convex creates the poster and
 * order records and a Whop sandbox checkout, and returns { purchaseUrl, orderId }.
 * Returns null when the backend can't make one yet.
 */
export async function startCheckout(args: { tripId: string; style: string; size: string }): Promise<CheckoutStart | null> {
  const demo = isDemoTripId(args.tripId);
  let userId = DEMO_REMOTE_USER_ID;
  if (!demo) {
    const me = await ensureRemoteUser().catch(() => undefined);
    if (!me?.userId) return null;
    userId = me.userId;
  }
  const tripId = demo ? DEMO_REMOTE_TRIP_ID : args.tripId;
  const res = await tryCall<CheckoutResponse>('ordersCheckout', { userId, tripId, style: args.style, size: args.size });
  if (!res.ok || !res.value) return null;
  const v = res.value;
  const url = v.purchaseUrl ?? v.purchase_url ?? v.url;
  if (typeof url !== 'string' || !/^https?:\/\//.test(url) || !v.orderId) return null;
  return { url, orderId: v.orderId };
}

/** Reads orders:get { orderId } → { status }. Null when unknown or unreachable. */
export async function getOrderStatus(orderId: string): Promise<OrderStatus | null> {
  const res = await tryCall<{ status?: OrderStatus } | null>('ordersGet', { orderId });
  if (!res.ok || !res.value?.status) return null;
  return res.value.status;
}

/** Polls the order until the webhook marks it paid, or gives up after `timeoutMs`. */
export async function waitForPaid(orderId: string, timeoutMs = 90_000, everyMs = 2000): Promise<boolean> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if ((await getOrderStatus(orderId)) === 'paid') return true;
    await new Promise((r) => setTimeout(r, everyMs));
  }
  return false;
}
