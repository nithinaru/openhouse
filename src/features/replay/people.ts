import type { Moment, Pairing, Person, Trip } from '@/lib/types';

// Rough metres between two coords (equirectangular; fine at city scale).
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const x = (bLng - aLng) * rad * Math.cos(((aLat + bLat) / 2) * rad);
  const y = (bLat - aLat) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

// Which stop a pairing belongs to: its momentId, else the nearest stop.
export function pairingMomentId(pairing: Pairing, moments: Moment[]): string | undefined {
  if (pairing.momentId) return pairing.momentId;
  let best: Moment | undefined;
  let bestD = Infinity;
  for (const m of moments) {
    const d = distanceM(pairing.lat, pairing.lng, m.lat, m.lng);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best?.id;
}

export function personFor(trip: Trip, pairing: Pairing): Person | undefined {
  const otherId = pairing.userA === trip.userId ? pairing.userB : pairing.userA;
  return trip.people.find((p) => p.id === otherId);
}

export function peopleAt(trip: Trip, momentId: string): Person[] {
  const out: Person[] = [];
  for (const pairing of trip.pairings) {
    if (pairingMomentId(pairing, trip.moments) !== momentId) continue;
    const person = personFor(trip, pairing);
    if (person && !out.some((p) => p.id === person.id)) out.push(person);
  }
  return out;
}
