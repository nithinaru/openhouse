import { tryCall } from '@/lib/data/convexHttp';
import { DEMO_REMOTE_TRIP_ID } from '@/lib/data/paths';
import { getRemoteTripId } from '@/lib/data/sync';
import { isDemoTripId } from '@/lib/data/trips';
import type { Trip } from '@/lib/types';

import { answerLocally, type AskAnswer } from './localAnswer';

// Calls the Convex action ask:question (Claude + Supermemory, docs/CAPY.md Thread 9).
// Any error, timeout, missing deploy or odd shape falls back to the on-device
// answerer so the demo never waits on the network.

const TIMEOUT_MS = 6000;

export type AskResult = AskAnswer & { source: 'claude' | 'device' };

type RemoteAnswer = AskAnswer & { momentOrders?: unknown };

function isAnswer(v: unknown): v is RemoteAnswer {
  const a = v as AskAnswer;
  return !!a && typeof a.answer === 'string' && a.answer.trim().length > 0 && Array.isArray(a.momentIds);
}

/** The Convex trip id behind a route id: the seeded demo trip, a synced local trip, or itself. */
function backendTripId(id: string): string {
  if (isDemoTripId(id)) return DEMO_REMOTE_TRIP_ID;
  return getRemoteTripId(id) ?? id;
}

export async function askQuestion(trip: Trip, question: string): Promise<AskResult> {
  const res = await tryCall<unknown>('askQuestion', { tripId: backendTripId(trip.id), question }, { timeoutMs: TIMEOUT_MS });
  if (res.ok && isAnswer(res.value)) {
    const known = new Set(trip.moments.map((m) => m.id));
    let momentIds = res.value.momentIds.filter((id): id is string => typeof id === 'string' && known.has(id));
    // A local copy of the trip (e.g. the bundled demo) has different ids; map citations by stop order.
    if (!momentIds.length && Array.isArray(res.value.momentOrders)) {
      const byOrder = new Map(trip.moments.map((m) => [m.order, m.id]));
      momentIds = res.value.momentOrders.map((o) => byOrder.get(o as number)).filter((id): id is string => !!id);
    }
    return { answer: res.value.answer.trim(), momentIds, source: 'claude' };
  }
  return { ...answerLocally(trip, question), source: 'device' };
}
