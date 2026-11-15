import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { backendStatus, tryCall } from './convexHttp';
import { DEMO_REMOTE_USER_ID } from './paths';

export type BackendState = 'checking' | 'live' | 'offline';

const PROBE_MS = 15_000;

const current = (): BackendState =>
  backendStatus.live ? 'live' : backendStatus.reachable === undefined ? 'checking' : 'offline';

/** Cheap probe: lists the seeded demo user's trips (a read-only query). */
export function probeBackend(): Promise<void> {
  return tryCall('tripsList', { userId: DEMO_REMOTE_USER_ID }).then(() => undefined);
}

/**
 * "live" when the deployment answers and trips:list works; "offline" otherwise.
 * Updates from every Convex call the app makes, plus a probe every 15 s while foregrounded.
 */
export function useBackendStatus(): BackendState {
  const [state, setState] = useState<BackendState>(current);

  useEffect(() => {
    const unsub = backendStatus.subscribe(() => setState(current()));
    if (backendStatus.reachable === undefined) void probeBackend();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void probeBackend();
    }, PROBE_MS);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  return state;
}
