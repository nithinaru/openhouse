// Media library read -> Photo -> moments -> Trip (docs/BUILD.md §5.1).
//
// SDK 58 note: the default `expo-media-library` export is the new object API and its
// requestPermissionsAsync/getAssetsAsync/getAssetInfoAsync throw at runtime. The function API
// (with exif, mediaSubtypes, location, isFavorite on asset info) lives at `expo-media-library/legacy`.

import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Platform } from 'react-native';

import { buildTrip, clusterPhotos, type ClusterPhoto } from '../cluster';
import type { Trip } from '../types';
import { parseExif } from './exif';

export const MAX_PHOTOS = 400;
const PAGE_SIZE = 200;
const MAX_SCANNED = 2000;
const CONCURRENCY = 8;
const MAX_GEOCODED_STOPS = 15;

export type IngestPhase = 'permission' | 'scanning' | 'reading' | 'naming' | 'done';

export type IngestProgress = {
  phase: IngestPhase;
  /** Geotagged photos found while scanning. */
  found: number;
  /** Asset infos read so far (out of `found`). */
  read: number;
  /** Stops (moments) clustered from what has been read so far. */
  stops: number;
  /** User granted iOS limited ("selected photos") access. */
  limited: boolean;
};

export type IngestErrorCode = 'denied' | 'no-geotagged' | 'unavailable';

export class IngestError extends Error {
  code: IngestErrorCode;
  constructor(code: IngestErrorCode, message: string) {
    super(message);
    this.name = 'IngestError';
    this.code = code;
  }
}

/** Returns access level, asking once if needed. Throws IngestError('denied') when refused. */
export async function ensurePhotoPermission(): Promise<{ limited: boolean }> {
  let perm = await MediaLibrary.getPermissionsAsync(false, ['photo']);
  if (!perm.granted && perm.canAskAgain) perm = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
  if (!perm.granted) throw new IngestError('denied', 'Photo access was not granted.');
  return { limited: perm.accessPrivileges === 'limited' };
}

/** Lets a limited-access user add more photos (iOS 14+ / Android 14+). */
export async function presentLimitedPicker(): Promise<void> {
  await MediaLibrary.presentPermissionsPickerAsync(['photo']);
}

async function scanRecentAssets(onFound: (n: number) => void): Promise<MediaLibrary.Asset[]> {
  const out: MediaLibrary.Asset[] = [];
  let after: string | undefined;
  let scanned = 0;
  // iOS includes `location` on getAssetsAsync results, so filter here and skip slow info reads.
  // Android only has it with resolveWithFullInfo (~5x slower), so keep every photo and let
  // getAssetInfoAsync supply location.
  const filterByLocation = Platform.OS === 'ios';
  while (out.length < MAX_PHOTOS && scanned < MAX_SCANNED) {
    const page = await MediaLibrary.getAssetsAsync({
      first: PAGE_SIZE,
      after,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });
    scanned += page.assets.length;
    for (const a of page.assets) {
      if (filterByLocation && !a.location) continue;
      if (a.mediaSubtypes?.includes('screenshot')) continue;
      out.push(a);
      if (out.length >= MAX_PHOTOS) break;
    }
    onFound(out.length);
    if (!page.hasNextPage || page.assets.length === 0) break;
    after = page.endCursor;
  }
  return out;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function toPhoto(asset: MediaLibrary.Asset, info: MediaLibrary.AssetInfo | undefined, userId: string): ClusterPhoto {
  const parsed = parseExif(info?.exif, info?.location ?? asset.location ?? null);
  return {
    id: asset.id,
    momentId: '',
    userId,
    takenAt: asset.creationTime,
    lat: parsed.lat,
    lng: parsed.lng,
    headingDeg: parsed.headingDeg,
    altitudeM: parsed.altitudeM,
    lens: parsed.lens,
    iso: parsed.iso,
    subtypes: (info?.mediaSubtypes ?? asset.mediaSubtypes ?? []) as string[],
    isFavorite: info?.isFavorite ?? false,
    uri: info?.localUri ?? asset.uri,
    w: asset.width,
    h: asset.height,
  };
}

function placeNameFrom(a: Location.LocationGeocodedAddress | undefined): string | undefined {
  if (!a) return undefined;
  return a.name ?? a.street ?? a.district ?? a.city ?? undefined;
}

/**
 * Reads ~400 recent geotagged photos, clusters them into stops and returns today's (most recent
 * day's) Trip. Throws IngestError('denied' | 'no-geotagged').
 */
export async function ingestRecent(
  onProgress?: (p: IngestProgress) => void,
  opts: { userId?: string; debugLogFirst?: boolean } = {},
): Promise<Trip> {
  const userId = opts.userId ?? 'me';
  const progress: IngestProgress = { phase: 'permission', found: 0, read: 0, stops: 0, limited: false };
  const emit = (patch: Partial<IngestProgress>) => {
    Object.assign(progress, patch);
    onProgress?.({ ...progress });
  };
  emit({});

  if (!(await MediaLibrary.isAvailableAsync())) throw new IngestError('unavailable', 'Photo library is unavailable.');
  const { limited } = await ensurePhotoPermission();
  emit({ phase: 'scanning', limited });

  const assets = await scanRecentAssets((found) => emit({ found }));
  if (assets.length === 0) throw new IngestError('no-geotagged', 'No photos with location were found.');
  emit({ phase: 'reading', found: assets.length });

  const photos = new Array<ClusterPhoto | undefined>(assets.length);
  let read = 0;
  await mapPool(assets, CONCURRENCY, async (asset, i) => {
    let info: MediaLibrary.AssetInfo | undefined;
    try {
      // Don't pull iCloud originals; location and most EXIF come back without the download.
      info = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false });
      if (i === 0 && (opts.debugLogFirst ?? __DEV__)) logAssetInfo(info);
    } catch {
      info = undefined; // fall back to the summary fields on `asset`
    }
    photos[i] = toPhoto(asset, info, userId);
    read += 1;
    if (read % CONCURRENCY === 0 || read === assets.length) {
      const soFar = photos.filter((p): p is ClusterPhoto => p !== undefined);
      emit({ read, stops: clusterPhotos(soFar, { userId }).length });
    }
  });

  const geotagged = photos.filter((p): p is ClusterPhoto => p !== undefined && p.lat !== undefined);
  const trip = buildTrip(clusterPhotos(geotagged, { userId }), { userId });
  if (!trip) throw new IngestError('no-geotagged', 'No photos with location were found.');
  emit({ phase: 'naming', stops: trip.moments.length });

  // Reverse geocode once per stop, sequentially: the OS geocoder throttles bursts.
  for (const m of trip.moments.slice(0, MAX_GEOCODED_STOPS)) {
    try {
      const [addr] = await Location.reverseGeocodeAsync({ latitude: m.lat, longitude: m.lng });
      m.placeName = placeNameFrom(addr);
    } catch {
      break; // throttled or no permission (Android); names are optional
    }
  }

  trip.status = 'ready';
  emit({ phase: 'done' });
  return trip;
}

function logAssetInfo(info: MediaLibrary.AssetInfo): void {
  const exif = (info.exif ?? {}) as Record<string, unknown>;
  console.log(
    '[openhouse/ingest] raw asset info\n' +
      JSON.stringify(
        {
          id: info.id,
          creationTime: info.creationTime,
          mediaSubtypes: info.mediaSubtypes,
          isFavorite: info.isFavorite,
          location: info.location,
          localUri: info.localUri,
          exifTopLevelKeys: Object.keys(exif),
          gps: exif['{GPS}'],
          exifDict: exif['{Exif}'],
          parsed: parseExif(info.exif, info.location ?? null),
        },
        null,
        2,
      ),
  );
}

/**
 * Debug helper: logs one raw asset info (most recent geotagged photo) so EXIF key names
 * can be confirmed on a real phone. Call from a dev button or the JS console.
 */
export async function logOneAssetInfo(): Promise<void> {
  await ensurePhotoPermission();
  const page = await MediaLibrary.getAssetsAsync({
    first: 50,
    mediaType: MediaLibrary.MediaType.photo,
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
  });
  const asset = page.assets.find((a) => a.location) ?? page.assets[0];
  if (!asset) {
    console.log('[openhouse/ingest] no photos in library');
    return;
  }
  logAssetInfo(await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false }));
}
