// Run: node --test src/lib/ingest/exif.test.ts
/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// @ts-ignore TS5097 (Node needs the .ts extension; types still resolve)
import { parseExif } from './exif.ts';

// Shape modeled on an iPhone getAssetInfoAsync().exif dict (to be confirmed on device).
const iphoneBack = {
  '{GPS}': {
    Latitude: 37.7955,
    LatitudeRef: 'N',
    Longitude: 122.3937,
    LongitudeRef: 'W',
    Altitude: 12.5,
    AltitudeRef: 0,
    ImgDirection: 241.3,
    ImgDirectionRef: 'T',
    Speed: 0,
  },
  '{Exif}': {
    ISOSpeedRatings: [64],
    ExposureTime: 0.004,
    LensModel: 'iPhone 15 Pro back triple camera 6.765mm f/1.78',
    FocalLenIn35mmFilm: 24,
  },
};

describe('parseExif', () => {
  it('parses iOS nested GPS/Exif dicts with hemisphere refs', () => {
    assert.deepEqual(parseExif(iphoneBack), {
      lat: 37.7955,
      lng: -122.3937,
      altitudeM: 12.5,
      headingDeg: 241.3,
      iso: 64,
      lens: 'wide',
    });
  });

  it('handles southern hemisphere and below-sea-level altitude', () => {
    const r = parseExif({
      '{GPS}': { Latitude: 33.8688, LatitudeRef: 'S', Longitude: 151.2093, LongitudeRef: 'E', Altitude: 3, AltitudeRef: 1 },
    });
    assert.equal(r.lat, -33.8688);
    assert.equal(r.lng, 151.2093);
    assert.equal(r.altitudeM, -3);
  });

  it('detects front camera from LensModel', () => {
    const r = parseExif({ '{Exif}': { LensModel: 'iPhone 15 Pro front TrueDepth camera 2.69mm f/1.9', ISOSpeedRatings: 400 } });
    assert.equal(r.lens, 'front');
    assert.equal(r.iso, 400);
  });

  it('classifies ultrawide and tele by 35mm focal length', () => {
    assert.equal(parseExif({ '{Exif}': { LensModel: 'iPhone back triple camera 2.22mm f/2.2', FocalLenIn35mmFilm: 13 } }).lens, 'ultrawide');
    assert.equal(parseExif({ '{Exif}': { LensModel: 'iPhone back triple camera 15.66mm f/2.8', FocalLenIn35mmFilm: 120 } }).lens, 'tele');
  });

  it('normalizes heading and accepts rational strings', () => {
    assert.equal(parseExif({ '{GPS}': { ImgDirection: 370 } }).headingDeg, 10);
    assert.equal(parseExif({ GPSImgDirection: '9000/100', ISOSpeedRatings: '200' }).headingDeg, 90);
  });

  it('falls back to asset location when EXIF GPS is missing', () => {
    const r = parseExif({ '{Exif}': {} }, { latitude: 40.7, longitude: -74 });
    assert.equal(r.lat, 40.7);
    assert.equal(r.lng, -74);
  });

  it('drops half-present or invalid coordinates and tolerates junk input', () => {
    assert.deepEqual(parseExif({ '{GPS}': { Latitude: 37 } }), {});
    assert.deepEqual(parseExif({ '{GPS}': { Latitude: 95, Longitude: 10 } }), {});
    assert.deepEqual(parseExif(undefined), {});
    assert.deepEqual(parseExif('nope'), {});
  });
});
