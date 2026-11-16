/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ask from "../ask.js";
import type * as drops from "../drops.js";
import type * as files from "../files.js";
import type * as gifts from "../gifts.js";
import type * as host from "../host.js";
import type * as http from "../http.js";
import type * as listings from "../listings.js";
import type * as me from "../me.js";
import type * as memberships from "../memberships.js";
import type * as memories from "../memories.js";
import type * as moments from "../moments.js";
import type * as orders from "../orders.js";
import type * as pairings from "../pairings.js";
import type * as photos from "../photos.js";
import type * as promos from "../promos.js";
import type * as referrals from "../referrals.js";
import type * as seed from "../seed.js";
import type * as trips from "../trips.js";
import type * as users from "../users.js";
import type * as whop from "../whop.js";
import type * as worlds from "../worlds.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ask: typeof ask;
  drops: typeof drops;
  files: typeof files;
  gifts: typeof gifts;
  host: typeof host;
  http: typeof http;
  listings: typeof listings;
  me: typeof me;
  memberships: typeof memberships;
  memories: typeof memories;
  moments: typeof moments;
  orders: typeof orders;
  pairings: typeof pairings;
  photos: typeof photos;
  promos: typeof promos;
  referrals: typeof referrals;
  seed: typeof seed;
  trips: typeof trips;
  users: typeof users;
  whop: typeof whop;
  worlds: typeof worlds;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
