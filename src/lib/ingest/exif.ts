// Pure EXIF parser (docs/BUILD.md §5.1). No React Native imports so node:test can run it.
//
// iOS (expo-media-library getAssetInfoAsync) returns ImageIO-style nested dicts:
//   exif["{GPS}"]  = { Latitude, LatitudeRef, Longitude, LongitudeRef, Altitude, AltitudeRef, ImgDirection, ... }
//   exif["{Exif}"] = { ISOSpeedRatings: [n], LensModel, FocalLenIn35mmFilm, ... }
// Android returns flat ExifInterface tags (GPSImgDirection "123/1", ISOSpeedRatings, ...).
// Key names still need confirming on a real phone: see logOneAssetInfo() in readLibrary.ts.

import type { Lens } from '../types.ts';

export type ParsedExif = {
  lat?: number;
  lng?: number;
  altitudeM?: number;
  headingDeg?: number;
  iso?: number;
  lens?: Lens;
};

type Dict = Record<string, unknown>;

function asDict(v: unknown): Dict | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : undefined;
}

/** Number from a number, numeric string, "num/den" rational, or the first element of an array. */
function num(v: unknown): number | undefined {
  if (Array.isArray(v)) return num(v[0]);
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const rational = /^\s*(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(v);
    if (rational) {
      const den = Number(rational[2]);
      return den === 0 ? undefined : Number(rational[1]) / den;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

/** Applies the hemisphere ref: S/W make the coordinate negative. */
function signed(value: number | undefined, ref: unknown, negativeRef: 'S' | 'W'): number | undefined {
  if (value === undefined) return undefined;
  const r = str(ref)?.trim().toUpperCase();
  const abs = Math.abs(value);
  if (r === negativeRef) return -abs;
  if (r) return abs; // N or E
  return value; // no ref: trust the sign as given
}

function lensFrom(model: string | undefined, focal35: number | undefined): Lens | undefined {
  const m = model?.toLowerCase();
  if (m?.includes('front')) return 'front';
  if (m?.includes('ultra wide') || m?.includes('ultrawide')) return 'ultrawide';
  if (m?.includes('telephoto')) return 'tele';
  if (focal35 !== undefined) {
    if (focal35 < 20) return 'ultrawide';
    if (focal35 > 35) return 'tele';
    return 'wide';
  }
  return m ? 'wide' : undefined;
}

/**
 * Parses an asset-info exif dict. `fallback` is the asset's own `location`
 * (expo-media-library resolves it from PhotoKit even when EXIF GPS is missing).
 */
export function parseExif(exif: unknown, fallback?: { latitude: number; longitude: number } | null): ParsedExif {
  const root = asDict(exif) ?? {};
  const gps = asDict(root['{GPS}']);
  const ex = asDict(root['{Exif}']);
  const out: ParsedExif = {};

  if (gps) {
    out.lat = signed(num(gps.Latitude), gps.LatitudeRef, 'S');
    out.lng = signed(num(gps.Longitude), gps.LongitudeRef, 'W');
    const alt = num(gps.Altitude);
    if (alt !== undefined) out.altitudeM = num(gps.AltitudeRef) === 1 ? -Math.abs(alt) : alt;
    out.headingDeg = num(gps.ImgDirection);
  } else {
    // Android flat tags. GPSLatitude there is a DMS rational list, so rely on `fallback` for lat/lng.
    const alt = num(root.GPSAltitude);
    if (alt !== undefined) out.altitudeM = num(root.GPSAltitudeRef) === 1 ? -Math.abs(alt) : alt;
    out.headingDeg = num(root.GPSImgDirection);
  }

  if ((out.lat === undefined || out.lng === undefined) && fallback) {
    out.lat = fallback.latitude;
    out.lng = fallback.longitude;
  }
  if (out.lat !== undefined && (out.lat < -90 || out.lat > 90)) out.lat = undefined;
  if (out.lng !== undefined && (out.lng < -180 || out.lng > 180)) out.lng = undefined;
  if (out.lat === undefined || out.lng === undefined) {
    out.lat = undefined;
    out.lng = undefined;
  }
  if (out.headingDeg !== undefined && (out.headingDeg < 0 || out.headingDeg >= 360)) out.headingDeg = ((out.headingDeg % 360) + 360) % 360;

  out.iso = num(ex?.ISOSpeedRatings) ?? num(ex?.PhotographicSensitivity) ?? num(root.ISOSpeedRatings) ?? num(root.PhotographicSensitivity);
  out.lens = lensFrom(str(ex?.LensModel) ?? str(root.LensModel), num(ex?.FocalLenIn35mmFilm) ?? num(root.FocalLengthIn35mmFilm));

  for (const k of Object.keys(out) as (keyof ParsedExif)[]) if (out[k] === undefined) delete out[k];
  return out;
}
