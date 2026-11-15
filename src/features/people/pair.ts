// QR pairing (BUILD.md §5.6).

export const PAIR_PREFIX = 'openhouse://pair/';

// TODO(convex): replace with the signed-in user's shareCode from api.users.me.
export const DEMO_MY_SHARE_CODE = 'ME7Q2K';

export function pairUrl(shareCode: string): string {
  return `${PAIR_PREFIX}${shareCode}`;
}

/** Pulls the share code out of a scanned QR. Accepts openhouse://pair/<code> or a URL ending in /pair/<code>. */
export function parsePairCode(data: string): string | null {
  const m = data.trim().match(/\/pair\/([A-Za-z0-9_-]{4,32})\/?$/);
  return m ? m[1].toUpperCase() : null;
}

export type PairResult = { friendName: string; shareCode: string };

/**
 * TODO(convex): replace with the Convex mutation:
 *   const pairMutation = useMutation(api.pairings.pair);
 *   return await pairMutation({ code, lat, lng });
 * The mutation should return the friend's name so the success state can show it.
 */
export async function pair(code: string, lat: number, lng: number): Promise<PairResult> {
  console.log('[pair] stub', { code, lat, lng });
  const friendName = code === 'RHN42X' ? 'Rohan' : 'New friend';
  return { friendName, shareCode: code };
}
