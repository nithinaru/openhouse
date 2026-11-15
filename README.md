# Openhouse

Your camera roll already remembers the day: where you stood, which way you faced, who was there. Openhouse plays it back as a narrated, walk-through replay you never had to journal, and lets you frame it.

Built at the YC Consumer Mobile Hackathon with Capy, Convex and Revyl. Expo SDK 58, Expo Router, TypeScript.

- Brief: [docs/BUILD.md](docs/BUILD.md)
- Capy context and thread prompts: [docs/CAPY.md](docs/CAPY.md)

```bash
npm install
npx expo start
```

## How Openhouse uses Whop

Every way Openhouse makes money runs through Whop. Convex calls the Whop SDK server side, the `/whop` webhook (`convex/http.ts`) is the only thing that marks anything paid, and the app polls Convex for the result. The full contract is in [docs/WHOP.md](docs/WHOP.md).

| Feature | Whop object / API | Where in the code |
| --- | --- | --- |
| Prints, postcards, zine, film | `checkoutConfigurations.create` (one-time variant), webhook `payment.succeeded`, `refund.created` | `convex/orders.ts`, `convex/http.ts`, `src/features/commerce/checkout.ts`, `src/app/shop/[id].tsx` |
| Gifts to a friend | same checkout with `metadata.orderId`; gift row written in the paid webhook | `convex/orders.ts`, `convex/gifts.ts`, `src/features/commerce/gifts.ts` |
| Openhouse+ ($5/mo) | renewal variant on the Openhouse+ product, `memberships.retrieve`, webhooks `membership.activated` / `deactivated` | `convex/memberships.ts`, `src/features/commerce/membership.ts`, `src/app/plus.tsx` |
| Sell this day (paid guides) | `products.create`, `variants.create`, `checkoutConfigurations.create({ variant_id })` | `convex/listings.ts`, `src/features/commerce/listings.ts`, `src/app/sell/[id].tsx`, `src/app/listing/[id].tsx` |
| The drop (limited merch) | one product per drop, one plan per edition with `stock` / `unlimited_stock: false` | `src/features/drop/api.ts`, `src/app/drop/[id].tsx` (backend: `drops:*`) |
| "was there" codes (20% off) | `promoCodes.create` (percentage, one per customer, scoped to the drop product) | `src/features/drop/promo.ts`, `src/features/drop/PromoParts.tsx`, `src/features/people/PairCelebration.tsx` |
| Referral cut (10%) | `affiliates.create`, `affiliates.overrides.create` (rev share), `affiliate_code` on checkout | `src/features/drop/promo.ts`, `src/features/drop/PromoParts.tsx` |
| Host dashboard | `payments` (revenue, orders, live feed), `memberships` (members), `plans` (sell-through) | `src/app/host/index.tsx`, `src/features/host/*` (backend: `host:stats`) |
| Host fee payout | `transfers.create`, `ledgerAccounts.retrieve` for the balance | `src/features/host/api.ts` (backend: `host:payout`) |

Openhouse has no payments code of its own. Whop holds the catalog (products, plans, stock), takes the money, runs subscriptions, issues discount codes, tracks affiliates, and moves the host's share out with transfers. Convex keeps only the ids and the state the app needs to render, and it learns about money from Whop's webhooks. That is what we mean by Whop as the business backend: a host like YC gets a store, a membership, promo codes, a referral program and payouts from one API, and Openhouse is the app on top.
