// Shared client-side shapes. They mirror the Convex schema in docs/BUILD.md §4,
// so features can be built against demo data now and swapped to useQuery later.

export type Lens = 'front' | 'wide' | 'ultrawide' | 'tele';

export type Photo = {
  id: string;
  momentId: string;
  userId: string;
  takenAt: number; // ms epoch
  lat?: number;
  lng?: number;
  headingDeg?: number;
  altitudeM?: number;
  lens?: Lens;
  subtypes: string[];
  isFavorite: boolean;
  uri: string; // local asset uri or remote thumb url
  w: number;
  h: number;
};

export type Weather = { tempF: number; summary: string };

export type Moment = {
  id: string;
  tripId: string;
  userId: string;
  startAt: number;
  endAt: number;
  lat: number;
  lng: number;
  placeName?: string;
  headingDeg?: number;
  altitudeM?: number;
  avgIso?: number;
  isGoldenHour?: boolean;
  weather?: Weather;
  fact?: string;
  caption?: string;
  sceneTags?: string[];
  heroPhotoId?: string;
  order: number;
  photos: Photo[];
  narration?: string; // per-stop narration text
  narrationUri?: string; // per-stop audio clip
  ambientUri?: string;
  worldViewerUrl?: string; // World Labs viewer for "Walk in"
  worldSplatUrl?: string;
};

export type Person = {
  id: string;
  name: string;
  avatarUri?: string;
  shareCode: string;
};

export type Pairing = {
  id: string;
  userA: string;
  userB: string;
  at: number;
  lat: number;
  lng: number;
  momentId?: string;
};

export type Trip = {
  id: string;
  userId: string;
  title: string;
  startAt: number;
  endAt: number;
  palette: string[];
  story?: string;
  status: 'ingesting' | 'enriching' | 'ready';
  moments: Moment[];
  people: Person[];
  pairings: Pairing[];
  // friend photos at shared stops, keyed by momentId ("their angle")
  theirAngles?: Record<string, Photo[]>;
};
