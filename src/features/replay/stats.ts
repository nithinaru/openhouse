import type { Moment, Trip } from '@/lib/types';

import { distanceM, peopleAt } from './people';

export type TripStats = {
  distanceLabel: string;
  stops: number;
  people: number;
  photos: number;
};

export function tripStats(trip: Trip, moments: Moment[]): TripStats {
  let metres = 0;
  for (let i = 1; i < moments.length; i++) {
    const a = moments[i - 1];
    const b = moments[i];
    metres += distanceM(a.lat, a.lng, b.lat, b.lng);
  }
  const miles = metres / 1609.34;
  const distanceLabel = miles >= 0.1 ? `${miles.toFixed(1)} mi` : `${Math.round(metres * 3.281)} ft`;
  const people = new Set(moments.flatMap((m) => peopleAt(trip, m.id).map((p) => p.id))).size;
  const photos = moments.reduce((n, m) => n + m.photos.length, 0);
  return { distanceLabel, stops: moments.length, people, photos };
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
