// Incoming gifts: gifts:forUser { userId } polled on Home (contract: docs/WHOP.md §2).
// Gifts appear only after the sender's Whop payment lands (the webhook inserts the row).

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { tryCall } from '@/lib/data/convexHttp';
import { getIdentity } from '@/lib/data/identity';

import { myUserId, productNoun, type Product } from './checkout';

export type Gift = {
  giftId: string;
  orderId: string;
  fromName: string;
  product: Product;
  variant: string | null;
  tripTitle: string;
  placeName: string | null;
  previewUrl: string | null;
  downloadUrl: string | null;
  shipsInDays: [number, number] | null;
  createdAt: number;
  seen: boolean;
};

function normalize(raw: unknown): Gift | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  if (typeof g.giftId !== 'string') return null;
  const str = (k: string) => (typeof g[k] === 'string' ? (g[k] as string) : null);
  return {
    giftId: g.giftId,
    orderId: str('orderId') ?? '',
    fromName: str('fromName') ?? 'a friend',
    product: (str('product') ?? 'print') as Product,
    variant: str('variant'),
    tripTitle: str('tripTitle') ?? 'your day',
    placeName: str('placeName'),
    previewUrl: str('previewUrl'),
    downloadUrl: str('downloadUrl'),
    shipsInDays: Array.isArray(g.shipsInDays) && g.shipsInDays.length === 2 ? (g.shipsInDays as [number, number]) : null,
    createdAt: typeof g.createdAt === 'number' ? g.createdAt : 0,
    seen: g.seen === true,
  };
}

/** "nithin sent you a print of lunch on 3rd st" */
export function giftLine(g: Gift): string {
  const what = productNoun(g.product, g.variant);
  const of = (g.placeName ?? g.tripTitle).toLowerCase();
  return `${g.fromName.toLowerCase()} sent you ${what === 'film' ? 'the film' : `a ${what}`} of ${of}`;
}

// Gifts dismissed this session, so a slow markSeen doesn't bring the banner back.
const dismissed = new Set<string>();

export async function markGiftSeen(giftId: string): Promise<void> {
  dismissed.add(giftId);
  await tryCall('giftsMarkSeen', { giftId });
}

export async function fetchGifts(): Promise<Gift[] | null> {
  const userId = getIdentity().userId ?? (await myUserId());
  if (!userId) return null;
  const res = await tryCall<unknown[]>('giftsForUser', { userId });
  if (!res.ok || !Array.isArray(res.value)) return null;
  return res.value.map(normalize).filter((g): g is Gift => g !== null);
}

/** All gifts plus the newest unseen one, polled every `ms` while foregrounded. */
export function useGifts(ms = 5000): { gifts: Gift[]; unseen: Gift | undefined; dismiss: (id: string) => void } {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [, bump] = useState(0);
  const last = useRef('');

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const next = await fetchGifts();
      if (!alive || !next) return;
      const key = JSON.stringify(next);
      if (key === last.current) return;
      last.current = key;
      setGifts(next);
    };
    void tick();
    let timer: ReturnType<typeof setInterval> | undefined = setInterval(tick, ms);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void tick();
        if (!timer) timer = setInterval(tick, ms);
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
  }, [ms]);

  const dismiss = useCallback((id: string) => {
    void markGiftSeen(id);
    bump((v) => v + 1);
  }, []);

  const unseen = gifts.find((g) => !g.seen && !dismissed.has(g.giftId));
  return { gifts, unseen, dismiss };
}
