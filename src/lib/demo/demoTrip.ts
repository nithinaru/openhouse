import type { Moment, Photo, Trip } from '../types';

// Cached demo trip so every screen works with no network and no photos: today's YC
// Consumer Mobile Hackathon (Sun Nov 15 2026) at YC's San Francisco office, 560 20th St,
// Dogpatch. Times follow the published schedule (consumermobilehackathon.com/schedule):
// doors 8:00, kickoff 9:00, hacking 10:00, lunch 12:30, finalist demos 7:00 pm.
// Stops sit at real places around the venue (Esprit Park, Crane Cove Park).
//
// convex/seed.ts and src/features/people/pair.ts import this file, so it must stay free of
// '@/' imports, Expo modules and local image requires; every `uri` here is remote. The
// app-only extras (cutout standees, design crops for stop photos, rooms) live in
// ./demoHouse.ts. Moment/photo objects are spread straight into Convex inserts by the
// seed, so don't add fields here that the Convex schema doesn't have.

const day = new Date('2026-11-15T08:00:00-08:00').getTime();
const h = (hours: number) => day + hours * 3600_000;

const img = (seed: string, w = 1024, hgt = 768) => `https://picsum.photos/seed/${seed}/${w}/${hgt}`;

function photos(momentId: string, seeds: string[], at: number, lat: number, lng: number, heading: number): Photo[] {
  return seeds.map((s, i) => ({
    id: `${momentId}-p${i}`,
    momentId,
    userId: 'me',
    takenAt: at + i * 4 * 60_000,
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

// Real coordinates (OpenStreetMap). YC's office is the old Union Iron Works shipyard
// office on 20th St at Pier 70; the venue stops are spread across its footprint so their stickers
// don't stack on the map.
export const VENUE = {
  name: 'yc',
  address: '560 20th st, san francisco',
  neighborhood: 'dogpatch',
  lat: 37.76084,
  lng: -122.38606,
} as const;

const stops: Omit<Moment, 'photos' | 'order' | 'tripId' | 'userId'>[] = [
  {
    id: 'm1',
    startAt: h(0),
    endAt: h(0.75),
    lat: 37.76068,
    lng: -122.3861,
    placeName: 'YC, 560 20th St',
    headingDeg: 40,
    weather: { tempF: 54, summary: 'High fog' },
    caption: 'doors open, lanyards and breakfast',
    fact: 'The brick office at 560 20th St was built for the Union Iron Works shipyard, the yard that became Pier 70.',
    narration:
      'Eight in the morning on 20th Street. The fog sat low over Pier 70, the lanyard line wrapped the old shipyard office, and you were holding two coffees, one of them for Rohan.',
  },
  {
    id: 'm2',
    startAt: h(1),
    endAt: h(1.9),
    lat: 37.76086,
    lng: -122.38625,
    placeName: 'The hall, YC',
    headingDeg: 210,
    weather: { tempF: 56, summary: 'Fog lifting' },
    caption: 'kickoff and lightning talks',
    fact: 'The Pier 70 shipyard next door built ships for the Navy through both world wars.',
    narration:
      'Kickoff in the hall, brick walls and steel beams overhead. The tracks went up on the screen, the room went quiet for the prize list, and Sol wrote your idea on a napkin.',
  },
  {
    id: 'm3',
    startAt: h(2),
    endAt: h(4.3),
    lat: 37.7609,
    lng: -122.38585,
    placeName: 'Hacking floor, YC',
    headingDeg: 300,
    weather: { tempF: 59, summary: 'Partly sunny' },
    caption: 'heads down by the tall windows',
    fact: 'Dogpatch was one of the few parts of San Francisco the 1906 fire never reached.',
    narration:
      'Ten o’clock, hacking begins. You took a table by the tall windows, Rohan opened his laptop next to yours, and by noon the app finally ran on a real phone.',
  },
  {
    id: 'm4',
    startAt: h(4.5),
    endAt: h(5.25),
    lat: 37.76099,
    lng: -122.39101,
    placeName: 'Esprit Park',
    headingDeg: 20,
    weather: { tempF: 63, summary: 'Sunny' },
    caption: 'lunch on the grass at esprit park',
    fact: 'Esprit Park was planted by the clothing company whose headquarters stood across Minnesota Street.',
    narration:
      'Lunch a few blocks west in Esprit Park. Sun on the grass, sandwiches on your knees, and Ines walking you through her whole demo with a ketchup packet for a phone.',
  },
  {
    id: 'm5',
    startAt: h(8.35),
    endAt: h(8.85),
    lat: 37.76255,
    lng: -122.38711,
    placeName: 'Crane Cove Park',
    headingDeg: 250,
    isGoldenHour: true,
    weather: { tempF: 61, summary: 'Clear' },
    caption: 'golden hour under the old cranes',
    fact: 'Crane Cove Park kept two of the shipyard’s original cranes when it opened on the old slipways in 2020.',
    narration:
      'Golden hour at Crane Cove, a short walk up Illinois Street. The old shipyard cranes went orange, the bay went still, and for a while nobody said the word bug.',
  },
  {
    id: 'm6',
    startAt: h(11),
    endAt: h(12),
    lat: 37.7608,
    lng: -122.3862,
    placeName: 'The hall, YC',
    headingDeg: 190,
    weather: { tempF: 55, summary: 'Clear night' },
    caption: 'finalist demos, sound on',
    fact: 'The sun set over Potrero Hill at 4:58 pm, three hours before the first demo.',
    narration:
      'Seven in the evening, back in the hall for finalist demos. Two minutes on stage, sound on, and a room full of people watched your whole day play back.',
  },
];

export const DEMO_TRIP_ID = 'demo-yc-day';

export const demoTrip: Trip = {
  id: DEMO_TRIP_ID,
  userId: 'me',
  title: 'YC hackathon day',
  startAt: h(0),
  endAt: h(12),
  palette: ['#1F2A44', '#D9A441', '#E8E1D3', '#7A8B99', '#C2593B'],
  status: 'ready',
  moments: stops.map((s, i) => ({
    ...s,
    tripId: DEMO_TRIP_ID,
    userId: 'me',
    order: i,
    photos: photos(s.id, [`oh-${s.id}a`, `oh-${s.id}b`, `oh-${s.id}c`, `oh-${s.id}d`], s.startAt + 5 * 60_000, s.lat, s.lng, s.headingDeg ?? 0),
    heroPhotoId: `${s.id}-p0`,
  })),
  // Rohan stays first: the demo panel and gift flow use people[0].
  people: [
    { id: 'rohan', name: 'Rohan', shareCode: 'RHN42X', avatarUri: img('rohan-face', 256, 256) },
    { id: 'sol', name: 'Sol', shareCode: 'SOL7KD', avatarUri: img('sol-face', 256, 256) },
    { id: 'ines', name: 'Ines', shareCode: 'INS3VQ', avatarUri: img('ines-face', 256, 256) },
  ],
  pairings: [
    { id: 'pr1', userA: 'me', userB: 'rohan', at: h(3.65), lat: 37.7609, lng: -122.38585, momentId: 'm3' },
    { id: 'pr2', userA: 'me', userB: 'sol', at: h(1.3), lat: 37.76086, lng: -122.38625, momentId: 'm2' },
    { id: 'pr3', userA: 'me', userB: 'ines', at: h(4.75), lat: 37.76099, lng: -122.39101, momentId: 'm4' },
  ],
  theirAngles: {
    m3: photos('m3-rohan', ['oh-rohan1', 'oh-rohan2', 'oh-rohan3'], h(3.6), 37.7609, -122.38585, 120).map((p) => ({ ...p, userId: 'rohan' })),
  },
};

export function getDemoTrip(_id?: string): Trip {
  return demoTrip; // single demo trip for now
}

export function getDemoMoment(id: string): Moment | undefined {
  return demoTrip.moments.find((m) => m.id === id);
}
