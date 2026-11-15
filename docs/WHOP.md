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

---

## 5. The drop (limited merch collection per day)

A six-piece merch collection auto-designed from one trip (hoodie, route-map tee, cutout tote,
dad cap, sticker sheet, enamel pin), sold as a limited Whop drop with two editions:
`was_there` (only buyers whose own photos put them within 300 m of the venue) and `public`.
App: `src/app/drop/[id].tsx`, `src/features/drop/*` (prices in `src/features/drop/catalog.ts`).
Until these functions exist the app shows launch numbers (112 of 180 claimed, closes in ~2h 14m)
and checkout reports "coming online".

Whop shape (verify field names on docs.whop.com before shipping): **one product per drop**,
one plan per edition with a limited run (`stock: 180, unlimited_stock: false` for `was_there`,
`stock: 500` for `public`), `plan_type: 'one_time'`. Checkout via
`checkoutConfigurations.create({ plan_id, metadata: { dropOrderId }, ... })` with the cart total
as the price. The organizer fee (10% to the host, e.g. YC) goes out as `application_fee_amount`
on the host's connected company where supported; otherwise record it on the order and pay out
with `client.transfers.create` after the drop closes.

Prices (cents, server is the source of truth; the app shows the same numbers):

| piece | price | sizes |
| --- | --- | --- |
| `hoodie` | 7200 | xs s m l xl xxl |
| `tee` | 3800 | xs s m l xl xxl |
| `tote` | 2800 | — |
| `cap` | 3200 | — |
| `stickers` | 800 | — |
| `pin` | 1400 | — |
| all six (`items` covers every piece once) | 14900 bundle | — |

### `drops:create` (action)

Args `{ userId: Id<'users'>, tripId: Id<'trips'> }`. Idempotent: returns the existing drop for
the trip if there is one, otherwise creates the Whop product + edition plans and a `drops` row.

```ts
{
  dropId: Id<'drops'>,
  title: string,              // "the drop · yc hackathon day"
  closesAt: number,           // ms epoch; default createdAt + 24h, demo trip: end of demo day
  editions: Array<{ edition: 'was_there' | 'public', stock: number, claimed: number }>,
}
```

### `drops:get` (query)

Args `{ dropId: Id<'drops'> }` → same shape as `drops:create`, or `null`. `claimed` is live
(the app polls every 5 s and animates the bar).

### `drops:checkout` (action)

```ts
{
  dropId: Id<'drops'>,
  userId: Id<'users'>,
  edition: 'was_there' | 'public',
  items: Array<{ piece: 'hoodie' | 'tee' | 'tote' | 'cap' | 'stickers' | 'pin', size?: string }>,
}
```

Returns `{ purchaseUrl: string, orderId: Id<'orders'> }`.

- Server re-checks presence for `was_there`: at least one of the user's photos (or a moment
  when photos have no GPS) within 300 m of the drop's venue. The demo trip always qualifies.
  Throw `"not at the venue"` otherwise; never trust the client.
- Throw `"sold out"` when `claimed >= stock` for that edition, `"closed"` after `closesAt`.
- `size` is required for `hoodie` and `tee` (`xs`–`xxl`), ignored otherwise.
- Insert an `orders` row `{ product: 'drop', dropId, edition, items, priceCents, status: 'pending' }`
  and put `{ orderId }` in Whop `metadata`.

Paid state: the app polls the existing **`orders:get { orderId }`** until `status` is `paid` /
`fulfilled` (same `waitForOrder` path as prints). `orders:get` may return `product: 'drop'`;
the app only reads `status`.

### Webhook `/whop`

`payment.succeeded` for a drop order → `orders.markPaid` and, in the same mutation,
`drops.editions[edition].claimed += 1` (once per order, not per item, so "112 of 180" counts
people). `refund.created` → decrement it again.

Schema needs (Capy owns schema): table `drops` `{ tripId, userId, title, venue: { name, address,
lat, lng }, closesAt, whopProductId, editions: [{ edition, stock, claimed, whopPlanId }] }`,
index `by_tripId`; `orders` gains `dropId?`, `edition?`, `items?`, `product` gains `'drop'`.

| path | kind | status |
| --- | --- | --- |
| `drops:create` | action | new |
| `drops:get` | query | new |
| `drops:checkout` | action | new |

---

## 6. Hosts, promo codes, referrals

App: `src/app/host/index.tsx`, `src/features/host/*`, `src/features/drop/promo.ts`,
`src/features/drop/PromoParts.tsx`. Paths in `src/lib/data/paths.ts` (`hostStats`, `hostPayout`,
`promosForFriend`, `referralsLink`). Until these are deployed the app shows preview values
(labeled "preview") and never pretends money moved.

Every Whop call named below was checked against the installed `@whop/sdk` types
(`node_modules/@whop/sdk/dist/cjs/api/resources/*`): `payments` (`list`, `summary`, `retrieve`),
`memberships` (`list`, `applyPromoCode`, `assignAffiliate`), `plans` (`retrieve`, fields
`stock`, `unlimited_stock`, `member_count`), `promoCodes` (`create`, `list`, `retrieve`,
`deactivate`), `affiliates` (`create`, `retrieve`, sub-resource `affiliates.overrides.create`),
`transfers` (`create`, `list`, `retrieve`), `ledgerAccounts` (`retrieve`, `balances[]`),
`checkoutConfigurations` (`create`, fields `affiliate_code`, `variant.application_fee_amount`).

### `host:stats` (query)

Args `{ userId: Id<'users'> }` (the organizer; the demo uses the seeded demo user). Returns:

```ts
{
  grossCents: number,          // sum of paid drop orders for drops this user hosts
  orders: number,              // count of those orders
  members: number,             // active Openhouse+ memberships (memberships table)
  drop: { editions: Array<{ edition: 'was_there' | 'public', stock: number, claimed: number }> },
  feeBalanceCents: number,     // 10% of grossCents minus everything already paid out
  recent: Array<{
    who: string,               // buyer users.name, lowercase is fine
    item: string,              // "the hoodie", "the full drop"
    edition?: 'was_there' | 'public',
    amountCents: number,
    at: number,                // ms epoch the payment succeeded
  }>,                          // newest first, at most 12
}
```

The app polls this every 3 s, so compute it from Convex rows written by the `/whop` webhook
(`payment.succeeded` already marks drop orders paid and bumps `claimed`), not by calling Whop
per poll. Whop sources: `payments` (webhook `payment.succeeded`; reconcile with
`client.payments.list({ product_id, statuses: ['paid'] })` or `client.payments.summary`),
`memberships` (`membership.activated` webhook; reconcile with
`client.memberships.list({ product_id: WHOP_PLUS_PRODUCT_ID, statuses: ['active'] })`),
`plans` (one plan per edition with `stock` and `unlimited_stock: false`; `claimed` is ours,
`client.plans.retrieve({ id }).stock` is the remaining Whop stock).

Schema needs (Capy owns schema): `drops.hostUserId` (default the creator), `orders.paidAt`,
`orders.priceCents` on drop orders, table `payouts { hostUserId, amountCents, whopTransferId, at }`.

### `host:payout` (action)

Args `{ userId: Id<'users'> }` → `{ transferId: string, amountCents: number }`.

Pays the host's whole `feeBalanceCents` with
`client.transfers.create({ amount: dollars(amountCents), currency: 'usd', origin_id: <our company ledger / company id>, destination_id: <host's company or user id>, idempotence_key: <payout row id>, notes: 'openhouse host fee', metadata: { payoutId } })`.
Insert the `payouts` row first (idempotence key), then patch `whopTransferId`. Throw
`"nothing to pay out"` when the balance is 0. Optionally read
`client.ledgerAccounts.retrieve({ id })` first and throw `"balance not settled yet"` when
`balances[].balance` (usd) is below the amount. Where connected companies work in sandbox, prefer
`variant.application_fee_amount` on each drop checkout so the fee never needs a transfer; then
`host:payout` only reports what already went out.

### `promos:forFriend` (action)

Args `{ userId: Id<'users'>, friendShareCode: string, dropId: Id<'drops'> }` →
`{ code: string, percentOff: number, expiresAt: number }`.

- `userId` is the person who was there; `friendShareCode` is the `users.shareCode` of someone
  they paired with. Throw `"not paired"` unless a `pairings` row links the two users.
- Idempotent per `(dropId, friendUserId)`: return the existing code.
- `code` = friend's name uppercased, letters/digits only, max 12 chars, plus `-WASTHERE`
  (`ROHAN-WASTHERE`); add a digit on collision. `percentOff: 20`. `expiresAt` = `drops.closesAt`.
- Whop: `client.promoCodes.create({ account_id: <our company>, code, promo_type: 'percentage', amount_off: 20, base_currency: 'usd', new_users_only: false, one_per_customer: true, promo_duration_months: 1, stock: 1, unlimited_stock: false, expires_at: <ISO>, product_id: drops.whopProductId })`.
  Save `{ dropId, friendUserId, issuerUserId, code, whopPromoCodeId }` in table `promos`
  (index `by_code`, `by_dropId_and_friendUserId`).

### `drops:checkout` — new optional args

```ts
{ ...existing, promoCode?: string, referralCode?: string }
```

- `promoCode`: look it up in `promos` (`by_code`), check the drop matches and it isn't expired
  or used, and charge the discounted total. The installed SDK's
  `checkoutConfigurations.create` has **no promo code field**, so apply the discount to
  `variant.initial_price` and store `promoId` on the order; mark it used in the webhook. The same
  code also exists as a Whop `promoCodes` object, so it works if typed on Whop's hosted checkout,
  and `client.memberships.applyPromoCode` is there for renewals. Throw `"code not valid"`
  otherwise. The app sends it only after the user applies a code and shows "applied".
- `referralCode`: pass as `affiliate_code` to `checkoutConfigurations.create` (field exists in the
  SDK) and store `referrerUserId` on the order. Comes from the `?ref=` param of a drop link.

### `referrals:link` (action)

Args `{ userId: Id<'users'>, dropId: Id<'drops'> }` →
`{ url: string, earnedCents: number, clicks: number, sales: number }`.

- First call per user: `client.affiliates.create({ account_id: <our company>, user_identifier: <user's whop id or email> })`,
  then `client.affiliates.overrides.create({ id: affiliateId, body: { override_type: 'rev_share', id: affiliateId, product_id: drops.whopProductId, commission_type: 'percentage', commission_value: 10 } })`.
  Save `{ userId, whopAffiliateId, code }` in table `referrers`.
- `url` = `openhouse://drop/<tripId>?ref=<code>` (or an https page that redirects there).
- `sales` / `earnedCents` from paid orders with `referrerUserId` (10% of each); `clicks` is
  optional (0 is fine). `client.affiliates.retrieve({ id })` gives `total_referrals_count` and
  `total_referral_earnings_usd` to reconcile. The app polls every 5 s.

| path | kind | status |
| --- | --- | --- |
| `host:stats` | query | new |
| `host:payout` | action | new |
| `promos:forFriend` | action | new |
| `referrals:link` | action | new |
| `drops:checkout` | action | new optional `promoCode`, `referralCode` |
