// Sell this day: publish a trip as a paid walkable guide (contract: docs/WHOP.md §4).
// Seller: listings:create, listings:forSeller (polled, earnings tick up live).
// Buyer: listings:get, listings:checkout -> Whop -> poll listings:hasAccess -> open the Replay.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { tryCall } from '@/lib/data/convexHttp';
import { getIdentity } from '@/lib/data/identity';
import { DEMO_REMOTE_TRIP_ID, DEMO_REMOTE_USER_ID } from '@/lib/data/paths';
import { isDemoTripId } from '@/lib/data/trips';

import { myUserId, pollUntil, readCheckout, request, unavailable, type CheckoutStart, type Result, type Unavailable } from './checkout';

export const MIN_PRICE_CENTS = 100;
export const MAX_PRICE_CENTS = 1000;
/** Our cut, shown to the seller so the earnings number is honest. */
export const PLATFORM_FEE = 0.1;

export type SellerListing = {
  listingId: string;
  title: string;
  priceCents: number;
  sales: number;
  earningsCents: number;
  shareUrl: string;
  tripId: string;
};

export type Listing = {
  listingId: string;
  title: string;
  priceCents: number;
  sellerName: string;
  tripId: string;
  stops: number;
  previewUrls: string[];
};

export const listingLink = (listingId: string) => `openhouse://listing/${listingId}`;

/** Seller identity for a trip: the demo trip sells as the seeded demo user. */
async function sellerFor(tripId?: string): Promise<{ userId: string; tripId?: string } | null> {
  if (tripId && isDemoTripId(tripId)) return { userId: DEMO_REMOTE_USER_ID, tripId: DEMO_REMOTE_TRIP_ID };
  const userId = getIdentity().userId ?? (await myUserId());
  return userId ? { userId, tripId } : null;
}

export async function createListing(args: { tripId: string; title: string; priceCents: number }): Promise<Result<{ listingId: string; shareUrl: string }>> {
  const seller = await sellerFor(args.tripId);
  if (!seller?.tripId) return unavailable('offline');
  const priceCents = Math.round(Math.min(MAX_PRICE_CENTS, Math.max(MIN_PRICE_CENTS, args.priceCents)));
  const res = await request<{ listingId?: unknown; shareUrl?: unknown }>('listingsCreate', {
    userId: seller.userId,
    tripId: seller.tripId,
    title: args.title.trim(),
    priceCents,
  });
  if (!res.ok) return res;
  if (typeof res.value?.listingId !== 'string') return unavailable('error');
  const listingId = res.value.listingId;
  return { ok: true, value: { listingId, shareUrl: typeof res.value.shareUrl === 'string' ? res.value.shareUrl : listingLink(listingId) } };
}

function normalizeSeller(raw: unknown): SellerListing | null {
  if (!raw || typeof raw !== 'object') return null;
  const l = raw as Record<string, unknown>;
  if (typeof l.listingId !== 'string') return null;
  const num = (k: string) => (typeof l[k] === 'number' ? (l[k] as number) : 0);
  return {
    listingId: l.listingId,
    title: typeof l.title === 'string' ? l.title : 'untitled guide',
    priceCents: num('priceCents'),
    sales: num('sales'),
    earningsCents: num('earningsCents'),
    shareUrl: typeof l.shareUrl === 'string' ? l.shareUrl : listingLink(l.listingId),
    tripId: typeof l.tripId === 'string' ? l.tripId : '',
  };
}

export type SellerState = {
  listings: SellerListing[];
  /** `soon` while listings:forSeller isn't deployed. */
  status: 'loading' | 'live' | Unavailable;
  refresh: () => void;
  /** Rehearsal only: add a fake sale locally (long-press the earnings card title). */
  simulateSale: (listingId?: string) => void;
};

// Rehearsal sales, shared by every screen showing earnings this session.
type Fake = Record<string, { sales: number; cents: number }>;
let fakeSales: Fake = {};
const fakeListeners = new Set<() => void>();
const subscribeFake = (l: () => void) => {
  fakeListeners.add(l);
  return () => {
    fakeListeners.delete(l);
  };
};
const readFake = () => fakeSales;

/** listings:forSeller, polled every `ms`. Pass the trip on screen so the demo trip reads the demo seller. */
export function useSellerListings(tripId?: string, ms = 3000): SellerState {
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [status, setStatus] = useState<SellerState['status']>('loading');
  const last = useRef('');
  const fake = useSyncExternalStore(subscribeFake, readFake, readFake);

  const tick = useCallback(async () => {
    const seller = await sellerFor(tripId);
    if (!seller) {
      setStatus('offline');
      return;
    }
    const res = await request<unknown[]>('listingsForSeller', { userId: seller.userId });
    if (!res.ok) {
      setStatus(res.reason);
      return;
    }
    const next = (Array.isArray(res.value) ? res.value : []).map(normalizeSeller).filter((l): l is SellerListing => l !== null);
    setStatus('live');
    const key = JSON.stringify(next);
    if (key === last.current) return;
    last.current = key;
    setListings(next);
  }, [tripId]);

  useEffect(() => {
    let alive = true;
    const run = () => {
      if (alive) void tick();
    };
    run();
    let timer: ReturnType<typeof setInterval> | undefined = setInterval(run, ms);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        run();
        if (!timer) timer = setInterval(run, ms);
      } else if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
    });
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [ms, tick]);

  const simulateSale = useCallback(
    (listingId?: string) => {
      const target = listingId ?? listings[0]?.listingId ?? 'rehearsal';
      const price = listings.find((l) => l.listingId === target)?.priceCents ?? 500;
      const add = Math.round(price * (1 - PLATFORM_FEE));
      const f = fakeSales;
      fakeSales = { ...f, [target]: { sales: (f[target]?.sales ?? 0) + 1, cents: (f[target]?.cents ?? 0) + add } };
      fakeListeners.forEach((l) => l());
    },
    [listings],
  );

  // Merge rehearsal sales on top of live numbers.
  const merged =
    Object.keys(fake).length === 0
      ? listings
      : (() => {
          const base = listings.length
            ? listings
            : [{ listingId: 'rehearsal', title: 'yc hackathon day, walkable', priceCents: 500, sales: 0, earningsCents: 0, shareUrl: listingLink('rehearsal'), tripId: tripId ?? '' }];
          return base.map((l) => {
            const f = fake[l.listingId];
            return f ? { ...l, sales: l.sales + f.sales, earningsCents: l.earningsCents + f.cents } : l;
          });
        })();

  return { listings: merged, status, refresh: () => void tick(), simulateSale };
}

export async function getListing(listingId: string): Promise<Result<Listing>> {
  const res = await request<Record<string, unknown> | null>('listingsGet', { listingId });
  if (!res.ok) return res;
  const l = res.value;
  if (!l || typeof l.title !== 'string') return unavailable('error', "this guide isn't available anymore");
  return {
    ok: true,
    value: {
      listingId,
      title: l.title,
      priceCents: typeof l.priceCents === 'number' ? l.priceCents : 0,
      sellerName: typeof l.sellerName === 'string' ? l.sellerName : 'someone',
      tripId: typeof l.tripId === 'string' ? l.tripId : '',
      stops: typeof l.stops === 'number' ? l.stops : 0,
      previewUrls: Array.isArray(l.previewUrls) ? l.previewUrls.filter((u): u is string => typeof u === 'string') : [],
    },
  };
}

export async function startListingCheckout(listingId: string): Promise<Result<CheckoutStart>> {
  const buyerUserId = getIdentity().userId ?? (await myUserId());
  if (!buyerUserId) return unavailable('offline');
  const res = await request<unknown>('listingsCheckout', { listingId, buyerUserId });
  if (!res.ok) return res;
  const start = readCheckout(res.value);
  return start ? { ok: true, value: start } : unavailable('error');
}

export async function hasListingAccess(listingId: string): Promise<{ access: boolean; tripId: string | null } | null> {
  const userId = getIdentity().userId ?? (await myUserId());
  if (!userId) return null;
  const res = await tryCall<{ access?: unknown; tripId?: unknown } | null>('listingsHasAccess', { listingId, userId });
  if (!res.ok || !res.value) return null;
  return { access: res.value.access === true, tripId: typeof res.value.tripId === 'string' ? res.value.tripId : null };
}

/** Polls listings:hasAccess until true. Resolves with the unlocked trip id ('' if none given). */
export function waitForAccess(listingId: string, opts?: { timeoutMs?: number; signal?: AbortSignal }) {
  return pollUntil(async () => {
    const a = await hasListingAccess(listingId);
    return a?.access ? (a.tripId ?? '') || 'unlocked' : null;
  }, opts);
}
