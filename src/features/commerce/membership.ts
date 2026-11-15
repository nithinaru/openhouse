// Openhouse+ ($5/mo). memberships:checkout -> Whop url -> poll me:entitlements until plus.
// The app soft-locks night/field poster styles and Walk in behind plus, but the demo never
// dead-ends: on the demo trip, or whenever the backend can't answer, everything is unlocked
// unless the demo panel forces a lock.

import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { demoFlags, useDemoFlags } from '@/features/demo/demoFlags';
import { tryCall } from '@/lib/data/convexHttp';
import { getIdentity } from '@/lib/data/identity';
import { isDemoTripId } from '@/lib/data/trips';

import { myUserId, pollUntil, readCheckout, request, unavailable, type CheckoutStart, type Result } from './checkout';

export const PLUS_PRICE_CENTS = 500;

/** What plus unlocks, for the paywall and lock copy. */
export const PLUS_PERKS = [
  { id: 'styles', title: 'every poster style', detail: 'night map and field notes, on every day you frame' },
  { id: 'walkin', title: 'unlimited walk ins', detail: 'step inside any stop in 3d, as often as you like' },
  { id: 'film', title: 'a month in review film', detail: 'your month, narrated, waiting on the 1st' },
] as const;

export const PLUS_STYLES = new Set(['night', 'field']);

// ---------------------------------------------------------------------------------------------
// Entitlement store (module level, shared by every screen)

type Live = { plus: boolean; renewsAt: number | null; at: number };
let live: Live | undefined;
type Backend = 'unknown' | 'live' | 'soon' | 'offline';
let backend: Backend = 'unknown';
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

async function fetchEntitlements(): Promise<Live | null> {
  const userId = getIdentity().userId ?? (await myUserId());
  if (!userId) {
    backend = 'offline';
    return null;
  }
  const res = await tryCall<{ plus?: unknown; renewsAt?: unknown } | null>('meEntitlements', { userId });
  if (!res.ok) {
    const next: Backend = res.error.kind === 'missing' ? 'soon' : res.error.kind === 'server' ? 'soon' : 'offline';
    if (next !== backend) {
      backend = next;
      emit();
    }
    return null;
  }
  const plus = res.value?.plus === true;
  const renewsAt = typeof res.value?.renewsAt === 'number' ? res.value.renewsAt : null;
  const changed = !live || live.plus !== plus || backend !== 'live';
  live = { plus, renewsAt, at: Date.now() };
  backend = 'live';
  if (changed) emit();
  return live;
}

// Ref-counted poller: one interval no matter how many screens read entitlements.
let subscribers = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let appSub: { remove: () => void } | undefined;
const POLL_MS = 6000;

function startPolling() {
  if (subscribers++ > 0) return;
  void fetchEntitlements();
  timer = setInterval(() => void fetchEntitlements(), POLL_MS);
  appSub = AppState.addEventListener('change', (s) => {
    if (s === 'active') void fetchEntitlements();
  });
}

function stopPolling() {
  if (--subscribers > 0) return;
  if (timer) clearInterval(timer);
  timer = undefined;
  appSub?.remove();
  appSub = undefined;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => version;

export type Entitlements = {
  /** True when plus features should be open right now. */
  plus: boolean;
  /** The user actually holds a membership (from Convex). */
  member: boolean;
  /** Where `plus` came from. */
  source: 'member' | 'forced-locked' | 'forced-unlocked' | 'demo' | 'fallback' | 'locked';
  backend: Backend;
  renewsAt: number | null;
  refresh: () => void;
};

export function resolveEntitlements(tripId?: string): Entitlements {
  const forced = demoFlags.plusLocked;
  const member = live?.plus === true;
  const base = { member, backend, renewsAt: live?.renewsAt ?? null, refresh: () => void fetchEntitlements() };
  if (member) return { ...base, plus: true, source: 'member' };
  if (forced === 'locked') return { ...base, plus: false, source: 'forced-locked' };
  if (forced === 'unlocked') return { ...base, plus: true, source: 'forced-unlocked' };
  if (tripId && isDemoTripId(tripId)) return { ...base, plus: true, source: 'demo' };
  if (backend !== 'live') return { ...base, plus: true, source: 'fallback' };
  return { ...base, plus: false, source: 'locked' };
}

/** Reads entitlements (polled every 6 s while any screen is mounted). Pass the trip on screen. */
export function useEntitlements(tripId?: string): Entitlements {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  useDemoFlags(); // re-render when the panel flips the lock
  useEffect(() => {
    startPolling();
    return stopPolling;
  }, []);
  return resolveEntitlements(tripId);
}

// ---------------------------------------------------------------------------------------------
// Checkout

export async function startMembershipCheckout(): Promise<Result<CheckoutStart>> {
  const userId = await myUserId();
  if (!userId) return unavailable('offline');
  const res = await request<unknown>('membershipsCheckout', { userId });
  if (!res.ok) return res;
  const start = readCheckout(res.value, 'checkoutId');
  return start ? { ok: true, value: start } : unavailable('error');
}

/** Polls me:entitlements until plus is true. */
export function waitForPlus(opts?: { timeoutMs?: number; signal?: AbortSignal }) {
  return pollUntil(async () => ((await fetchEntitlements())?.plus ? true : null), { everyMs: 2000, ...opts });
}
