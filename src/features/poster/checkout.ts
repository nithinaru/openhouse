// Whop checkout for a framed print (BUILD.md §5.8).
// Unlock/confirm from the Convex order record (orders.forPoster), never on browser close.

import { tryCall } from '@/lib/data/convexHttp';

type CheckoutResponse = string | { purchase_url?: string; purchaseUrl?: string; url?: string } | null;

/** Calls orders:checkout. Returns the Whop purchase URL, or null when the backend can't make one. */
export async function startCheckout(posterId: string, size?: string): Promise<string | null> {
  const res = await tryCall<CheckoutResponse>('ordersCheckout', size ? { posterId, size } : { posterId });
  if (!res.ok || !res.value) return null;
  const v = res.value;
  const url = typeof v === 'string' ? v : (v.purchase_url ?? v.purchaseUrl ?? v.url);
  return typeof url === 'string' && /^https?:\/\//.test(url) ? url : null;
}
