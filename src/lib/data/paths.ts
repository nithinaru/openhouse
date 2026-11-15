// Every Convex function path the app calls, in one place.
// Source: docs/CAPY.md contract, checked against convex/*.ts after Capy's backend merged.
//
// `deployed: true`  = exists in convex/** and answers on the deployment (signature confirmed).
// `deployed: false` = contract name only; not in convex/** yet, the app falls back silently.
//                     Name or args may change when those threads land: fix them here only.

export type FnKind = 'query' | 'mutation' | 'action';

type FnDef = { path: string; kind: FnKind; deployed: boolean };

export const FN = {
  // Thread 2 (convex/trips.ts, moments.ts, photos.ts, files.ts, users.ts, pairings.ts).
  tripsList: { path: 'trips:list', kind: 'query', deployed: true }, // { userId } -> trip headers (no moments)
  tripsGet: { path: 'trips:get', kind: 'query', deployed: true }, // { id } -> Trip | null
  tripsCreate: { path: 'trips:create', kind: 'mutation', deployed: true }, // { userId, title, startAt, endAt, palette? } -> tripId
  momentsUpsertMany: { path: 'moments:upsertMany', kind: 'mutation', deployed: true }, // { tripId, moments[] } -> momentId[] (input order)
  photosAddMany: { path: 'photos:addMany', kind: 'mutation', deployed: true }, // { photos[] } with thumbStorageId (required)
  filesGenerateUploadUrl: { path: 'files:generateUploadUrl', kind: 'mutation', deployed: true }, // {} -> upload URL
  usersEnsure: { path: 'users:ensure', kind: 'mutation', deployed: true }, // { deviceId, name } -> { userId, name, shareCode }
  pairingsPair: { path: 'pairings:pair', kind: 'mutation', deployed: true }, // { userId, code, lat, lng } -> { pairingId, friendName, shareCode }

  // World Labs Marble worlds (convex/worlds.ts). Demo mode when WORLDLABS_API_KEY is unset.
  worldsBuild: { path: 'worlds:build', kind: 'action', deployed: false }, // { momentId, imageUrls[] } -> { worldId, mode: 'live'|'demo', reused }
  worldsForMoment: { path: 'worlds:forMoment', kind: 'query', deployed: false }, // { momentId } -> { worldId, status, splatUrl?, viewerUrl?, mode, startedAt, expectedMs } | null

  // Not in convex/** yet.
  pairingsForUser: { path: 'pairings:forUser', kind: 'query', deployed: false }, // guessed name, not in CAPY.md
  splatsForMoment: { path: 'splats:forMoment', kind: 'query', deployed: false }, // { momentId }
  splatsBuildForMoment: { path: 'splats:buildForMoment', kind: 'action', deployed: false }, // { momentId }
  ordersCheckout: { path: 'orders:checkout', kind: 'action', deployed: false }, // { userId, tripId, style, size } -> { purchaseUrl, orderId }
  ordersGet: { path: 'orders:get', kind: 'query', deployed: false }, // { orderId } -> { status }
  membershipsCheckout: { path: 'memberships:checkout', kind: 'action', deployed: false },
  meEntitlements: { path: 'me:entitlements', kind: 'query', deployed: false }, // -> { plus }
  askQuestion: { path: 'ask:question', kind: 'action', deployed: false }, // { tripId, question } -> { answer, momentIds }
  memoriesIndexTrip: { path: 'memories:indexTrip', kind: 'action', deployed: false }, // { tripId }

  // Whop commerce (contract in docs/WHOP.md).
  giftsForUser: { path: 'gifts:forUser', kind: 'query', deployed: false }, // { userId } -> Gift[]
  giftsMarkSeen: { path: 'gifts:markSeen', kind: 'mutation', deployed: false }, // { giftId } -> null
  listingsCreate: { path: 'listings:create', kind: 'action', deployed: false }, // { userId, tripId, title, priceCents } -> { listingId, shareUrl }
  listingsForSeller: { path: 'listings:forSeller', kind: 'query', deployed: false }, // { userId } -> SellerListing[]
  listingsGet: { path: 'listings:get', kind: 'query', deployed: false }, // { listingId } -> Listing | null
  listingsCheckout: { path: 'listings:checkout', kind: 'action', deployed: false }, // { listingId, buyerUserId } -> { purchaseUrl, orderId }
  listingsHasAccess: { path: 'listings:hasAccess', kind: 'query', deployed: false }, // { listingId, userId } -> { access, tripId }

  // The drop: limited merch collection per day (contract in docs/WHOP.md, "the drop").
  dropsCreate: { path: 'drops:create', kind: 'action', deployed: false }, // { userId, tripId } -> Drop
  dropsGet: { path: 'drops:get', kind: 'query', deployed: false }, // { dropId } -> Drop | null (live counts)
  dropsCheckout: { path: 'drops:checkout', kind: 'action', deployed: false }, // { dropId, userId, edition, items, promoCode?, referralCode? } -> { purchaseUrl, orderId }

  // Hosts, promo codes, referrals (contract in docs/WHOP.md §6).
  hostStats: { path: 'host:stats', kind: 'query', deployed: false }, // { userId } -> HostStats (polled every 3 s)
  hostPayout: { path: 'host:payout', kind: 'action', deployed: false }, // { userId } -> { transferId, amountCents }
  promosForFriend: { path: 'promos:forFriend', kind: 'action', deployed: false }, // { userId, friendShareCode, dropId } -> { code, percentOff, expiresAt }
  referralsLink: { path: 'referrals:link', kind: 'action', deployed: false }, // { userId, dropId } -> { url, earnedCents, clicks, sales }
} as const satisfies Record<string, FnDef>;

export type FnName = keyof typeof FN;

/** Paths that are contract-only and may be renamed when their backend thread lands. */
export const UNDEPLOYED_PATHS: string[] = Object.values(FN as Record<string, FnDef>)
  .filter((f) => !f.deployed)
  .map((f) => f.path);

// Seeded demo data on the deployment (internal mutation seed:demo, user deviceId "demo-me").
// The app prefers this live trip when the backend is up and falls back to src/lib/demo/demoTrip.ts.
export const DEMO_REMOTE_TRIP_ID = 'js7cwkv07k2jd4by1tgexhpzn18j9xfs';
export const DEMO_REMOTE_USER_ID = 'jx7d6e90rvthgb9wxsgpjhy9198j953v';
