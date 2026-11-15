// Whop checkout for everything Openhouse sells (contract: docs/WHOP.md).
//
// One pattern for every product: a Convex action makes a Whop sandbox checkout and returns a
// purchase url, the app opens it in an in-app browser, then polls a Convex query until the
// /whop webhook has written the paid state. The browser closing never means "paid".

import * as WebBrowser from 'expo-web-browser';

import { tryCall, type ConvexCallError } from '@/lib/data/convexHttp';
import { ensureRemoteUser } from '@/lib/data/identity';
import { DEMO_REMOTE_TRIP_ID, DEMO_REMOTE_USER_ID, type FnName } from '@/lib/data/paths';
import { isDemoTripId } from '@/lib/data/trips';

// ---------------------------------------------------------------------------------------------
// Results

/** Why a call couldn't give us an answer. `soon` = the backend function isn't deployed yet. */
export type Unavailable = 'soon' | 'offline' | 'error';

export type Result<T> = { ok: true; value: T } | { ok: false; reason: Unavailable; message: string };

export type CheckoutStart = { url: string; orderId: string };

const COPY: Record<Unavailable, string> = {
  soon: 'coming online. whop checkout for this lands with the next backend deploy',
  offline: "can't reach wish you were here right now. try again in a moment",
  error: 'checkout hit a snag. try again',
};

/** Missing function, or a deployed function that doesn't accept the new args yet. */
function classify(error: ConvexCallError): Unavailable {
  if (error.kind === 'missing') return 'soon';
  if (error.kind === 'network' || error.kind === 'timeout') return 'offline';
  if (/ArgumentValidationError|extra field|does not match validator|Validator/i.test(error.message)) return 'soon';
  return 'error';
}

export function unavailable<T>(reason: Unavailable, message = COPY[reason]): Result<T> {
  return { ok: false, reason, message };
}

/** tryCall that maps every failure to a user-facing reason. Never throws. */
export async function request<T>(name: FnName, args: object): Promise<Result<T>> {
  const res = await tryCall<T>(name, args);
  if (res.ok) return { ok: true, value: res.value };
  return unavailable(classify(res.error));
}

function readCheckout(v: unknown, idKey: 'orderId' | 'checkoutId' = 'orderId'): CheckoutStart | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const url = o.purchaseUrl ?? o.purchase_url ?? o.url;
  const id = o[idKey] ?? o.orderId ?? o.checkoutId;
  if (typeof url !== 'string' || !/^https?:\/\//.test(url) || typeof id !== 'string') return null;
  return { url, orderId: id };
}

// ---------------------------------------------------------------------------------------------
// Who is buying

/** The Convex user for this device, or null when the backend hasn't answered users:ensure. */
export async function myUserId(): Promise<string | null> {
  const me = await ensureRemoteUser().catch(() => undefined);
  return me?.userId ?? null;
}

/** Demo trip buys as the seeded demo user against the seeded trip; real trips as me. */
async function buyerFor(tripId: string): Promise<{ userId: string; tripId: string } | null> {
  if (isDemoTripId(tripId)) return { userId: DEMO_REMOTE_USER_ID, tripId: DEMO_REMOTE_TRIP_ID };
  const userId = await myUserId();
  return userId ? { userId, tripId } : null;
}

// ---------------------------------------------------------------------------------------------
// Products

export type Product = 'print' | 'postcards' | 'zine' | 'film';
export type PosterStyle = 'minimal' | 'night' | 'field';
export type PrintSize = '12x16' | '18x24';

export type ProductInfo = {
  id: Product;
  name: string;
  /** Variant id -> price in cents. A product without variants uses key ''. */
  prices: Record<string, number>;
  variants?: { id: string; label: string }[];
  /** Shipping window in days for physical variants; null = digital. */
  ships: (variant?: string) => [number, number] | null;
};

export const PRODUCTS: Record<Product, ProductInfo> = {
  print: {
    id: 'print',
    name: 'framed print',
    prices: { '12x16': 3900, '18x24': 5900 },
    variants: [
      { id: '12x16', label: '12 × 16' },
      { id: '18x24', label: '18 × 24' },
    ],
    ships: () => [3, 5],
  },
  postcards: { id: 'postcards', name: 'postcard pack', prices: { '': 1800 }, ships: () => [4, 6] },
  zine: {
    id: 'zine',
    name: 'trip zine',
    prices: { digital: 1200, printed: 2900 },
    variants: [
      { id: 'digital', label: 'digital' },
      { id: 'printed', label: 'printed' },
    ],
    ships: (v) => (v === 'printed' ? [5, 7] : null),
  },
  film: { id: 'film', name: 'narrated film', prices: { '': 600 }, ships: () => null },
};

export function priceCents(product: Product, variant?: string): number {
  const p = PRODUCTS[product].prices;
  return p[variant ?? ''] ?? Object.values(p)[0];
}

/** 1800 -> "$18", 450 -> "$4.50" */
export function formatCents(cents: number): string {
  const d = cents / 100;
  return `$${Number.isInteger(d) ? d : d.toFixed(2)}`;
}

/** "print of lunch on 3rd st" style noun for gift copy. */
export function productNoun(product: Product, variant?: string | null): string {
  if (product === 'print') return 'print';
  if (product === 'postcards') return 'postcard pack';
  if (product === 'zine') return variant === 'printed' ? 'printed zine' : 'zine';
  return 'film';
}

// ---------------------------------------------------------------------------------------------
// orders:checkout / orders:get

export type CheckoutArgs = {
  product: Product;
  tripId: string;
  variant?: string;
  /** print only */
  style?: PosterStyle;
  /** print only */
  size?: PrintSize;
  momentId?: string;
  giftToShareCode?: string;
};

/**
 * Generic checkout for any product. A plain print (no gift, no stop) sends exactly the args the
 * live orders:checkout accepts today; everything else sends the extended contract args.
 */
export async function startCheckout(args: CheckoutArgs): Promise<Result<CheckoutStart>> {
  const buyer = await buyerFor(args.tripId);
  if (!buyer) return unavailable('offline');

  const isPlainPrint = args.product === 'print' && !args.giftToShareCode && !args.momentId;
  const size = args.size ?? (args.variant as PrintSize | undefined) ?? '12x16';
  const payload: Record<string, unknown> = isPlainPrint
    ? { ...buyer, style: args.style ?? 'minimal', size }
    : {
        ...buyer,
        product: args.product,
        ...(args.product === 'print' ? { style: args.style ?? 'minimal', size, variant: size } : {}),
        ...(args.product !== 'print' && args.variant ? { variant: args.variant } : {}),
        // Demo stop ids ("m3") don't exist server side; only send real ones.
        ...(args.momentId && !/^m\d+$/.test(args.momentId) ? { momentId: args.momentId } : {}),
        ...(args.giftToShareCode ? { giftToShareCode: args.giftToShareCode } : {}),
      };

  const res = await request<unknown>('ordersCheckout', payload);
  if (!res.ok) return res;
  const start = readCheckout(res.value);
  return start ? { ok: true, value: start } : unavailable('error');
}

export type OrderStatus = 'pending' | 'paid' | 'fulfilled' | 'refunded';

export type Order = {
  status: OrderStatus;
  product: Product;
  variant: string | null;
  shipsInDays: [number, number] | null;
  downloadUrl: string | null;
  giftTo: { name: string } | null;
};

/** Reads orders:get. Null when unknown or unreachable. Tolerates today's { status, size, style }. */
export async function getOrder(orderId: string): Promise<Order | null> {
  const res = await tryCall<Record<string, unknown> | null>('ordersGet', { orderId });
  if (!res.ok || !res.value || typeof res.value.status !== 'string') return null;
  const v = res.value;
  const product = (typeof v.product === 'string' ? v.product : 'print') as Product;
  const variant = typeof v.variant === 'string' ? v.variant : typeof v.size === 'string' ? v.size : null;
  const ships = Array.isArray(v.shipsInDays) && v.shipsInDays.length === 2 ? (v.shipsInDays as [number, number]) : null;
  const gift = v.giftTo && typeof v.giftTo === 'object' ? (v.giftTo as { name?: unknown }) : null;
  return {
    status: v.status as OrderStatus,
    product,
    variant,
    shipsInDays: ships ?? PRODUCTS[product]?.ships(variant ?? undefined) ?? null,
    downloadUrl: typeof v.downloadUrl === 'string' ? v.downloadUrl : null,
    giftTo: typeof gift?.name === 'string' ? { name: gift.name } : null,
  };
}

/** Back-compat: just the status. */
export async function getOrderStatus(orderId: string): Promise<'pending' | 'paid' | null> {
  const o = await getOrder(orderId);
  if (!o) return null;
  return o.status === 'paid' || o.status === 'fulfilled' ? 'paid' : 'pending';
}

export const isPaid = (o: Order | null): o is Order => o?.status === 'paid' || o?.status === 'fulfilled';

// ---------------------------------------------------------------------------------------------
// Polling

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });

/** Polls `read` until it returns a value, the signal aborts, or `timeoutMs` passes. */
export async function pollUntil<T>(
  read: () => Promise<T | null | undefined | false>,
  { timeoutMs = 90_000, everyMs = 2000, signal }: { timeoutMs?: number; everyMs?: number; signal?: AbortSignal } = {},
): Promise<T | null> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until && !signal?.aborted) {
    const v = await read().catch(() => null);
    if (v) return v;
    await sleep(everyMs, signal);
  }
  return null;
}

/** Polls the order until the webhook marks it paid. Resolves with the order record, or null. */
export function waitForOrder(orderId: string, opts?: { timeoutMs?: number; everyMs?: number; signal?: AbortSignal }) {
  return pollUntil(async () => {
    const o = await getOrder(orderId);
    return isPaid(o) ? o : null;
  }, opts);
}

/** Back-compat boolean form. */
export async function waitForPaid(orderId: string, timeoutMs = 90_000, everyMs = 2000): Promise<boolean> {
  return (await waitForOrder(orderId, { timeoutMs, everyMs })) !== null;
}

/** Opens a Whop purchase url in the in-app browser. Resolves when the sheet closes. */
export async function openCheckout(url: string): Promise<void> {
  await WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    dismissButtonStyle: 'close',
  }).catch(() => undefined);
}

export { readCheckout };
