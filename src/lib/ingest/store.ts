import type { Trip } from '../types';

// Tiny module-level store so the Replay screen can read the trip onboarding just ingested.
// Lives only for the app session; swap for Convex once the backend lands.

const trips = new Map<string, Trip>();
let latestId: string | undefined;

export function setTrip(trip: Trip): void {
  trips.delete(trip.id); // re-insert so Map order stays oldest -> newest write
  trips.set(trip.id, trip);
  latestId = trip.id;
}

export function getTrip(id: string): Trip | undefined {
  return trips.get(id);
}

export function getLatestTrip(): Trip | undefined {
  return latestId ? trips.get(latestId) : undefined;
}

/** Every ingested trip this session, most recently written first. */
export function getAllTrips(): Trip[] {
  return [...trips.values()].reverse();
}
