import { useMemo } from 'react';

import { getDemoTrip } from '@/lib/demo/demoTrip';
import { getTrip } from '@/lib/ingest/store';
import type { Moment, Trip } from '@/lib/types';

// Ingested trip from this session first, demo trip otherwise.
// TODO: swap for the Convex trips.get query once it lands.
export function loadTrip(id?: string): Trip {
  return (id ? getTrip(id) : undefined) ?? getDemoTrip(id);
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
