// Run: node --test src/lib/cluster/cluster.test.ts
// TS 6 defaults `types` to [], so pull in Node's types for node:test explicitly.
/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { Photo } from '../types.ts';
// Node needs the .ts extension; the app tsconfig lacks allowImportingTsExtensions (types still resolve).
// @ts-ignore TS5097
import { buildTrip, buildTrips, circularMeanDeg, clusterPhotos, haversineM, median, pickHero, type ClusterPhoto } from './cluster.ts';

const T0 = Date.UTC(2026, 10, 15, 16, 0, 0); // 2026-11-15 16:00Z
const min = (n: number) => n * 60_000;
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// Fixture stops around San Francisco.
const FERRY = { lat: 37.7955, lng: -122.3937 };
const FERRY_NEAR = { lat: 37.7960, lng: -122.3930 }; // ~80 m away
const DOLORES = { lat: 37.7596, lng: -122.4269 }; // ~5 km from Ferry Building

let seq = 0;
function photo(at: number, loc?: { lat: number; lng: number }, extra: Partial<ClusterPhoto> = {}): ClusterPhoto {
  seq += 1;
  return {
    id: `p${seq}`,
    momentId: '',
    userId: 'me',
    takenAt: at,
    lat: loc?.lat,
    lng: loc?.lng,
    subtypes: [],
    isFavorite: false,
    uri: `ph://asset-${seq}`,
    w: 4032,
    h: 3024,
    ...extra,
  };
}

describe('geo', () => {
  it('haversine is ~0 for same point and matches a known distance', () => {
    assert.ok(haversineM(FERRY, FERRY) < 1e-6);
    const d = haversineM(FERRY, DOLORES);
    assert.ok(d > 4500 && d < 5500, `got ${d}`);
    // 1 degree of latitude is ~111.2 km
    const deg = haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    assert.ok(Math.abs(deg - 111_195) < 100, `got ${deg}`);
  });

  it('median handles odd, even and empty', () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.equal(median([]), undefined);
  });

  it('circular mean wraps around north', () => {
    const m = circularMeanDeg([350, 10])!;
    assert.ok(m < 0.001 || m > 359.999, `got ${m}`);
    assert.ok(Math.abs(circularMeanDeg([80, 100])! - 90) < 1e-9);
    assert.equal(circularMeanDeg([0, 180]), undefined);
    assert.equal(circularMeanDeg([]), undefined);
  });
});

describe('clusterPhotos', () => {
  it('splits on >90 min gap and >1 km jump, sorts by takenAt', () => {
    const photos = [
      photo(T0 + min(5), FERRY_NEAR),
      photo(T0, FERRY),
      photo(T0 + min(30), DOLORES), // distance break
      photo(T0 + min(40), DOLORES),
      photo(T0 + min(40 + 91), DOLORES), // time break, same place
    ];
    const moments = clusterPhotos(photos);
    assert.equal(moments.length, 3);
    assert.deepEqual(
      moments.map((m) => m.photos.length),
      [2, 2, 1],
    );
    assert.equal(moments[0].startAt, T0);
    assert.equal(moments[0].endAt, T0 + min(5));
    assert.deepEqual(
      moments.map((m) => m.order),
      [0, 1, 2],
    );
    for (const m of moments) for (const p of m.photos) assert.equal(p.momentId, m.id);
  });

  it('does not split at exactly 90 min', () => {
    const moments = clusterPhotos([photo(T0, FERRY), photo(T0 + min(90), FERRY)]);
    assert.equal(moments.length, 1);
  });

  it('uses median center, circular-mean heading, median altitude, mean iso', () => {
    const moments = clusterPhotos([
      photo(T0, { lat: 37.7950, lng: -122.3940 }, { headingDeg: 350, altitudeM: 5, iso: 50 }),
      photo(T0 + min(1), { lat: 37.7955, lng: -122.3937 }, { headingDeg: 10, altitudeM: 7, iso: 100 }),
      photo(T0 + min(2), { lat: 37.7990, lng: -122.3930 }, { altitudeM: 100 }),
    ]);
    assert.equal(moments.length, 1);
    const m = moments[0];
    assert.equal(m.lat, 37.7955);
    assert.equal(m.lng, -122.3937);
    assert.ok(m.headingDeg! < 0.001 || m.headingDeg! > 359.999);
    assert.equal(m.altitudeM, 7);
    assert.equal(m.avgIso, 75);
    assert.ok(!('iso' in m.photos[0]), 'iso is stripped from stored photos');
  });

  it('keeps ungeotagged photos in the current moment and drops location-less moments', () => {
    const moments = clusterPhotos([
      photo(T0 - min(200)), // alone, no location -> dropped
      photo(T0, FERRY),
      photo(T0 + min(3)), // no location, joins Ferry moment
    ]);
    assert.equal(moments.length, 1);
    assert.equal(moments[0].photos.length, 2);
    assert.equal(moments[0].id, 'm0');
  });

  it('returns no moments for empty input', () => {
    assert.deepEqual(clusterPhotos([]), []);
  });
});

describe('pickHero', () => {
  const base = (over: Partial<Photo>[]) => over.map((o, i) => photo(T0 + min(i * 2), FERRY, o));

  it('prefers favorite over panorama', () => {
    const ps = base([{ subtypes: ['panorama'] }, {}, { isFavorite: true }]);
    assert.equal(pickHero(ps)!.id, ps[2].id);
  });

  it('prefers panorama when no favorite', () => {
    const ps = base([{}, { subtypes: ['hdr', 'panorama'] }, {}]);
    assert.equal(pickHero(ps)!.id, ps[1].id);
  });

  it('picks first shot of the largest burst', () => {
    const single = photo(T0, FERRY);
    const burstA = [photo(T0 + min(5), FERRY), photo(T0 + min(5) + 3000, FERRY)];
    const burstB = [0, 2000, 4000, 6000].map((dt) => photo(T0 + min(10) + dt, FERRY));
    const hero = pickHero([single, ...burstA, ...burstB]);
    assert.equal(hero!.id, burstB[0].id);
  });

  it('falls back to the first photo', () => {
    const ps = base([{}, {}, {}]);
    assert.equal(pickHero([ps[2], ps[0], ps[1]])!.id, ps[0].id);
    assert.equal(pickHero([]), undefined);
  });

  it('is wired into clusterPhotos', () => {
    const ps = base([{}, { isFavorite: true }]);
    assert.equal(clusterPhotos(ps)[0].heroPhotoId, ps[1].id);
  });
});

describe('buildTrip', () => {
  const day1 = [photo(T0, FERRY), photo(T0 + min(60), DOLORES)];
  const day2 = [photo(T0 + 24 * 3600_000, FERRY), photo(T0 + 24 * 3600_000 + min(10), FERRY)];
  const moments = clusterPhotos([...day2, ...day1]);

  it('groups moments by day and restamps ids', () => {
    const trips = buildTrips(moments, { dayKey: utcDay, title: () => 'T' });
    assert.equal(trips.length, 2);
    assert.equal(trips[0].id, 'trip-2026-11-15');
    assert.equal(trips[0].moments.length, 2);
    assert.equal(trips[1].moments.length, 1);
    for (const t of trips) {
      t.moments.forEach((m, i) => {
        assert.equal(m.tripId, t.id);
        assert.equal(m.order, i);
        assert.equal(m.id, `${t.id}-m${i}`);
        for (const p of m.photos) assert.equal(p.momentId, m.id);
      });
      assert.equal(t.startAt, t.moments[0].startAt);
      assert.equal(t.endAt, t.moments[t.moments.length - 1].endAt);
      assert.equal(t.status, 'ingesting');
      assert.deepEqual(t.people, []);
    }
  });

  it('buildTrip returns the most recent day', () => {
    const trip = buildTrip(moments, { dayKey: utcDay })!;
    assert.equal(trip.id, 'trip-2026-11-16');
    assert.ok(trip.title.length > 0);
    assert.equal(buildTrip([]), undefined);
  });
});
