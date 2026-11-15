import { v, type Infer } from 'convex/values';
import { action, internalMutation, internalQuery, query, type MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { dropItem, edition as editionValidator } from './schema';
import { VENUE } from '../src/lib/demo/demoTrip';
import { dollars, purchaseUrlOf, whop } from './whop';

type Edition = Infer<typeof editionValidator>;
type DropItem = Infer<typeof dropItem>;

const STOCK: Record<Edition, number> = { was_there: 180, public: 500 };
const EDITION_TITLE: Record<Edition, string> = { was_there: 'was there', public: 'public' };
const PIECE_CENTS = { hoodie: 7200, tee: 3800, tote: 2800, cap: 3200, stickers: 800, pin: 1400 };
const BUNDLE_CENTS = 14900;
const SIZES = new Set(['xs', 's', 'm', 'l', 'xl', 'xxl']);
const SIZED = new Set(['hoodie', 'tee']);
const MAX_ITEMS = 20;
const PRESENCE_M = 300;
const HOST_SHARE = 0.1;
const OPEN_MS = 24 * 3600_000;
const DEMO_DEVICE_ID = 'demo-me';

type DropView = {
  dropId: Id<'drops'>;
  title: string;
  closesAt: number;
  editions: { edition: Edition; stock: number; claimed: number }[];
};

const view = (drop: Doc<'drops'>): DropView => ({
  dropId: drop._id,
  title: drop.title,
  closesAt: drop.closesAt,
  editions: drop.editions.map(({ edition, stock, claimed }) => ({ edition, stock, claimed })),
});

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function endOfDayInSanFrancisco(ms: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZoneName: 'longOffset',
  }).formatToParts(new Date(ms));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const [, sign, hh, mm] = /GMT([+-])(\d\d):(\d\d)/.exec(part('timeZoneName')) ?? [, '+', '00', '00'];
  const offsetMs = (sign === '-' ? -1 : 1) * (Number(hh) * 60 + Number(mm)) * 60_000;
  return Date.UTC(Number(part('year')), Number(part('month')) - 1, Number(part('day')) + 1) - offsetMs;
}

function cartCents(items: DropItem[]) {
  const pieces = new Set(items.map((i) => i.piece));
  if (items.length === pieces.size && pieces.size === Object.keys(PIECE_CENTS).length) return BUNDLE_CENTS;
  return items.reduce((sum, i) => sum + PIECE_CENTS[i.piece], 0);
}

export const prepare = internalQuery({
  args: { userId: v.id('users'), tripId: v.id('trips') },
  handler: async (ctx, { userId, tripId }) => {
    const existing = await ctx.db
      .query('drops')
      .withIndex('by_tripId', (q) => q.eq('tripId', tripId))
      .first();
    if (existing) return { existing: view(existing) };

    const trip = await ctx.db.get(tripId);
    if (!trip || trip.userId !== userId) throw new Error('Trip not found for this user');
    const owner = await ctx.db.get(userId);
    const isDemo = owner?.deviceId === DEMO_DEVICE_ID;

    let venue: Doc<'drops'>['venue'] = { name: VENUE.name, address: VENUE.address, lat: VENUE.lat, lng: VENUE.lng };
    if (!isDemo && !/yc hackathon/i.test(trip.title)) {
      const stops = await ctx.db
        .query('moments')
        .withIndex('by_tripId', (q) => q.eq('tripId', tripId))
        .take(200);
      let best: { stop: Doc<'moments'>; photos: number } | null = null;
      for (const stop of stops) {
        const photos = (
          await ctx.db
            .query('photos')
            .withIndex('by_momentId', (q) => q.eq('momentId', stop._id))
            .take(500)
        ).length;
        const longer = best && photos === best.photos && stop.endAt - stop.startAt > best.stop.endAt - best.stop.startAt;
        if (!best || photos > best.photos || longer) best = { stop, photos };
      }
      if (!best) throw new Error('This trip has no stops to make a drop from');
      const parts = (best.stop.placeName ?? trip.title).split(',').map((s) => s.trim().toLowerCase());
      venue = { name: parts[0], address: parts.slice(1).join(', ') || parts[0], lat: best.stop.lat, lng: best.stop.lng };
    }

    return {
      new: {
        title: `the drop · ${trip.title.toLowerCase()}`,
        venue,
        closesAt: isDemo ? endOfDayInSanFrancisco(trip.startAt) : null,
      },
    };
  },
});

export const insert = internalMutation({
  args: {
    tripId: v.id('trips'),
    userId: v.id('users'),
    title: v.string(),
    venue: v.object({ name: v.string(), address: v.string(), lat: v.number(), lng: v.number() }),
    closesAt: v.number(),
    whopProductId: v.string(),
    editions: v.array(v.object({ edition: editionValidator, stock: v.number(), whopPlanId: v.string() })),
  },
  handler: async (ctx, args): Promise<DropView> => {
    const existing = await ctx.db
      .query('drops')
      .withIndex('by_tripId', (q) => q.eq('tripId', args.tripId))
      .first();
    if (existing) return view(existing);
    const dropId = await ctx.db.insert('drops', { ...args, editions: args.editions.map((e) => ({ ...e, claimed: 0 })) });
    return view((await ctx.db.get(dropId))!);
  },
});

export const create = action({
  args: { userId: v.id('users'), tripId: v.id('trips') },
  handler: async (ctx, args): Promise<DropView> => {
    const prepared: { existing: DropView } | { new: { title: string; venue: Doc<'drops'>['venue']; closesAt: number | null } } =
      await ctx.runQuery(internal.drops.prepare, args);
    if ('existing' in prepared) return prepared.existing;
    const { title, venue } = prepared.new;
    const closesAt = prepared.new.closesAt ?? Date.now() + OPEN_MS;

    const client = whop();
    const product = await client.products.create({ title, metadata: { tripId: args.tripId, userId: args.userId } });
    const editions = [];
    for (const edition of ['was_there', 'public'] as const) {
      const variant = await client.variants.create({
        product_id: product.id,
        title: EDITION_TITLE[edition],
        billing_type: 'one_time',
        currency: 'usd',
        initial_price: dollars(BUNDLE_CENTS),
        stock: STOCK[edition],
        unlimited_stock: false,
        metadata: { tripId: args.tripId, edition },
      });
      editions.push({ edition, stock: STOCK[edition], whopPlanId: variant.id });
    }
    return await ctx.runMutation(internal.drops.insert, { ...args, title, venue, closesAt, whopProductId: product.id, editions });
  },
});

export const get = query({
  args: { dropId: v.id('drops') },
  handler: async (ctx, { dropId }): Promise<DropView | null> => {
    const drop = await ctx.db.get(dropId);
    return drop ? view(drop) : null;
  },
});

async function wasThere(ctx: MutationCtx, userId: Id<'users'>, drop: Doc<'drops'>) {
  const user = await ctx.db.get(userId);
  if (!user) throw new Error('User not found');
  if (user.deviceId === DEMO_DEVICE_ID && userId === drop.userId) return true;
  const located = new Set<Id<'moments'>>();
  for await (const photo of ctx.db.query('photos').withIndex('by_userId', (q) => q.eq('userId', userId))) {
    if (photo.lat === undefined || photo.lng === undefined) continue;
    if (metersBetween({ lat: photo.lat, lng: photo.lng }, drop.venue) <= PRESENCE_M) return true;
    located.add(photo.momentId);
  }
  for await (const moment of ctx.db.query('moments').withIndex('by_userId', (q) => q.eq('userId', userId))) {
    if (!located.has(moment._id) && metersBetween(moment, drop.venue) <= PRESENCE_M) return true;
  }
  return false;
}

const checkoutArgs = {
  dropId: v.id('drops'),
  userId: v.id('users'),
  edition: editionValidator,
  items: v.array(dropItem),
};

type StartedOrder = { orderId: Id<'orders'>; priceCents: number; whopProductId: string; title: string };

export const startOrder = internalMutation({
  args: checkoutArgs,
  handler: async (ctx, { dropId, userId, edition, items }): Promise<StartedOrder> => {
    const drop = await ctx.db.get(dropId);
    if (!drop) throw new Error('Drop not found');
    if (Date.now() >= drop.closesAt) throw new Error('closed');
    const slot = drop.editions.find((e) => e.edition === edition);
    if (!slot) throw new Error(`Unknown edition: ${edition}`);
    if (slot.claimed >= slot.stock) throw new Error('sold out');
    if (items.length === 0 || items.length > MAX_ITEMS) throw new Error(`Pick 1 to ${MAX_ITEMS} pieces`);
    const cart = items.map(({ piece, size }) => {
      if (!SIZED.has(piece)) return { piece };
      if (!size || !SIZES.has(size)) throw new Error(`The ${piece} needs a size from xs to xxl`);
      return { piece, size };
    });
    if (edition === 'was_there' && !(await wasThere(ctx, userId, drop))) throw new Error('not at the venue');

    const price = cartCents(cart);
    const orderId = await ctx.db.insert('orders', {
      userId,
      tripId: drop.tripId,
      product: 'drop',
      dropId,
      edition,
      items: cart,
      priceCents: price,
      hostFeeCents: Math.round(price * HOST_SHARE),
      status: 'pending',
    });
    const title = `${EDITION_TITLE[edition]} · ${cart.length === 1 ? cart[0].piece : `${cart.length} pieces`}`;
    return { orderId, priceCents: price, whopProductId: drop.whopProductId, title };
  },
});

export const checkout = action({
  args: checkoutArgs,
  handler: async (ctx, args): Promise<{ purchaseUrl: string; orderId: Id<'orders'> }> => {
    const { orderId, priceCents, whopProductId, title }: StartedOrder = await ctx.runMutation(internal.drops.startOrder, args);
    const config = await whop().checkoutConfigurations.create({
      mode: 'payment',
      metadata: { orderId },
      variant: {
        product_id: whopProductId,
        title,
        billing_type: 'one_time',
        currency: 'usd',
        initial_price: dollars(priceCents),
      },
    });
    const purchaseUrl = purchaseUrlOf(config);
    await ctx.runMutation(internal.orders.setCheckout, { orderId, whopCheckoutId: config.id });
    return { purchaseUrl, orderId };
  },
});

export async function adjustClaimed(ctx: MutationCtx, order: Doc<'orders'>, delta: 1 | -1) {
  if (order.product !== 'drop' || !order.dropId || !order.edition) return;
  const drop = await ctx.db.get(order.dropId);
  if (!drop) return;
  await ctx.db.patch(drop._id, {
    editions: drop.editions.map((e) => (e.edition === order.edition ? { ...e, claimed: Math.max(0, e.claimed + delta) } : e)),
  });
}
