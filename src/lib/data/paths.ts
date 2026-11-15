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

  // Not in convex/** yet.
  pairingsForUser: { path: 'pairings:forUser', kind: 'query', deployed: false }, // guessed name, not in CAPY.md
  splatsForMoment: { path: 'splats:forMoment', kind: 'query', deployed: false }, // { momentId }
  splatsBuildForMoment: { path: 'splats:buildForMoment', kind: 'action', deployed: false }, // { momentId }
  ordersCheckout: { path: 'orders:checkout', kind: 'action', deployed: false }, // { posterId, size? }
  ordersForPoster: { path: 'orders:forPoster', kind: 'query', deployed: false }, // { posterId }
  membershipsCheckout: { path: 'memberships:checkout', kind: 'action', deployed: false },
  meEntitlements: { path: 'me:entitlements', kind: 'query', deployed: false }, // -> { plus }
  askQuestion: { path: 'ask:question', kind: 'action', deployed: false }, // { tripId, question } -> { answer, momentIds }
  memoriesIndexTrip: { path: 'memories:indexTrip', kind: 'action', deployed: false }, // { tripId }
} as const satisfies Record<string, FnDef>;

export type FnName = keyof typeof FN;

/** Paths that are contract-only and may be renamed when their backend thread lands. */
export const UNDEPLOYED_PATHS: string[] = Object.values(FN as Record<string, FnDef>)
  .filter((f) => !f.deployed)
  .map((f) => f.path);

// Seeded demo data on the deployment (internal mutation seed:demo, user deviceId "demo-me").
// The app prefers this live trip when the backend is up and falls back to src/lib/demo/demoTrip.ts.
export const DEMO_REMOTE_TRIP_ID = 'js763zz1855h72srqbj04qnqc98j84y7';
export const DEMO_REMOTE_USER_ID = 'jx7d6e90rvthgb9wxsgpjhy9198j953v';
