// "was there" promo codes and the drop referral cut (contract: docs/WHOP.md §6).
//
//   promos:forFriend { userId, friendShareCode, dropId } -> { code, percentOff, expiresAt }
//   referrals:link   { userId, dropId }                  -> { url, earnedCents, clicks, sales }
//
// Until those functions are deployed both hooks answer with local preview values (same code
// format, same 20% / 10%), flagged `source: 'local'` so the UI can label them quietly.

import { useEffect, useState } from 'react';

import { myUserId, request } from '@/features/commerce/checkout';
import { DEMO_REMOTE_TRIP_ID, DEMO_REMOTE_USER_ID } from '@/lib/data/paths';
import { isDemoTripId } from '@/lib/data/trips';

export const PROMO_PERCENT_OFF = 20;
export const REFERRAL_SHARE = 0.1;
const REFERRAL_POLL_MS = 5000;

export type Promo = { code: string; percentOff: number; expiresAt: number; source: 'live' | 'local' };

export type Referral = { url: string; earnedCents: number; clicks: number; sales: number; source: 'live' | 'local' };

/** "Rohan" -> "ROHAN-WASTHERE". Same format the server mints. */
export function wasThereCode(friendName: string): string {
  const base = friendName
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 12);
  return `${base || 'FRIEND'}-WASTHERE`;
}

/** Loose client-side check so the field can show "applied"; the server is the real judge. */
export function looksLikePromo(code: string): boolean {
  return /^[A-Z0-9]{2,12}-WASTHERE$/.test(code.trim().toUpperCase());
}

export function discounted(cents: number, percentOff: number): number {
  return Math.round(cents * (1 - percentOff / 100));
}

/** Who is issuing codes / owning the referral link: demo trip -> seeded demo user. */
async function issuerFor(tripId: string | undefined): Promise<string | null> {
  if (!tripId || isDemoTripId(tripId)) return DEMO_REMOTE_USER_ID;
  return myUserId();
}

/** The drop id for a trip when the caller doesn't have one (pairing screen). drops:create is idempotent. */
async function dropIdFor(tripId: string | undefined, userId: string): Promise<string | null> {
  const res = await request<{ dropId?: unknown }>('dropsCreate', {
    userId,
    tripId: !tripId || isDemoTripId(tripId) ? DEMO_REMOTE_TRIP_ID : tripId,
  });
  return res.ok && typeof res.value?.dropId === 'string' ? res.value.dropId : null;
}

function readPromo(v: unknown): Omit<Promo, 'source'> | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.code !== 'string' || typeof o.percentOff !== 'number') return null;
  return { code: o.code, percentOff: o.percentOff, expiresAt: typeof o.expiresAt === 'number' ? o.expiresAt : localExpiry() };
}

const localExpiry = () => {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return d.getTime() + 24 * 3600_000;
};

export function localPromo(friendName: string): Promo {
  return { code: wasThereCode(friendName), percentOff: PROMO_PERCENT_OFF, expiresAt: localExpiry(), source: 'local' };
}

/** The code a paired friend gets for this drop. Local preview until promos:forFriend answers. */
export function useFriendPromo(args: { friendName: string; friendShareCode?: string; dropId?: string | null; tripId?: string }): Promo {
  const { friendName, friendShareCode, dropId, tripId } = args;
  const [live, setLive] = useState<{ key: string; promo: Promo } | null>(null);
  const key = `${friendShareCode}|${dropId ?? ''}|${tripId ?? ''}`;

  useEffect(() => {
    if (!friendShareCode) return;
    let alive = true;
    void (async () => {
      const userId = await issuerFor(tripId);
      if (!userId || !alive) return;
      const id = dropId ?? (await dropIdFor(tripId, userId));
      if (!id || !alive) return;
      const res = await request<unknown>('promosForFriend', { userId, friendShareCode, dropId: id });
      const p = res.ok ? readPromo(res.value) : null;
      if (alive && p) setLive({ key, promo: { ...p, source: 'live' } });
    })();
    return () => {
      alive = false;
    };
  }, [friendShareCode, dropId, tripId, key]);

  return live?.key === key ? live.promo : localPromo(friendName);
}

function readReferral(v: unknown): Omit<Referral, 'source'> | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.url !== 'string') return null;
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
  return { url: o.url, earnedCents: n(o.earnedCents), clicks: n(o.clicks), sales: n(o.sales) };
}

/** Preview numbers: a handful of clicks and three bundles sold through your link. */
export function localReferral(tripId: string, bundleCents: number): Referral {
  const sales = 3;
  return {
    url: `openhouse://drop/${tripId}?ref=nithin`,
    clicks: 14,
    sales,
    earnedCents: Math.round(sales * bundleCents * REFERRAL_SHARE),
    source: 'local',
  };
}

/** referrals:link once the drop is live, re-read every 5 s so earnings tick up. */
export function useReferral(args: { tripId: string; dropId: string | null; bundleCents: number }): Referral {
  const { tripId, dropId, bundleCents } = args;
  const [live, setLive] = useState<{ dropId: string; ref: Referral } | null>(null);

  useEffect(() => {
    if (!dropId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const userId = await issuerFor(tripId);
      if (!alive || !userId) return;
      const res = await request<unknown>('referralsLink', { userId, dropId });
      if (!alive) return;
      const r = res.ok ? readReferral(res.value) : null;
      if (r) setLive({ dropId, ref: { ...r, source: 'live' } });
      // Stop polling when the function isn't there yet; the hook re-runs when dropId changes.
      if (res.ok || res.reason !== 'soon') timer = setTimeout(() => void tick(), REFERRAL_POLL_MS);
    };
    void tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [tripId, dropId]);

  return live && live.dropId === dropId ? live.ref : localReferral(tripId, bundleCents);
}
