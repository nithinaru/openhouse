# Whop commerce contract (for Capy)

The app is already calling everything below (`src/features/commerce/*`, paths in
`src/lib/data/paths.ts`). Until a function is deployed the app shows a "coming online" state, so
names, args and return shapes here are the contract: keep them exact. If you must change one,
change it here and in `src/lib/data/paths.ts` in the same PR.

Rules that carry over from Thread 6:

- `@whop/sdk` server side only, `WHOP_API_KEY`, `WHOP_ENVIRONMENT=sandbox` (without it the SDK
  calls production). Test card 4242 4242 4242 4242.
- **Paid state only ever comes from Convex.** The app opens `purchaseUrl` in an in-app browser,
  then polls a Convex query. It never treats the browser closing as success. The `/whop` webhook
  is the only writer of paid / plus / access.
- Every checkout puts our own row id in Whop `metadata` so the webhook can find it, and also
  saves the Whop checkout configuration id on the row as a fallback lookup.
- Money is integer cents everywhere in our API (`priceCents`, `earningsCents`). Whop's
  `initial_price` is dollars, so divide by 100 only at the Whop call.
- All `userId` args are `Id<'users'>` from `users:ensure`. The demo trip uses the seeded demo
  user (`DEMO_REMOTE_USER_ID` in paths.ts).

Whop API objects used (check docs.whop.com for exact field names before shipping):

| Need | Whop object / call |
| --- | --- |
| one-time purchase (prints, postcards, zine, film, guides) | `client.checkoutConfigurations.create({ mode: 'payment', metadata, plan: { initial_price, currency: 'usd', plan_type: 'one_time' } })` (the existing `orders.checkout` uses this shape with `variant`; keep whichever the SDK accepts) → `purchase_url` |
| $5/mo membership | a product "Openhouse+" with a renewal plan (`plan_type: 'renewal'`, `renewal_price: 5`, `billing_period: 30`), checkout via `checkoutConfigurations.create({ plan_id, metadata })` |
| knowing a member is active | webhook `membership.activated` / `membership.deactivated` (older apps: `membership.went_valid` / `membership.went_invalid`), plus `client.memberships.retrieve(id)` when in doubt |
| one-time payment landed | webhook `payment.succeeded` (already handled for prints) |
| refunds | webhook `refund.created` → set the row back to `refunded`, revoke access |
| seller payouts for guides | Whop for Platforms: a connected company per seller (`client.companies.create`), checkout on the seller's company with `application_fee_amount` (our 10% cut). If connected accounts are not ready in sandbox, collect on our company, record earnings in Convex, and pay out later with `client.transfers.create` |

---

## 1. Shop: orders for every product

### `orders:checkout` (action) — extend the existing one

Args (all new fields optional so today's print call keeps working):

```ts
{
  userId: Id<'users'>,
  tripId: Id<'trips'>,
  product?: 'print' | 'postcards' | 'zine' | 'film',   // default 'print'
  variant?: string,              // print: '12x16' | '18x24'; zine: 'digital' | 'printed'; others: omit
  style?: 'minimal' | 'night' | 'field',   // print only (required for print, as today)
  size?: '12x16' | '18x24',                // print only (required for print, as today)
  momentId?: Id<'moments'>,      // a single-stop item (gift of "lunch on 3rd st")
  giftToShareCode?: string,      // 6-char users.shareCode of the friend receiving it
}
```

Returns `{ purchaseUrl: string, orderId: Id<'orders'> }`.

Prices (cents, server is the source of truth, the app shows the same numbers):

| product | variant | price | fulfilment |
| --- | --- | --- | --- |
| print | 12x16 / 18x24 | 3900 / 5900 | ships in 3–5 days |
| postcards | — | 1800 | pack of one card per stop (max 8), ships in 4–6 days |
| zine | digital / printed | 1200 / 2900 | digital: PDF download; printed: ships in 5–7 days |
| film | — | 600 | narrated MP4 download |

Gift: when `giftToShareCode` is set, look up the user by `by_shareCode`, throw if missing, and
store `giftToUserId` on the order. Whop checkout title e.g. "Postcard pack (gift for Rohan)".

Schema needs (Capy owns schema): `orders` gets `product`, `variant?`, `tripId`, `momentId?`,
`giftToUserId?`, `downloadStorageId?`, `status` gains `'fulfilled' | 'refunded'`; `posterId`
becomes optional (only prints have one).

### `orders:get` (query) — extend

Args `{ orderId: Id<'orders'> }`. Returns `null` or:

```ts
{
  status: 'pending' | 'paid' | 'fulfilled' | 'refunded',
  product: 'print' | 'postcards' | 'zine' | 'film',
  variant: string | null,
  style: string | null,
  size: string | null,
  shipsInDays: [number, number] | null,   // e.g. [3, 5] for physical goods
  downloadUrl: string | null,             // digital goods, once rendered (storage URL)
  giftTo: { name: string } | null,
}
```

Digital goods: on `payment.succeeded`, schedule the render (zine PDF / film MP4), save the file to
storage, set `downloadStorageId`, then `status: 'fulfilled'`. Until the file exists return
`downloadUrl: null`; the app keeps showing "rendering your film" and polls.

### Webhook `/whop`

`payment.succeeded` → `orders.markPaid` (as today) for any product. If the order has
`giftToUserId`, insert a `gifts` row (below) in the same mutation.

---

## 2. Gifts

### `gifts:forUser` (query)

Args `{ userId: Id<'users'> }`. Returns newest first, only paid gifts:

```ts
Array<{
  giftId: Id<'gifts'>,
  orderId: Id<'orders'>,
  fromName: string,           // sender's users.name
  product: 'print' | 'postcards' | 'zine' | 'film',
  variant: string | null,
  tripTitle: string,
  placeName: string | null,   // the gifted stop's placeName when momentId was set
  previewUrl: string | null,  // hero photo thumb of that stop (or the trip)
  downloadUrl: string | null, // digital goods, once fulfilled
  shipsInDays: [number, number] | null,
  createdAt: number,
  seen: boolean,
}>
```

The app polls this every 5 s on Home and shows "nithin sent you a print of lunch on 3rd st".

### `gifts:markSeen` (mutation)

Args `{ giftId: Id<'gifts'> }` → `null`. Called when the banner is opened or dismissed.

Table `gifts`: `{ orderId, fromUserId, toUserId, momentId?, seen: boolean }`, index `by_toUserId`.

---

## 3. Openhouse+ membership ($5/mo)

### `memberships:checkout` (action)

Args `{ userId: Id<'users'> }` → `{ purchaseUrl: string, checkoutId: string }`.
Create the checkout for the Openhouse+ renewal plan with `metadata: { userId }`.

### `me:entitlements` (query)

Args `{ userId: Id<'users'> }` → `{ plus: boolean, renewsAt: number | null }`.

Plus unlocks every poster style (`night`, `field`), unlimited Walk in, and a monthly
"month in review" film. The app polls this until `plus` is true after checkout.

### Webhook `/whop`

- `membership.activated` (or `went_valid`): find user by `metadata.userId`, upsert a
  `memberships` row `{ userId, whopMembershipId, status: 'active', renewsAt }`.
- `membership.deactivated` (or `went_invalid`): set `status: 'inactive'`.
- `payment.succeeded` for a membership renewal: bump `renewsAt`.

Server-side gates (please enforce, the app also soft-locks): `orders:checkout` with
`style: 'night' | 'field'` requires plus; `splats:buildForMoment` beyond the first world per
trip requires plus.

---

## 4. Sell this day (paid walkable guides)

### `listings:create` (action)

Args `{ userId: Id<'users'>, tripId: Id<'trips'>, title: string, priceCents: number }`
(`priceCents` integer 100–1000). Returns `{ listingId: Id<'listings'>, shareUrl: string }`.

Creates the Whop product/plan for the guide (on the seller's connected company if available)
and a `listings` row `{ userId, tripId, title, priceCents, whopPlanId, sales: 0, earningsCents: 0 }`.
`shareUrl` must open the app: `openhouse://listing/<listingId>` (or an https page that redirects
there).

### `listings:forSeller` (query)

Args `{ userId: Id<'users'> }` → newest first:

```ts
Array<{ listingId: Id<'listings'>, title: string, priceCents: number, sales: number,
        earningsCents: number, shareUrl: string, tripId: Id<'trips'> }>
```

`earningsCents` is the seller's net (price minus our 10% fee and Whop fees if known). The app
polls this every 3 s and animates the numbers, so update it inside the webhook mutation.

### `listings:get` (query)

Args `{ listingId: Id<'listings'> }` → `null` or

```ts
{ listingId, title, priceCents, sellerName: string, tripId: Id<'trips'>, stops: number,
  previewUrls: string[] /* up to 4 hero thumbs */ }
```

### `listings:checkout` (action)

Args `{ listingId: Id<'listings'>, buyerUserId: Id<'users'> }` → `{ purchaseUrl: string, orderId: string }`.
Insert a `purchases` row `{ listingId, buyerUserId, status: 'pending' }`, metadata `{ purchaseId }`.

### `listings:hasAccess` (query)

Args `{ listingId: Id<'listings'>, userId: Id<'users'> }` → `{ access: boolean, tripId: Id<'trips'> | null }`.
True for the seller and for buyers with a paid purchase. `tripId` only when `access` is true; the
app then opens that trip's Replay. `trips:get` should allow reading a trip the caller has access to.

### Webhook `/whop`

`payment.succeeded` with `metadata.purchaseId` → mark the purchase paid, `listings.sales += 1`,
`listings.earningsCents += net`.

---

## Function index (mirrors `src/lib/data/paths.ts`)

| path | kind | status |
| --- | --- | --- |
| `orders:checkout` | action | live (print only); extend with `product`, `variant`, `momentId`, `giftToShareCode` |
| `orders:get` | query | live; extend return shape |
| `gifts:forUser` | query | new |
| `gifts:markSeen` | mutation | new |
| `memberships:checkout` | action | new |
| `me:entitlements` | query | new |
| `listings:create` | action | new |
| `listings:forSeller` | query | new |
| `listings:get` | query | new |
| `listings:checkout` | action | new |
| `listings:hasAccess` | query | new |

Webhook events on `/whop`: `payment.succeeded`, `membership.activated`, `membership.deactivated`,
`refund.created`.
