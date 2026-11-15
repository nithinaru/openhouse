// Trip data with fallbacks: live Convex -> this session's ingest store -> cached demo trip.
// Polls every ~3 s while live (swap for the convex client's useQuery for realtime later).
// Polling never re-renders on identical data, so Replay isn't restarted by a no-op poll.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { DEMO_TRIP_ID, demoTrip } from '../demo/demoTrip';
import { getAllTrips, getTrip } from '../ingest/store';
import type { Trip } from '../types';
import { backendStatus, tryCall } from './convexHttp';
import { ensureRemoteUser, getIdentity } from './identity';
import { mergeEnrichment, normalizeTrip, sameData } from './normalize';
import { DEMO_REMOTE_TRIP_ID, DEMO_REMOTE_USER_ID } from './paths';
import { getRemoteTripId, localIdForRemote, onRemoteIdsChange } from './sync';

export type DataSource = 'live' | 'local' | 'demo';
export type DataResult<T> = { data: T; source: DataSource; loading: boolean; refresh: () => void };

export const POLL_MS = 3000;
const MAX_LIVE_TRIPS = 8;
/** Re-fetch full trips (not just headers) every Nth poll to pick up enrichment. */
const FULL_REFRESH_EVERY = 5;

export const isDemoTripId = (id: string | undefined): boolean => id === DEMO_TRIP_ID || id === DEMO_REMOTE_TRIP_ID;

// ---------------------------------------------------------------------------------------------
// Module cache of live trips, so synchronous readers (loadTrip / useMoment) see live data too.

const liveTrips = new Map<string, Trip>();

export function getCachedLiveTrip(remoteId: string): Trip | undefined {
  return liveTrips.get(remoteId);
}

async function fetchLiveTrip(remoteId: string): Promise<Trip | null | undefined> {
  const res = await tryCall<unknown>('tripsGet', { id: remoteId });
  if (!res.ok) return undefined; // unknown (offline / error)
  const trip = normalizeTrip(res.value);
  if (!trip) {
    liveTrips.delete(remoteId);
    return null; // definitively not on the server
  }
  liveTrips.set(remoteId, trip);
  return trip;
}

/** Which remote trip (if any) backs a route id, and what to show without the network. */
function resolve(id: string | undefined): { remoteId?: string; local?: Trip } {
  if (!id || isDemoTripId(id)) return { remoteId: DEMO_REMOTE_TRIP_ID };
  const local = getTrip(id);
  if (local) return { remoteId: getRemoteTripId(id), local };
  const localId = localIdForRemote(id);
  return { remoteId: id, local: localId ? getTrip(localId) : undefined };
}

/** Synchronous best-known trip for a route id. Always returns something (the demo at worst). */
export function bestKnownTrip(id: string | undefined): { trip: Trip; source: DataSource } {
  const { remoteId, local } = resolve(id);
  const live = remoteId ? liveTrips.get(remoteId) : undefined;
  if (local) return { trip: live ? mergeEnrichment(local, live) : local, source: live ? 'live' : 'local' };
  if (live) return { trip: live, source: 'live' };
  return { trip: demoTrip, source: 'demo' };
}

// ---------------------------------------------------------------------------------------------
// Polling helper: interval while the app is foregrounded.

function usePoll(fn: () => Promise<void>, ms: number, enabled = true): () => void {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const running = useRef(false);

  const tick = useCallback(() => {
    if (running.current) return;
    running.current = true;
    fnRef
      .current()
      .catch(() => undefined)
      .finally(() => {
        running.current = false;
      });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    tick();
    let timer: ReturnType<typeof setInterval> | undefined = setInterval(tick, ms);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        tick();
        if (!timer) timer = setInterval(tick, ms);
      } else if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
    });
    return () => {
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [enabled, ms, tick]);

  return tick;
}

// ---------------------------------------------------------------------------------------------
// useTripById

export function useTripById(id: string | undefined): DataResult<Trip> {
  const [state, setState] = useState(() => ({ ...bestKnownTrip(id), loading: resolve(id).remoteId !== undefined }));
  const [mapVersion, setMapVersion] = useState(0);

  // An ingested trip gets its remote id a few seconds after upload starts.
  useEffect(() => onRemoteIdsChange(() => setMapVersion((v) => v + 1)), []);

  const apply = useCallback(
    (next: { trip: Trip; source: DataSource; loading: boolean }) =>
      setState((prev) =>
        prev.source === next.source && prev.loading === next.loading && sameData(prev.trip, next.trip) ? prev : next,
      ),
    [],
  );

  // Route id changed: show the best local answer immediately (state reset during render).
  const [trackedId, setTrackedId] = useState(id);
  if (trackedId !== id) {
    setTrackedId(id);
    setState({ ...bestKnownTrip(id), loading: resolve(id).remoteId !== undefined });
  }

  const { remoteId } = resolve(id);
  const refresh = usePoll(
    async () => {
      if (!remoteId) return;
      await fetchLiveTrip(remoteId);
      apply({ ...bestKnownTrip(id), loading: false });
    },
    POLL_MS,
    remoteId !== undefined,
  );
  // Re-run when an upload maps this local trip to a remote one.
  useEffect(() => {
    if (mapVersion) refresh();
  }, [mapVersion, refresh]);

  return { data: state.trip, source: state.source, loading: state.loading, refresh };
}

// ---------------------------------------------------------------------------------------------
// useTrips: the Home list. Own trips (local + live), then the demo trip last.

type TripHeader = { id: string; title?: string; status?: string; startAt?: number; endAt?: number };

function compose(liveMine: Trip[] | undefined): { trips: Trip[]; source: DataSource } {
  const locals = getAllTrips().map((t) => bestKnownTrip(t.id).trip);
  const mappedRemote = new Set(getAllTrips().map((t) => getRemoteTripId(t.id)).filter(Boolean));
  const live = (liveMine ?? []).filter((t) => !mappedRemote.has(t.id) && !isDemoTripId(t.id));
  const liveDemo = liveTrips.get(DEMO_REMOTE_TRIP_ID);
  const trips = [...locals, ...live, liveDemo ?? demoTrip];
  const hasLive = backendStatus.live && (liveMine !== undefined || liveDemo !== undefined);
  const source: DataSource = hasLive ? 'live' : locals.length ? 'local' : 'demo';
  return { trips, source };
}

export function useTrips(): DataResult<Trip[]> {
  const [state, setState] = useState(() => ({ ...compose(undefined), loading: true }));
  const liveMine = useRef<Trip[] | undefined>(undefined);
  const headers = useRef(new Map<string, string>());
  const polls = useRef(0);

  const apply = useCallback((loading: boolean) => {
    const next = { ...compose(liveMine.current), loading };
    setState((prev) =>
      prev.source === next.source && prev.loading === next.loading && sameData(prev.trips, next.trips) ? prev : next,
    );
  }, []);

  const poll = usePoll(async () => {
    const full = polls.current++ % FULL_REFRESH_EVERY === 0;
    const me = getIdentity().userId ? getIdentity() : await ensureRemoteUser();
    const [mine, demo] = await Promise.all([
      me.userId ? tryCall<TripHeader[]>('tripsList', { userId: me.userId }) : Promise.resolve(undefined),
      tryCall<TripHeader[]>('tripsList', { userId: DEMO_REMOTE_USER_ID }),
    ]);

    // Demo: the seeded trip if it's listed (or by id if the list call failed for another reason).
    const demoHeaders = demo.ok && Array.isArray(demo.value) ? demo.value : [];
    const demoHeader = demoHeaders.find((h) => h.id === DEMO_REMOTE_TRIP_ID) ?? demoHeaders[0];
    const toFetch: TripHeader[] = [];
    if (demoHeader) toFetch.push(demoHeader);
    else if (backendStatus.reachable) toFetch.push({ id: DEMO_REMOTE_TRIP_ID });

    const mineHeaders = mine?.ok && Array.isArray(mine.value) ? mine.value.slice(0, MAX_LIVE_TRIPS) : undefined;
    for (const h of mineHeaders ?? []) toFetch.push(h);

    await Promise.all(
      toFetch.map(async (h) => {
        const key = JSON.stringify(h);
        if (!full && liveTrips.has(h.id) && headers.current.get(h.id) === key) return;
        const got = await fetchLiveTrip(h.id);
        if (got !== undefined) headers.current.set(h.id, key);
      }),
    );

    // Keep the last good list through a transient failure.
    if (mineHeaders) {
      liveMine.current = mineHeaders.map((h) => liveTrips.get(h.id)).filter((t): t is Trip => t !== undefined);
    }
    apply(false);
  }, POLL_MS);

  useEffect(() => onRemoteIdsChange(() => apply(false)), [apply]);

  const refresh = useCallback(() => {
    apply(false); // re-read the session ingest store right away
    poll();
  }, [apply, poll]);

  return { data: state.trips, source: state.source, loading: state.loading, refresh };
}
