import * as Notifications from 'expo-notifications';

import { call, ConvexCallError, CONVEX_URL } from '@/lib/data/convexHttp';
import { DEMO_REMOTE_USER_ID } from '@/lib/data/paths';
import { plural } from '@/features/replay/stats';
import type { Trip } from '@/lib/types';

// Rehearsal helpers for the demo panel. Never throw.

export type BackendStatus =
  | { state: 'checking' }
  | { state: 'online'; ms: number; trips: number | null; note?: string }
  | { state: 'offline'; reason: string };

export const backendHost = CONVEX_URL.replace(/^https?:\/\//, '');

/** Probes the Convex HTTP API with the trips:list query (seeded demo user). */
export async function probeBackend(): Promise<BackendStatus> {
  const t0 = Date.now();
  try {
    const value = await call<unknown>('tripsList', { userId: DEMO_REMOTE_USER_ID }, { timeoutMs: 4000 });
    return { state: 'online', ms: Date.now() - t0, trips: Array.isArray(value) ? value.length : null };
  } catch (e) {
    // The deployment answered with an app error: it is up, the query just didn't like the args.
    if (e instanceof ConvexCallError && (e.kind === 'server' || e.kind === 'missing')) {
      return { state: 'online', ms: Date.now() - t0, trips: null, note: e.kind === 'missing' ? 'trips:list not deployed' : 'query errored' };
    }
    const kind = e instanceof ConvexCallError ? e.kind : 'network';
    return { state: 'offline', reason: kind === 'timeout' ? 'timed out' : kind === 'network' ? 'no connection' : kind };
  }
}

let handlerSet = false;

/** Schedules the Keiki-style "your day is ready" text as a local notification in 3 s. */
export async function scheduleKeikiText(trip: Trip): Promise<'scheduled' | 'denied' | 'failed'> {
  try {
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) {
      perm = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    }
    if (!perm.granted) return 'denied';
    if (!handlerSet) {
      handlerSet = true;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    }
    const people = trip.people.length;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Wish You Were Here',
        body: `Your ${trip.title} is ready — ${plural(trip.moments.length, 'stop')}, ${people} ${people === 1 ? 'person' : 'people'}`,
        sound: true,
        data: { tripId: trip.id, url: `/trip/${trip.id}` },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
    });
    return 'scheduled';
  } catch {
    return 'failed';
  }
}
