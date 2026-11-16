// Openhouse for hosts (contract: docs/WHOP.md §6).
//
//   host:stats  { userId } -> HostStats            polled every 3 s so sales land live on stage
//   host:payout { userId } -> { transferId, amountCents }
//
// Until those functions are deployed the dashboard runs on preview numbers derived from the
// demo trip and its local drop (112 / 180 was there, 238 / 500 public), labeled "preview".
// A preview payout never moves money; it only shows what the screen will do.

import { useCallback, useEffect, useState } from 'react';

import { request, type Result } from '@/features/commerce/checkout';
import { localDrop } from '@/features/drop/api';
import { BUNDLE_CENTS, PIECES, type Edition, type PieceId } from '@/features/drop/model';
import { DEMO_REMOTE_USER_ID } from '@/lib/data/paths';
import { demoTrip } from '@/lib/demo/demoTrip';

export const HOST_POLL_MS = 3000;
export const HOST_FEE = 0.1;

export type HostSale = {
  /** Stable key for the feed. Server rows don't carry an id, so we derive one. */
  key: string;
  who: string;
  item: string;
  edition?: Edition;
  amountCents: number;
  at: number;
};

export type HostStats = {
  grossCents: number;
  orders: number;
  members: number;
  drop: { editions: { edition: Edition; stock: number; claimed: number }[] };
  feeBalanceCents: number;
  recent: HostSale[];
  source: 'live' | 'preview';
};

export type Payout = { transferId: string; amountCents: number; preview: boolean };

/** The organizer account the dashboard reads. The demo host is the seeded demo user. */
export const HOST_USER_ID = DEMO_REMOTE_USER_ID;
export const HOST_NAME = 'yc';

// ---------------------------------------------------------------------------------------------
// Avatars for the feed: anyone from the demo trip gets their face; everyone else an initial.

const FACES = new Map(demoTrip.people.map((p) => [p.name.toLowerCase(), p.avatarUri]));
export const faceFor = (who: string): string | undefined => FACES.get(who.toLowerCase());

// ---------------------------------------------------------------------------------------------
// Parsing host:stats

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

function readStats(v: unknown): Omit<HostStats, 'source'> | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.grossCents !== 'number') return null;
  const drop = (o.drop && typeof o.drop === 'object' ? o.drop : {}) as { editions?: unknown };
  const editions = (Array.isArray(drop.editions) ? drop.editions : [])
    .map((e) => e as Record<string, unknown>)
    .filter((e) => e.edition === 'was_there' || e.edition === 'public')
    .map((e) => ({ edition: e.edition as Edition, stock: num(e.stock), claimed: num(e.claimed) }));
  const recent = (Array.isArray(o.recent) ? o.recent : [])
    .map((r) => r as Record<string, unknown>)
    .filter((r) => typeof r.who === 'string' && typeof r.item === 'string')
    .map((r) => ({
      key: `${num(r.at)}-${r.who}-${r.item}`,
      who: r.who as string,
      item: r.item as string,
      edition: r.edition === 'was_there' || r.edition === 'public' ? (r.edition as Edition) : undefined,
      amountCents: num(r.amountCents),
      at: num(r.at),
    }));
  return {
    grossCents: o.grossCents,
    orders: num(o.orders),
    members: num(o.members),
    drop: { editions },
    feeBalanceCents: num(o.feeBalanceCents),
    recent,
  };
}

// ---------------------------------------------------------------------------------------------
// Preview numbers, derived from the demo trip's drop so the two screens agree.

const SHORT: Record<PieceId | 'bundle', string> = {
  hoodie: 'the hoodie',
  tee: 'the route tee',
  tote: 'the tote',
  cap: 'the cap',
  stickers: 'the sticker sheet',
  pin: 'the pin',
  bundle: 'the full drop',
};

// A fixed basket mix: what a run of ten orders looks like. Deterministic so rehearsals match.
const MIX: (PieceId | 'bundle')[] = ['hoodie', 'bundle', 'tee', 'hoodie', 'tote', 'cap', 'bundle', 'pin', 'tee', 'stickers'];
const priceOf = (p: PieceId | 'bundle') => (p === 'bundle' ? BUNDLE_CENTS : PIECES[p].priceCents);

const EXTRA_NAMES = ['maya', 'theo', 'priya', 'june', 'kai', 'lena', 'omar', 'zoe'];
const NAMES = [...demoTrip.people.map((p) => p.name.toLowerCase()), ...EXTRA_NAMES];

let fakeSeq = 0;

export function fakeSale(at = Date.now()): HostSale {
  const i = fakeSeq++;
  const piece = MIX[(i * 3 + 1) % MIX.length];
  const edition: Edition = i % 3 === 2 ? 'public' : 'was_there';
  return {
    key: `fake-${at}-${i}`,
    who: NAMES[i % NAMES.length],
    item: SHORT[piece],
    edition,
    amountCents: priceOf(piece),
    at,
  };
}

export function previewStats(): HostStats {
  const drop = localDrop(demoTrip);
  const orders = drop.editions.reduce((s, e) => s + e.claimed, 0);
  const avg = Math.round(MIX.reduce((s, p) => s + priceOf(p), 0) / MIX.length);
  const grossCents = orders * avg;
  const now = Date.now();
  const recent: HostSale[] = [0, 1, 2, 3, 4].map((k) => {
    const piece = MIX[(k * 7 + 2) % MIX.length];
    return {
      key: `seed-${k}`,
      who: NAMES[(k * 5) % NAMES.length],
      item: SHORT[piece],
      edition: k === 3 ? 'public' : 'was_there',
      amountCents: priceOf(piece),
      at: now - (k * 4 + 1) * 60_000 - k * 23_000,
    };
  });
  return {
    grossCents,
    orders,
    members: 41,
    drop: { editions: drop.editions.map((e) => ({ edition: e.edition, stock: e.stock, claimed: e.claimed })) },
    feeBalanceCents: Math.round(grossCents * HOST_FEE),
    recent,
    source: 'preview',
  };
}

/** Folds a sale into stats the way the webhook would (rehearsal only). */
export function withSale(s: HostStats, sale: HostSale): HostStats {
  return {
    ...s,
    grossCents: s.grossCents + sale.amountCents,
    orders: s.orders + 1,
    feeBalanceCents: s.feeBalanceCents + Math.round(sale.amountCents * HOST_FEE),
    drop: {
      editions: s.drop.editions.map((e) => (e.edition === sale.edition ? { ...e, claimed: Math.min(e.stock, e.claimed + 1) } : e)),
    },
    recent: [sale, ...s.recent].slice(0, 12),
  };
}

// ---------------------------------------------------------------------------------------------
// Hook

export function useHostStats(userId: string = HOST_USER_ID) {
  const [live, setLive] = useState<HostStats | null>(null);
  const [preview] = useState<HostStats>(previewStats);
  // Rehearsal sales stack on top of live numbers too, so the long-press works on any backend.
  const [injected, setInjected] = useState<HostSale[]>([]);
  // Preview payouts are subtracted locally; a live payout zeroes the balance on the server.
  const [paidOut, setPaidOut] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const res = await request<unknown>('hostStats', { userId });
      if (!alive) return;
      const s = res.ok ? readStats(res.value) : null;
      if (s) setLive({ ...s, source: 'live' });
      // A missing function is retried less often; convexHttp also skips it for 30 s.
      timer = setTimeout(() => void tick(), res.ok || res.reason !== 'soon' ? HOST_POLL_MS : HOST_POLL_MS * 4);
    };
    void tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [userId]);

  // Recording builds (EXPO_PUBLIC_DEMO_VIDEO=1): the demo drop's numbers plus the hoodie bought on camera.
  const video = process.env.EXPO_PUBLIC_DEMO_VIDEO === '1';
  const base: HostStats = video
    ? withSale({ ...preview, source: 'live' }, { key: 'you', who: 'nithin', item: SHORT.hoodie, edition: 'was_there', amountCents: priceOf('hoodie'), at: (preview.recent[0]?.at ?? 0) + 30_000 })
    : (live ?? preview);
  let stats = injected.reduceRight((s, sale) => withSale(s, sale), base);
  if (paidOut) stats = { ...stats, feeBalanceCents: Math.max(0, stats.feeBalanceCents - paidOut) };

  const inject = useCallback(() => setInjected((cur) => [fakeSale(), ...cur].slice(0, 20)), []);
  const markPaidOut = useCallback((p: Payout) => {
    if (p.preview) setPaidOut((cur) => cur + p.amountCents);
  }, []);

  return { stats, inject, markPaidOut };
}

// ---------------------------------------------------------------------------------------------
// Payout

export async function requestPayout(userId: string, previewAmountCents: number): Promise<Result<Payout>> {
  const res = await request<{ transferId?: unknown; amountCents?: unknown }>('hostPayout', { userId });
  if (res.ok && typeof res.value?.transferId === 'string') {
    return { ok: true, value: { transferId: res.value.transferId, amountCents: num(res.value.amountCents), preview: false } };
  }
  if (!res.ok && res.reason !== 'soon') return res;
  // Not deployed yet: rehearse the moment, clearly marked, no money moves.
  return { ok: true, value: { transferId: 'preview', amountCents: previewAmountCents, preview: true } };
}
