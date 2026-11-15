import { useMemo } from 'react';

import { getDemoTrip } from '@/lib/demo/demoTrip';
import type { Moment, Trip } from '@/lib/types';

// TODO: once '@/lib/ingest/store' lands, try `getTrip(id)` from it first and
// fall back to the demo trip only when it returns nothing:
//   import { getTrip } from '@/lib/ingest/store';
//   return getTrip(id) ?? getDemoTrip(id);
export function loadTrip(id?: string): Trip {
  return getDemoTrip(id);
}

export function useTrip(id?: string): Trip {
  return useMemo(() => loadTrip(id), [id]);
}

export function sortedMoments(trip: Trip): Moment[] {
  return [...trip.moments].sort((a, b) => a.order - b.order);
}

export function useMoment(momentId?: string, tripId?: string): { trip: Trip; moment?: Moment } {
  return useMemo(() => {
    const trip = loadTrip(tripId);
    return { trip, moment: trip.moments.find((m) => m.id === momentId) };
  }, [momentId, tripId]);
}
