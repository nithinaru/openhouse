import type { Trip } from '../types';

// Tiny module-level store so the Replay screen can read the trip onboarding just ingested.
// Lives only for the app session; swap for Convex once the backend lands.

const trips = new Map<string, Trip>();
let latestId: string | undefined;

export function setTrip(trip: Trip): void {
  trips.set(trip.id, trip);
  latestId = trip.id;
}

export function getTrip(id: string): Trip | undefined {
  return trips.get(id);
}

export function getLatestTrip(): Trip | undefined {
  return latestId ? trips.get(latestId) : undefined;
}
