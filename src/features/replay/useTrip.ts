import { useMemo } from 'react';

import { bestKnownTrip, useTripById } from '@/lib/data/trips';
import { demoTrip, getDemoMoment } from '@/lib/demo/demoTrip';
import type { Moment, Trip } from '@/lib/types';

// Live Convex trip first (polled), then the trip ingested this session, then the demo trip.
// See src/lib/data/trips.ts for the fallback order.
export function loadTrip(id?: string): Trip {
  return bestKnownTrip(id).trip;
}

export function useTrip(id?: string): Trip {
  return useTripById(id).data;
}

export function sortedMoments(trip: Trip): Moment[] {
  return [...trip.moments].sort((a, b) => a.order - b.order);
}

export function useMoment(momentId?: string, tripId?: string): { trip: Trip; moment?: Moment } {
  const { data: trip } = useTripById(tripId);
  return useMemo(() => {
    const moment = trip.moments.find((m) => m.id === momentId);
    if (moment || !momentId) return { trip, moment };
    // A local demo stop id ("m1") opened while the live demo trip is showing: fall back to the local demo.
    const demoMoment = getDemoMoment(momentId);
    return demoMoment ? { trip: demoTrip, moment: demoMoment } : { trip, moment };
  }, [momentId, trip]);
}
