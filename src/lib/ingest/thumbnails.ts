// ~512px JPEG thumbnails for up to 3 photos per moment (docs/BUILD.md §5.1).
// SDK 58 expo-image-manipulator: contextual API, ImageManipulator.manipulate(uri) -> renderAsync() -> saveAsync().

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { Moment, Photo } from '../types';

const THUMB_PX = 512;
const PER_MOMENT = 3;
const CONCURRENCY = 4;

async function makeThumb(photo: Photo): Promise<{ uri: string; w: number; h: number } | undefined> {
  const landscape = photo.w >= photo.h;
  // Never upscale a small source.
  if (Math.max(photo.w, photo.h) <= THUMB_PX) return undefined;
  let ctx: ReturnType<typeof ImageManipulator.manipulate>;
  try {
    ctx = ImageManipulator.manipulate(photo.uri);
  } catch {
    return undefined;
  }
  try {
    const ref = await ctx.resize(landscape ? { width: THUMB_PX } : { height: THUMB_PX }).renderAsync();
    try {
      const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.72 });
      return { uri: out.uri, w: out.width, h: out.height };
    } finally {
      ref.release();
    }
  } catch {
    return undefined; // iCloud-only original, unsupported format, etc. Keep the asset uri.
  } finally {
    ctx.release();
  }
}

/** Hero first, then the next photos in time order. */
function thumbCandidates(m: Moment): Photo[] {
  const hero = m.photos.find((p) => p.id === m.heroPhotoId);
  const rest = m.photos.filter((p) => p !== hero);
  return (hero ? [hero, ...rest] : rest).slice(0, PER_MOMENT);
}

/**
 * Replaces photo.uri with a local 512px JPEG for up to 3 photos per moment, in place.
 * Failures are skipped silently (the photo keeps its asset uri).
 */
export async function attachThumbnails(moments: Moment[], onEach?: () => void): Promise<void> {
  const queue = moments.flatMap(thumbCandidates);
  let next = 0;
  const worker = async () => {
    while (next < queue.length) {
      const photo = queue[next++];
      const thumb = await makeThumb(photo);
      if (thumb) {
        photo.uri = thumb.uri;
        photo.w = thumb.w;
        photo.h = thumb.h;
      }
      onEach?.();
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
}
