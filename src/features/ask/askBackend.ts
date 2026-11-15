import { tryCall } from '@/lib/data/convexHttp';
import type { Trip } from '@/lib/types';

import { answerLocally, type AskAnswer } from './localAnswer';

// Calls the Convex action ask:question (Claude + Supermemory, docs/CAPY.md Thread 9).
// Any error, timeout, missing deploy or odd shape falls back to the on-device
// answerer so the demo never waits on the network.

const TIMEOUT_MS = 6000;

export type AskResult = AskAnswer & { source: 'claude' | 'device' };

function isAnswer(v: unknown): v is AskAnswer {
  const a = v as AskAnswer;
  return !!a && typeof a.answer === 'string' && a.answer.trim().length > 0 && Array.isArray(a.momentIds);
}

export async function askQuestion(trip: Trip, question: string): Promise<AskResult> {
  const res = await tryCall<unknown>('askQuestion', { tripId: trip.id, question }, { timeoutMs: TIMEOUT_MS });
  if (res.ok && isAnswer(res.value)) {
    const known = new Set(trip.moments.map((m) => m.id));
    return {
      answer: res.value.answer.trim(),
      momentIds: res.value.momentIds.filter((id) => typeof id === 'string' && known.has(id)),
      source: 'claude',
    };
  }
  return { ...answerLocally(trip, question), source: 'device' };
}
