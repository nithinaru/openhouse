// Whop checkout for a framed print (BUILD.md §5.8).
//
// TODO(convex): replace the body with the Convex action once it exists:
//   const checkout = useAction(api.orders.checkout);
//   const { purchase_url } = await checkout({ posterId });
//   return purchase_url ?? null;
// Unlock/confirm from the Convex order record (orders.forPoster), never on browser close.

export async function startCheckout(posterId: string): Promise<string | null> {
  console.log('[checkout] startCheckout stub', posterId);
  return null;
}
