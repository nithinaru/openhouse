// Plays the "building your day" show from the cached demo trip, never the real photo library.

import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { getDemoTrip, DEMO_TRIP_ID } from '@/lib/demo/demoTrip';
import type { IngestProgress, StopPreview } from '@/lib/ingest/readLibrary';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** True on a real phone; false on web or a simulator. */
export function isRealPhone(): boolean {
  return Platform.OS !== 'web' && Device.isDevice !== false;
}

/** Emits fake ingest progress over ~5 s using the demo trip's stops. */
export async function runDemoBuild(onProgress: (p: IngestProgress) => void, alive: () => boolean): Promise<{ title: string; stops: number }> {
  const trip = getDemoTrip(DEMO_TRIP_ID);
  const all: StopPreview[] = trip.moments.map((m) => ({
    key: m.id,
    lat: m.lat,
    lng: m.lng,
    heroUri: (m.photos.find((p) => p.id === m.heroPhotoId) ?? m.photos[0])?.uri,
    photoCount: m.photos.length,
    startAt: m.startAt,
    placeName: m.placeName,
  }));
  const found = all.reduce((n, s) => n + s.photoCount, 0);
  const base = { found: 0, read: 0, stops: 0, limited: false };

  onProgress({ ...base, phase: 'scanning' });
  for (let i = 1; i <= 4 && alive(); i++) {
    await wait(220);
    onProgress({ ...base, phase: 'scanning', found: Math.round((found * i) / 4) });
  }
  for (let i = 1; i <= all.length && alive(); i++) {
    await wait(Math.max(350, Math.round(2800 / all.length)));
    const stopList = all.slice(0, i).map((s) => ({ ...s, placeName: undefined }));
    onProgress({ ...base, phase: 'reading', found, read: Math.round((found * i) / all.length), stops: i, stopList });
  }
  if (alive()) {
    onProgress({ ...base, phase: 'naming', found, read: found, stops: all.length, stopList: all, places: all.length });
    await wait(700);
  }
  const done: IngestProgress = { ...base, phase: 'done', found, read: found, stops: all.length, stopList: all, places: all.length };
  if (alive()) onProgress(done);
  return { title: trip.title, stops: all.length };
}
