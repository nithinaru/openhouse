// Whop drop contract (docs/WHOP.md, "the drop"): drops:create, drops:get, drops:checkout,
// then the existing orders:get for paid state. Until those functions are deployed the screen
// runs on local launch numbers and checkout reports "coming online". Paid state only ever
// comes from Convex (waitForOrder), never from the in-app browser closing.

import { useEffect, useState } from 'react';

import {
  myUserId,
  readCheckout,
  request,
  unavailable,
  waitForOrder,
  type CheckoutStart,
  type Order,
  type Result,
} from '@/features/commerce/checkout';
import { DEMO_REMOTE_TRIP_ID, DEMO_REMOTE_USER_ID } from '@/lib/data/paths';
import { isDemoTripId } from '@/lib/data/trips';
import type { Trip } from '@/lib/types';

import type { Edition, PieceId } from './model';

export type DropEdition = { edition: Edition; stock: number; claimed: number };

export type Drop = {
  dropId: string | null;
  title: string;
  closesAt: number;
  editions: DropEdition[];
  /** live = answered by Convex; local = launch numbers until drops:* is deployed. */
  source: 'live' | 'local';
};

export type DropItem = { piece: PieceId; size?: string };

const POLL_MS = 5000;

// ---------------------------------------------------------------------------------------------
// Local launch state (stable for the session so the countdown doesn't reset on remount)

const localCache = new Map<string, Drop>();

export function localDrop(trip: Pick<Trip, 'id' | 'title'>): Drop {
  const hit = localCache.get(trip.id);
  if (hit) return hit;
  const drop: Drop = {
    dropId: null,
    title: `the drop · ${trip.title.toLowerCase()}`,
    closesAt: Date.now() + (2 * 60 + 14) * 60_000 + 30_000,
    editions: [
      { edition: 'was_there', stock: 180, claimed: 112 },
      { edition: 'public', stock: 500, claimed: 238 },
    ],
    source: 'local',
  };
  localCache.set(trip.id, drop);
  return drop;
}

function readDrop(v: unknown): Omit<Drop, 'source'> | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.dropId !== 'string' || !Array.isArray(o.editions)) return null;
  const editions = (o.editions as Record<string, unknown>[])
    .filter((e) => (e.edition === 'was_there' || e.edition === 'public') && typeof e.stock === 'number' && typeof e.claimed === 'number')
    .map((e) => ({ edition: e.edition as Edition, stock: e.stock as number, claimed: e.claimed as number }));
  if (!editions.length) return null;
  return {
    dropId: o.dropId,
    title: typeof o.title === 'string' ? o.title : 'the drop',
    closesAt: typeof o.closesAt === 'number' ? o.closesAt : Date.now() + 2 * 3600_000,
    editions,
  };
}

/** The Convex user + trip the drop is created for. Demo trip uses the seeded demo user. */
async function ownerFor(tripId: string): Promise<{ userId: string; tripId: string } | null> {
  if (isDemoTripId(tripId)) return { userId: DEMO_REMOTE_USER_ID, tripId: DEMO_REMOTE_TRIP_ID };
  const userId = await myUserId();
  return userId ? { userId, tripId } : null;
}

// ---------------------------------------------------------------------------------------------
// drops:create once, then drops:get every 5 s for live counts.

export function useDrop(trip: Trip): Drop {
  const [liveDrop, setLive] = useState<{ tripId: string; drop: Drop } | null>(null);
  const tripId = trip.id;
  const tripTitle = trip.title;

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async (dropId: string) => {
      const res = await request<unknown>('dropsGet', { dropId });
      if (!alive) return;
      const d = res.ok ? readDrop(res.value) : null;
      if (d) setLive({ tripId, drop: { ...d, source: 'live' } });
      timer = setTimeout(() => void poll(dropId), POLL_MS);
    };

    void (async () => {
      const owner = await ownerFor(tripId);
      if (!owner || !alive) return;
      const res = await request<unknown>('dropsCreate', owner);
      if (!alive || !res.ok) return;
      const d = readDrop(res.value);
      if (!d?.dropId) return;
      setLive({ tripId, drop: { ...d, source: 'live' } });
      timer = setTimeout(() => void poll(d.dropId!), POLL_MS);
    })();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [tripId, tripTitle]);

  return liveDrop?.tripId === tripId ? liveDrop.drop : localDrop({ id: tripId, title: tripTitle });
}

// ---------------------------------------------------------------------------------------------
// drops:checkout -> Whop purchase url; orders:get confirms.

export async function startDropCheckout(args: {
  trip: Trip;
  drop: Drop;
  edition: Edition;
  items: DropItem[];
}): Promise<Result<CheckoutStart>> {
  if (!args.drop.dropId) return unavailable('soon', 'coming online. the whop drop turns on with the next backend deploy');
  const owner = await ownerFor(args.trip.id);
  if (!owner) return unavailable('offline');
  const res = await request<unknown>('dropsCheckout', {
    dropId: args.drop.dropId,
    userId: owner.userId,
    edition: args.edition,
    items: args.items.map((i) => (i.size ? { piece: i.piece, size: i.size } : { piece: i.piece })),
  });
  if (!res.ok) return res;
  const start = readCheckout(res.value);
  return start ? { ok: true, value: start } : unavailable('error');
}

export function confirmDropOrder(c: CheckoutStart, signal: AbortSignal): Promise<Order | null> {
  return waitForOrder(c.orderId, { signal, timeoutMs: 120_000 });
}

/** What a confirmed drop purchase resolves to (from orders:get, via the webhook). */
export type DropPaid = { orderId: string };

export async function confirmDropPaid(c: CheckoutStart, signal: AbortSignal): Promise<DropPaid | null> {
  const order = await confirmDropOrder(c, signal);
  return order ? { orderId: c.orderId } : null;
}
