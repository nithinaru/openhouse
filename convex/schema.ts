import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const lens = v.union(v.literal('front'), v.literal('wide'), v.literal('ultrawide'), v.literal('tele'));
export const weather = v.object({ tempF: v.number(), summary: v.string() });
export const posterStyle = v.union(v.literal('minimal'), v.literal('night'), v.literal('field'));
export const printSize = v.union(v.literal('12x16'), v.literal('18x24'));
export const product = v.union(v.literal('print'), v.literal('postcards'), v.literal('zine'), v.literal('film'));

export default defineSchema({
  users: defineTable({
    deviceId: v.string(),
    name: v.string(),
    avatarStorageId: v.optional(v.id('_storage')),
    shareCode: v.string(),
  })
    .index('by_deviceId', ['deviceId'])
    .index('by_shareCode', ['shareCode']),

  trips: defineTable({
    userId: v.id('users'),
    title: v.string(),
    startAt: v.number(),
    endAt: v.number(),
    palette: v.array(v.string()),
    story: v.optional(v.string()),
    narrationStorageId: v.optional(v.id('_storage')),
    narrationCues: v.optional(v.array(v.object({ momentId: v.id('moments'), atMs: v.number() }))),
    status: v.union(v.literal('ingesting'), v.literal('enriching'), v.literal('ready')),
  }).index('by_userId', ['userId', 'startAt']),

  moments: defineTable({
    tripId: v.id('trips'),
    userId: v.id('users'),
    startAt: v.number(),
    endAt: v.number(),
    lat: v.number(),
    lng: v.number(),
    placeName: v.optional(v.string()),
    headingDeg: v.optional(v.number()),
    altitudeM: v.optional(v.number()),
    avgIso: v.optional(v.number()),
    isGoldenHour: v.optional(v.boolean()),
    weather: v.optional(weather),
    fact: v.optional(v.string()),
    caption: v.optional(v.string()),
    sceneTags: v.optional(v.array(v.string())),
    narration: v.optional(v.string()),
    heroPhotoId: v.optional(v.id('photos')),
    ambientVideoStorageId: v.optional(v.id('_storage')),
    order: v.number(),
  })
    .index('by_tripId', ['tripId', 'order'])
    .index('by_userId', ['userId', 'startAt']),

  photos: defineTable({
    momentId: v.id('moments'),
    userId: v.id('users'),
    takenAt: v.number(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    headingDeg: v.optional(v.number()),
    altitudeM: v.optional(v.number()),
    lens: v.optional(lens),
    subtypes: v.array(v.string()),
    isFavorite: v.boolean(),
    thumbStorageId: v.optional(v.id('_storage')),
    thumbUrl: v.optional(v.string()),
    w: v.number(),
    h: v.number(),
  })
    .index('by_momentId', ['momentId', 'takenAt'])
    .index('by_userId', ['userId', 'takenAt']),

  pairings: defineTable({
    userA: v.id('users'),
    userB: v.id('users'),
    at: v.number(),
    lat: v.number(),
    lng: v.number(),
    momentA: v.optional(v.id('moments')),
    momentB: v.optional(v.id('moments')),
  })
    .index('by_userA', ['userA', 'at'])
    .index('by_userB', ['userB', 'at'])
    .index('by_momentA', ['momentA'])
    .index('by_momentB', ['momentB']),

  worlds: defineTable({
    momentId: v.id('moments'),
    operationId: v.string(),
    status: v.union(v.literal('pending'), v.literal('ready'), v.literal('failed')),
    splatUrl: v.optional(v.string()),
    viewerUrl: v.optional(v.string()),
  }).index('by_momentId', ['momentId']),

  posters: defineTable({
    tripId: v.id('trips'),
    style: v.string(),
    storageId: v.optional(v.id('_storage')),
  }).index('by_tripId', ['tripId']),

  orders: defineTable({
    userId: v.id('users'),
    tripId: v.optional(v.id('trips')),
    product: v.optional(product),
    variant: v.optional(v.string()),
    posterId: v.optional(v.id('posters')),
    size: v.optional(printSize),
    momentId: v.optional(v.id('moments')),
    giftToUserId: v.optional(v.id('users')),
    downloadStorageId: v.optional(v.id('_storage')),
    whopCheckoutId: v.optional(v.string()),
    whopPaymentId: v.optional(v.string()),
    status: v.union(v.literal('pending'), v.literal('paid'), v.literal('fulfilled'), v.literal('refunded')),
  })
    .index('by_posterId', ['posterId'])
    .index('by_userId', ['userId'])
    .index('by_whopCheckoutId', ['whopCheckoutId'])
    .index('by_whopPaymentId', ['whopPaymentId']),

  gifts: defineTable({
    orderId: v.id('orders'),
    fromUserId: v.id('users'),
    toUserId: v.id('users'),
    momentId: v.optional(v.id('moments')),
    seen: v.boolean(),
  })
    .index('by_toUserId', ['toUserId'])
    .index('by_orderId', ['orderId']),

  memberships: defineTable({
    userId: v.id('users'),
    whopMembershipId: v.string(),
    status: v.union(v.literal('active'), v.literal('inactive')),
    renewsAt: v.optional(v.number()),
  })
    .index('by_userId', ['userId'])
    .index('by_whopMembershipId', ['whopMembershipId']),

  listings: defineTable({
    userId: v.id('users'),
    tripId: v.id('trips'),
    title: v.string(),
    priceCents: v.number(),
    whopProductId: v.string(),
    whopPlanId: v.string(),
    sales: v.number(),
    earningsCents: v.number(),
  }).index('by_userId', ['userId']),

  purchases: defineTable({
    listingId: v.id('listings'),
    buyerUserId: v.id('users'),
    status: v.union(v.literal('pending'), v.literal('paid'), v.literal('refunded')),
    whopCheckoutId: v.optional(v.string()),
    whopPaymentId: v.optional(v.string()),
    netCents: v.optional(v.number()),
  })
    .index('by_listingId_and_buyerUserId', ['listingId', 'buyerUserId'])
    .index('by_whopCheckoutId', ['whopCheckoutId'])
    .index('by_whopPaymentId', ['whopPaymentId']),
});
