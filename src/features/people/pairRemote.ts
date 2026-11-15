// App-only half of pairing: calls Convex pairings:pair and registers itself with ./pair.
// Kept out of pair.ts because convex/seed.ts bundles that file.

import { tryCall } from '@/lib/data/convexHttp';
import { ensureRemoteUser } from '@/lib/data/identity';

import { demoPair, registerRemotePair, type PairResult } from './pair';

type PairResponse = { pairingId: string; friendName: string; shareCode: string };

registerRemotePair(async (code, lat, lng): Promise<PairResult | null> => {
  const me = await ensureRemoteUser();
  if (!me.userId) return null; // backend never answered users:ensure
  const res = await tryCall<PairResponse>('pairingsPair', { userId: me.userId, code, lat, lng });
  if (!res.ok || typeof res.value?.friendName !== 'string') return null;
  // The backend has no avatars yet; reuse the demo face when the code is a known one.
  const known = demoPair(code);
  return {
    friendName: res.value.friendName,
    shareCode: res.value.shareCode || code,
    avatarUri: known.avatarUri,
  };
});
