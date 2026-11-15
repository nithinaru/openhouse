import type { Moment, Photo, Trip } from '../types';

// Cached demo trip so every screen works with no network and no photos.
// Swap for live Convex data once the backend lands.

const day = new Date('2026-11-15T09:00:00-08:00').getTime();
const h = (hours: number) => day + hours * 3600_000;

const img = (seed: string, w = 1024, hgt = 768) => `https://picsum.photos/seed/${seed}/${w}/${hgt}`;

function photos(momentId: string, seeds: string[], at: number, lat: number, lng: number, heading: number): Photo[] {
  return seeds.map((s, i) => ({
    id: `${momentId}-p${i}`,
    momentId,
    userId: 'me',
    takenAt: at + i * 60_000,
    lat,
    lng,
    headingDeg: (heading + i * 15) % 360,
    lens: i === 2 ? 'front' : 'wide',
    subtypes: i === 0 ? ['hdr'] : [],
    isFavorite: i === 0,
    uri: img(s),
    w: 1024,
    h: 768,
  }));
}

const stops: Omit<Moment, 'photos' | 'order' | 'tripId' | 'userId'>[] = [
  {
    id: 'm1',
    startAt: h(0),
    endAt: h(0.8),
    lat: 37.7609,
    lng: -122.388,
    placeName: 'YC, Dogpatch',
    headingDeg: 40,
    weather: { tempF: 58, summary: 'Fog lifting' },
    caption: 'Doors open, coffee line already long',
    narration: 'Nine in the morning in Dogpatch. The fog was still deciding whether to leave, and the coffee line was already out the door.',
  },
  {
    id: 'm2',
    startAt: h(1),
    endAt: h(3),
    lat: 37.7612,
    lng: -122.3876,
    placeName: 'Hacking floor',
    headingDeg: 210,
    caption: 'Kickoff, then heads down',
    fact: 'Dogpatch takes its name from the stray dogs that once roamed its shipyards.',
    narration: 'Kickoff ran long. By ten you had a repo, a name, and a plan written on the back of a lanyard.',
  },
  {
    id: 'm3',
    startAt: h(3.5),
    endAt: h(4.2),
    lat: 37.7576,
    lng: -122.3851,
    placeName: 'Lunch on 3rd St',
    headingDeg: 300,
    weather: { tempF: 64, summary: 'Clear' },
    caption: 'Tacos with the team',
    narration: 'Lunch was tacos on Third Street. Rohan took the photo, which is why he is not in it.',
  },
  {
    id: 'm4',
    startAt: h(7.5),
    endAt: h(8.2),
    lat: 37.7589,
    lng: -122.3829,
    placeName: 'Pier 70 waterfront',
    headingDeg: 95,
    isGoldenHour: true,
    caption: 'Golden hour break',
    narration: 'At four thirty the light turned gold over the water, and for ten minutes nobody talked about bugs.',
  },
];

export const DEMO_TRIP_ID = 'demo-yc-day';

export const demoTrip: Trip = {
  id: DEMO_TRIP_ID,
  userId: 'me',
  title: 'YC hackathon day',
  startAt: h(0),
  endAt: h(8.2),
  palette: ['#1F2A44', '#D9A441', '#E8E1D3', '#7A8B99', '#C2593B'],
  status: 'ready',
  moments: stops.map((s, i) => ({
    ...s,
    tripId: DEMO_TRIP_ID,
    userId: 'me',
    order: i,
    photos: photos(s.id, [`${s.id}a`, `${s.id}b`, `${s.id}c`, `${s.id}d`], s.startAt, s.lat, s.lng, s.headingDeg ?? 0),
    heroPhotoId: `${s.id}-p0`,
  })),
  people: [{ id: 'rohan', name: 'Rohan', shareCode: 'RHN42X', avatarUri: img('rohan-face', 256, 256) }],
  pairings: [{ id: 'pr1', userA: 'me', userB: 'rohan', at: h(3.6), lat: 37.7576, lng: -122.3851, momentId: 'm3' }],
  theirAngles: {
    m3: photos('m3-rohan', ['rohan1', 'rohan2'], h(3.6), 37.7576, -122.3851, 120).map((p) => ({ ...p, userId: 'rohan' })),
  },
};

export function getDemoTrip(id?: string): Trip {
  return demoTrip; // single demo trip for now
}

export function getDemoMoment(id: string): Moment | undefined {
  return demoTrip.moments.find((m) => m.id === id);
}
