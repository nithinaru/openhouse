// Whop checkout for a framed print (BUILD.md §5.8). Kept for existing imports; the generic
// version for every product lives in src/features/commerce/checkout.ts.
// Paid state comes only from the Convex order record the /whop webhook writes,
// never from the browser closing.

import {
  startCheckout as startProductCheckout,
  type CheckoutStart,
  type PosterStyle,
  type PrintSize,
} from '@/features/commerce/checkout';

export { getOrderStatus, waitForPaid } from '@/features/commerce/checkout';
export type { CheckoutStart };
export type OrderStatus = 'pending' | 'paid';

/**
 * Calls orders:checkout { userId, tripId, style, size } and returns { url, orderId }.
 * Returns null when the backend can't make one yet.
 */
export async function startCheckout(args: { tripId: string; style: string; size: string }): Promise<CheckoutStart | null> {
  const res = await startProductCheckout({
    product: 'print',
    tripId: args.tripId,
    style: args.style as PosterStyle,
    size: args.size as PrintSize,
  });
  return res.ok ? res.value : null;
}
