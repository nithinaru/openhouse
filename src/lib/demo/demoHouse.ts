// App-only extras for the demo trip: the "house" view of today's hackathon at YC.
// Cutout standees, rooms (stop stickers), where each person stood through the day, and
// design crops used as stop photos. Never import this from convex/** or from demoTrip.ts:
// it requires local images, which the Convex bundler can't load.
//
// All people imagery is AI-generated placeholder art cropped out of Rohan's rebrand
// design (design/rebrand/app/a2-room-cutouts.png, see design/README.md). Room photos are
// crops of the AI interiors in design/ (a3, o4, f2), not real captures. See
// assets/demo/README.md.

import { Image } from 'react-native';

import type { Moment, Photo, Trip } from '../types';
import { VENUE } from './demoTrip';

export { VENUE };

const CUTOUTS = {
  rohan: require('../../../assets/demo/people/rohan.png') as number,
  sol: require('../../../assets/demo/people/sol.png') as number,
  ines: require('../../../assets/demo/people/ines.png') as number,
};

/** Source pixel size of each cutout (for aspect ratio). */
const CUTOUT_SIZE: Record<keyof typeof CUTOUTS, { w: number; h: number }> = {
  rohan: { w: 160, h: 414 },
  sol: { w: 139, h: 409 },
  ines: { w: 135, h: 339 },
};

const ROOM_IMAGES = {
  kickoffHall: require('../../../assets/demo/rooms/kickoff-hall.jpg') as number,
  hackingFloor: require('../../../assets/demo/rooms/hacking-floor.jpg') as number,
  hackingDesks: require('../../../assets/demo/rooms/hacking-desks.jpg') as number,
};

/** Placeholder design crops standing in for a few stop photos (by photo id). */
const PHOTO_IMAGES: Record<string, number> = {
  'm2-p0': ROOM_IMAGES.kickoffHall,
  'm3-p0': ROOM_IMAGES.hackingFloor,
  'm3-p1': ROOM_IMAGES.hackingDesks,
  'm6-p0': ROOM_IMAGES.hackingFloor,
  'm3-rohan-p0': ROOM_IMAGES.hackingDesks,
  'm3-rohan-p1': ROOM_IMAGES.kickoffHall,
};

const assetUri = (n: number): string => Image.resolveAssetSource(n)?.uri ?? '';

/** Best image uri for a photo: a bundled design crop when we have one, else its remote uri. */
export function photoUri(p: Pick<Photo, 'id' | 'uri'>): string {
  const local = PHOTO_IMAGES[p.id];
  return local ? assetUri(local) : p.uri;
}

// ---------------------------------------------------------------------------------------------
// Rooms: one sticker per place. The hall holds both kickoff and demos.

export type Room = {
  key: string;
  label: string;
  lat: number;
  lng: number;
  /** Screen-space offset of the sticker from its pin (below/beside it; standees stand above). */
  nudge: { x: number; y: number };
  /** Photos everyone in the house took here (shown on the sticker). */
  frames: number;
  momentIds: string[];
  /** Where people stood, for "@ines · by the stairs" tags. */
  spot: string;
};

export const ROOMS: Room[] = [
  { key: 'door', label: 'front door', lat: 37.76068, lng: -122.3861, nudge: { x: 0, y: 30 }, frames: 86, momentIds: ['m1'], spot: 'on 20th st' },
  { key: 'hall', label: 'the hall', lat: 37.76086, lng: -122.38625, nudge: { x: -92, y: 10 }, frames: 854, momentIds: ['m2', 'm6'], spot: 'by the stage' },
  { key: 'floor', label: 'hacking floor', lat: 37.7609, lng: -122.38585, nudge: { x: 96, y: 10 }, frames: 1108, momentIds: ['m3'], spot: 'by the windows' },
  { key: 'park', label: 'esprit park', lat: 37.76099, lng: -122.39101, nudge: { x: 0, y: 30 }, frames: 173, momentIds: ['m4'], spot: 'on the grass' },
  { key: 'cove', label: 'crane cove', lat: 37.76255, lng: -122.38711, nudge: { x: 0, y: 30 }, frames: 96, momentIds: ['m5'], spot: 'under the cranes' },
];

export function roomForMoment(momentId: string): Room | undefined {
  return ROOMS.find((r) => r.momentIds.includes(momentId));
}

// ---------------------------------------------------------------------------------------------
// People in the house: who stood where, when.

const day = new Date('2026-11-15T08:00:00-08:00').getTime();
const at = (hh: number, mm = 0) => day + ((hh - 8) * 60 + mm) * 60_000;

export type TrailStop = { at: number; momentId: string };

export type HousePerson = {
  id: keyof typeof CUTOUTS;
  name: string;
  handle: string;
  pronoun: 'he' | 'she' | 'they';
  cutout: number;
  aspect: number; // w / h
  /** Where they stood through the day, in time order. */
  trail: TrailStop[];
  /** The stop where you scanned each other: "stand where they stood" opens it. */
  metAt: string;
  /** Photos they added to the house today. */
  photoCount: number;
};

export const HOUSE_PEOPLE: HousePerson[] = [
  {
    id: 'rohan',
    name: 'rohan',
    handle: '@rohan',
    pronoun: 'he',
    cutout: CUTOUTS.rohan,
    aspect: CUTOUT_SIZE.rohan.w / CUTOUT_SIZE.rohan.h,
    metAt: 'm3',
    photoCount: 46,
    trail: [
      { at: at(8, 5), momentId: 'm1' },
      { at: at(9, 5), momentId: 'm2' },
      { at: at(10), momentId: 'm3' },
      { at: at(12, 35), momentId: 'm4' },
      { at: at(13, 20), momentId: 'm3' },
      { at: at(16, 25), momentId: 'm5' },
      { at: at(17), momentId: 'm3' },
      { at: at(19), momentId: 'm6' },
    ],
  },
  {
    id: 'sol',
    name: 'sol',
    handle: '@sol',
    pronoun: 'he',
    cutout: CUTOUTS.sol,
    aspect: CUTOUT_SIZE.sol.w / CUTOUT_SIZE.sol.h,
    metAt: 'm2',
    photoCount: 31,
    trail: [
      { at: at(9, 15), momentId: 'm2' },
      { at: at(10, 10), momentId: 'm3' },
      { at: at(12, 40), momentId: 'm4' },
      { at: at(13, 25), momentId: 'm3' },
      { at: at(19, 5), momentId: 'm6' },
    ],
  },
  {
    id: 'ines',
    name: 'ines',
    handle: '@ines',
    pronoun: 'she',
    cutout: CUTOUTS.ines,
    aspect: CUTOUT_SIZE.ines.w / CUTOUT_SIZE.ines.h,
    metAt: 'm4',
    photoCount: 58,
    trail: [
      { at: at(8, 20), momentId: 'm1' },
      { at: at(9, 10), momentId: 'm2' },
      { at: at(10, 30), momentId: 'm3' },
      { at: at(12, 45), momentId: 'm4' },
      { at: at(13, 30), momentId: 'm3' },
      { at: at(16, 30), momentId: 'm5' },
      { at: at(17, 5), momentId: 'm3' },
      { at: at(19, 10), momentId: 'm6' },
    ],
  },
];

export function getHousePerson(id: string): HousePerson | undefined {
  return HOUSE_PEOPLE.find((p) => p.id === id);
}

/** The house's day runs from doors to the end of demos. */
export const HOUSE_DAY = { start: at(8), end: at(20) };

/** Photos from a person's day: their own angles where we have them, else the stops they stood at. */
export function photosForPerson(trip: Trip, person: HousePerson): { photo: Photo; moment: Moment }[] {
  const out: { photo: Photo; moment: Moment }[] = [];
  const angles = trip.theirAngles ?? {};
  for (const [momentId, list] of Object.entries(angles)) {
    const moment = trip.moments.find((m) => m.id === momentId);
    if (!moment) continue;
    for (const photo of list) if (photo.userId === person.id) out.push({ photo, moment });
  }
  const seen = new Set<string>();
  for (const stop of person.trail) {
    if (seen.has(stop.momentId)) continue;
    seen.add(stop.momentId);
    const moment = trip.moments.find((m) => m.id === stop.momentId);
    const photo = moment?.photos.find((p) => p.id === moment.heroPhotoId) ?? moment?.photos[0];
    if (moment && photo) out.push({ photo, moment });
  }
  return out;
}
