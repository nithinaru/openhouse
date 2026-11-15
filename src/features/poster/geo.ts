// Small geo helpers for the poster. Pure functions, no RN imports.

export type LatLng = { lat: number; lng: number };
export type Point = { x: number; y: number };

const EARTH_RADIUS_MI = 3958.8;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in miles. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total length of a path through the points in order, in miles. */
export function pathMiles(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineMiles(points[i - 1], points[i]);
  return total;
}

export type Box = { x: number; y: number; w: number; h: number };

/**
 * Equirectangular projection that fits `points` into `box` (already inset for padding),
 * keeping aspect ratio and centering. Longitude is scaled by cos(mean latitude) so the
 * shape is not stretched. Returns a projector usable for any lat/lng (e.g. pairings).
 */
export function fitProjector(points: LatLng[], box: Box): (p: LatLng) => Point {
  if (points.length === 0) return () => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

  const meanLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const k = Math.cos(toRad(meanLat));
  const xs = points.map((p) => p.lng * k);
  const ys = points.map((p) => p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  // A single stop (or identical stops) has no span: put it in the middle.
  const scale = spanX === 0 && spanY === 0 ? 0 : Math.min(spanX ? box.w / spanX : Infinity, spanY ? box.h / spanY : Infinity);
  const offX = box.x + (box.w - spanX * scale) / 2;
  const offY = box.y + (box.h - spanY * scale) / 2;

  return (p) => ({
    x: offX + (p.lng * k - minX) * scale,
    // SVG y grows downward, latitude grows upward.
    y: offY + (maxY - p.lat) * scale,
  });
}
