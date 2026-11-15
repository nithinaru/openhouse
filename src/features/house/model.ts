// Pure helpers for the house view: who stood where at a given time of day.

import { HOUSE_PEOPLE, ROOMS, roomForMoment, type HousePerson, type Room } from '@/lib/demo/demoHouse';
import type { Moment, Trip } from '@/lib/types';

/** The moment a person was at at time `t`, or null before they arrived. */
export function personMomentAt(person: HousePerson, t: number): string | null {
  let cur: string | null = null;
  for (const s of person.trail) {
    if (s.at <= t) cur = s.momentId;
    else break;
  }
  return cur;
}

/** The stop happening at `t` (or the last one that started before it). */
export function activeMoment(trip: Trip, t: number): Moment | undefined {
  let best: Moment | undefined;
  for (const m of trip.moments) if (m.startAt <= t) best = m;
  return best ?? trip.moments[0];
}

export type Placement = { person: HousePerson; room: Room; index: number; count: number };

/** Everyone placed at `t`, grouped by room so standees in one room stand side by side. */
export function placementsAt(t: number): Placement[] {
  const byRoom = new Map<string, HousePerson[]>();
  for (const p of HOUSE_PEOPLE) {
    const m = personMomentAt(p, t);
    const room = m ? roomForMoment(m) : undefined;
    if (!room) continue;
    byRoom.set(room.key, [...(byRoom.get(room.key) ?? []), p]);
  }
  const out: Placement[] = [];
  for (const [key, people] of byRoom) {
    const room = ROOMS.find((r) => r.key === key)!;
    people.forEach((person, index) => out.push({ person, room, index, count: people.length }));
  }
  return out;
}

/** Sticker count for a room at `t`: photos grow as the day fills in, full once its stops end. */
export function framesAt(trip: Trip, room: Room, t: number): number {
  const moments = trip.moments.filter((m) => room.momentIds.includes(m.id));
  const total = moments.reduce((s, m) => s + (m.endAt - m.startAt), 0) || 1;
  const seen = moments.reduce((s, m) => s + Math.max(0, Math.min(t, m.endAt) - m.startAt), 0);
  return Math.round(room.frames * Math.min(1, seen / total));
}

/** Which of a room's moments to open when its sticker is tapped at `t`. */
export function momentForRoom(trip: Trip, room: Room, t: number): string {
  const moments = trip.moments.filter((m) => room.momentIds.includes(m.id));
  const started = moments.filter((m) => m.startAt <= t);
  return (started[started.length - 1] ?? moments[0])?.id ?? room.momentIds[0];
}

export function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

export function peopleCopy(n: number): string {
  if (n === 0) return 'nobody here yet';
  return n === 1 ? '1 person stood here' : `${n} people stood here`;
}
