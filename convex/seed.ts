import { internalMutation } from './_generated/server';
import type { Id } from './_generated/dataModel';
import type { Photo } from '../src/lib/types';
import { demoTrip } from '../src/lib/demo/demoTrip';
import { DEMO_MY_SHARE_CODE } from '../src/features/people/pair';

export const demo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const upsertUser = async (deviceId: string, name: string, shareCode: string) => {
      const existing = await ctx.db
        .query('users')
        .withIndex('by_deviceId', (q) => q.eq('deviceId', deviceId))
        .unique();
      return existing?._id ?? (await ctx.db.insert('users', { deviceId, name, shareCode }));
    };
    const me = await upsertUser('demo-me', 'You', DEMO_MY_SHARE_CODE);

    const existingTrip = await ctx.db
      .query('trips')
      .withIndex('by_userId', (q) => q.eq('userId', me).eq('startAt', demoTrip.startAt))
      .first();
    if (existingTrip) return { tripId: existingTrip._id, userId: me };

    const userIds: Record<string, Id<'users'>> = { me };
    for (const p of demoTrip.people) userIds[p.id] = await upsertUser(`demo-${p.id}`, p.name, p.shareCode);

    const insertPhotos = async (momentId: Id<'moments'>, userId: Id<'users'>, photos: Photo[]) => {
      const ids: Record<string, Id<'photos'>> = {};
      for (const { id, uri, momentId: _m, userId: _u, ...p } of photos) {
        ids[id] = await ctx.db.insert('photos', { ...p, momentId, userId, thumbUrl: uri });
      }
      return ids;
    };

    const { id: _id, userId: _userId, moments, people: _people, pairings, theirAngles, ...trip } = demoTrip;
    const tripId = await ctx.db.insert('trips', { ...trip, userId: me });
    const momentIds: Record<string, Id<'moments'>> = {};
    for (const m of moments) {
      const { id, tripId: _t, userId: _u, photos, heroPhotoId, narrationUri: _n, ambientUri: _a, worldViewerUrl: _wv, worldSplatUrl: _ws, ...fields } = m;
      const momentId = await ctx.db.insert('moments', { ...fields, tripId, userId: me });
      momentIds[id] = momentId;
      const photoIds = await insertPhotos(momentId, me, photos);
      if (heroPhotoId && photoIds[heroPhotoId]) await ctx.db.patch(momentId, { heroPhotoId: photoIds[heroPhotoId] });
    }

    for (const p of pairings) {
      const friendKey = p.userA === 'me' ? p.userB : p.userA;
      const friendId = userIds[friendKey];
      const myMoment = p.momentId ? moments.find((m) => m.id === p.momentId) : undefined;
      let friendMoment: Id<'moments'> | undefined;
      const anglePhotos = p.momentId ? theirAngles?.[p.momentId] : undefined;
      if (myMoment && anglePhotos?.length) {
        const friendTripId = await ctx.db.insert('trips', {
          userId: friendId,
          title: demoTrip.title,
          startAt: demoTrip.startAt,
          endAt: demoTrip.endAt,
          palette: demoTrip.palette,
          status: 'ready',
        });
        friendMoment = await ctx.db.insert('moments', {
          tripId: friendTripId,
          userId: friendId,
          startAt: anglePhotos[0].takenAt,
          endAt: anglePhotos[anglePhotos.length - 1].takenAt,
          lat: myMoment.lat,
          lng: myMoment.lng,
          placeName: myMoment.placeName,
          order: 0,
        });
        await insertPhotos(friendMoment, friendId, anglePhotos);
      }
      await ctx.db.insert('pairings', {
        userA: me,
        userB: friendId,
        at: p.at,
        lat: p.lat,
        lng: p.lng,
        momentA: p.momentId ? momentIds[p.momentId] : undefined,
        momentB: friendMoment,
      });
    }

    return { tripId, userId: me };
  },
});
