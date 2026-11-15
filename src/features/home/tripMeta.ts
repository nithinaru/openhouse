import type { Photo, Trip } from '@/lib/types';
import { colors, tintFor } from '@/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function timeLabel(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Sun, Nov 15 · 9:00 AM – 5:12 PM" */
export function dateLabel(trip: Trip): string {
  const d = new Date(trip.startAt);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} · ${timeLabel(trip.startAt)} – ${timeLabel(trip.endAt)}`;
}

export function photoCount(trip: Trip): number {
  return trip.moments.reduce((n, m) => n + m.photos.length, 0);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function statsLabel(trip: Trip): string {
  const parts = [plural(trip.moments.length, 'stop'), plural(photoCount(trip), 'photo')];
  if (trip.people.length) parts.push(plural(trip.people.length, 'person', 'people'));
  return parts.join(' · ');
}

/** Hero photo of each stop, in order, up to `n`; topped up with other photos if there are few stops. */
export function collagePhotos(trip: Trip, n = 3): Photo[] {
  const ordered = [...trip.moments].sort((a, b) => a.order - b.order);
  const heroes = ordered
    .map((m) => m.photos.find((p) => p.id === m.heroPhotoId) ?? m.photos[0])
    .filter((p): p is Photo => !!p);
  const out = heroes.slice(0, n);
  if (out.length < n) {
    for (const m of ordered) for (const p of m.photos) if (out.length < n && !out.includes(p)) out.push(p);
  }
  return out;
}

/**
 * Ingested trips have no extracted palette yet; derive one from the light of each stop
 * so every card still gets swatches.
 */
export function paletteFor(trip: Trip): string[] {
  if (trip.palette.length) return trip.palette.slice(0, 5);
  const tints = [...trip.moments]
    .sort((a, b) => a.order - b.order)
    .map((m) => tintFor(new Date(m.startAt).getHours(), m.isGoldenHour));
  return [...new Set([...tints, colors.accent, colors.text])].slice(0, 5);
}
