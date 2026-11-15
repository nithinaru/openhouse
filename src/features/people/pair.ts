// QR pairing (BUILD.md §5.6).
//
// convex/seed.ts imports this file, so it must stay free of '@/' and Expo imports. The live
// Convex call (pairings:pair) lives in ./pairRemote.ts, which registers itself here when the
// app loads it; seed and tests only ever see the demo stub.

import { getDemoTrip } from '../../lib/demo/demoTrip';

export const PAIR_PREFIX = 'openhouse://pair/';

// TODO(convex): replace with the signed-in user's shareCode from api.users.me.
export const DEMO_MY_SHARE_CODE = 'ME7Q2K';
// TODO(convex): replace with the signed-in user's name from api.users.me.
export const DEMO_MY_NAME = 'Nithin';

export function pairUrl(shareCode: string): string {
  return `${PAIR_PREFIX}${shareCode}`;
}

/** Pulls the share code out of a scanned QR. Accepts openhouse://pair/<code> or a URL ending in /pair/<code>. */
export function parsePairCode(data: string): string | null {
  const m = data.trim().match(/\/pair\/([A-Za-z0-9_-]{4,32})\/?$/);
  return m ? m[1].toUpperCase() : null;
}

export type PairResult = { friendName: string; shareCode: string; avatarUri?: string };

/** Live pairing (Convex). Resolves null when the backend can't pair, so the stub takes over. */
export type RemotePair = (code: string, lat: number, lng: number) => Promise<PairResult | null>;

let remotePair: RemotePair | null = null;

/** Called once by ./pairRemote.ts in the app. */
export function registerRemotePair(fn: RemotePair): void {
  remotePair = fn;
}

/** Demo answer from the cached trip: known share codes map to their person. */
export function demoPair(code: string): PairResult {
  const known = getDemoTrip().people.find((p) => p.shareCode === code);
  return { friendName: known?.name ?? 'New friend', shareCode: code, avatarUri: known?.avatarUri };
}

/** Pairs with the person whose code was scanned: Convex first, the demo stub on any failure. */
export async function pair(code: string, lat: number, lng: number): Promise<PairResult> {
  if (remotePair) {
    try {
      const live = await remotePair(code, lat, lng);
      if (live) return live;
    } catch (e) {
      console.warn('[pair] live pairing failed, using demo', e);
    }
  }
  return demoPair(code);
}
