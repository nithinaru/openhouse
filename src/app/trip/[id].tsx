import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomScrim, Letterbox, TopScrim } from '@/features/replay/Cinema';
import { EndCard } from '@/features/replay/EndCard';
import { KineticCaption } from '@/features/replay/KineticCaption';
import { PersonPin } from '@/features/replay/PersonPin';
import { personFor } from '@/features/replay/people';
import { PhotoFan } from '@/features/replay/PhotoFan';
import { formatDate, plural, tripStats } from '@/features/replay/stats';
import { StopMarker } from '@/features/replay/StopMarker';
import { Timeline } from '@/features/replay/Timeline';
import { TitleCard } from '@/features/replay/TitleCard';
import { useReplay } from '@/features/replay/useReplay';
import { useTrip } from '@/features/replay/useTrip';
import { colors, radius, space, tintFor, type } from '@/theme';

const TINT_FADE_MS = 1400;

export default function ReplayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const replay = useReplay(trip, mapRef, { reducedMotion });
  const { moments, index, moment, phase, paused } = replay;

  const stats = useMemo(() => tripStats(trip, moments), [trip, moments]);
  const dateLabel = formatDate(trip.startAt);

  const first = moments[0];
  const hour = new Date((moment ?? first)?.startAt ?? trip.startAt).getHours();
  const tint = tintFor(hour, moment?.isGoldenHour);
  const cameraHeading = moment?.headingDeg ?? 0;
  // The stop being flown to isn't on the map until its pin lands.
  const landed = phase === 'done' ? moments.length - 1 : phase === 'flying' ? index - 1 : index;
  const opening = phase === 'idle' || phase === 'title';
  const done = phase === 'done';
  const showPhotos = moment && (phase === 'photos' || phase === 'narrating');
  const showCaption = moment && (phase === 'photos' || phase === 'narrating');
  const interactive = paused || done;
  const walkInMoment = moments.find((m) => m.worldViewerUrl || m.worldSplatUrl) ?? first;

  const route = moments.slice(0, Math.max(0, landed + 1)).map((m) => ({ latitude: m.lat, longitude: m.lng }));

  const openStop = (momentId: string) =>
    router.push({ pathname: '/stop/[id]', params: { id: momentId, tripId: trip.id } });

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <MapView
        ref={mapRef}
        style={styles.fill}
        initialCamera={
          first
            ? {
                center: { latitude: first.lat, longitude: first.lng },
                pitch: 0,
                heading: 0,
                zoom: 13.5,
                altitude: 6000,
              }
            : undefined
        }
        onMapReady={replay.start}
        onPress={(e) => {
          if (e.nativeEvent.action === 'marker-press') return;
          replay.togglePause();
        }}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        showsPointsOfInterests={false}
        showsCompass={false}
        showsBuildings
        toolbarEnabled={false}
        userInterfaceStyle="dark"
      >
        {route.length > 1 ? (
          <Polyline coordinates={route} strokeColor={colors.accent} strokeWidth={3} lineDashPattern={[2, 6]} />
        ) : null}
        {moments.map((m, i) =>
          i <= landed ? (
            <StopMarker
              key={m.id}
              moment={m}
              active={i === index && !done}
              cameraHeading={cameraHeading}
              onPress={() => openStop(m.id)}
            />
          ) : null,
        )}
        {trip.pairings
          .filter((p) => replay.reachedPairings.includes(p.id))
          .map((p) => (
            <PersonPin key={p.id} pairing={p} person={personFor(trip, p)} />
          ))}
      </MapView>

      {/* Light of the moment, crossfading between stops */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: tint,
            opacity: 0.38,
            transitionProperty: 'backgroundColor',
            transitionDuration: TINT_FADE_MS,
          },
        ]}
      />

      <TopScrim height={insets.top + 90} />
      <BottomScrim height={screenH * 0.58} strong={!!showCaption || done} />
      <Letterbox visible={!reducedMotion && (opening || phase === 'flying') && !paused} topInset={insets.top} />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <Pill label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={styles.titleWrap} pointerEvents="none">
          {!opening ? (
            <Animated.Text entering={FadeIn.duration(500)} style={styles.title} numberOfLines={1}>
              {trip.title}
            </Animated.Text>
          ) : null}
        </View>
        {done ? (
          <View style={styles.pillSpacer} />
        ) : (
          <Pill label={paused ? 'Play' : 'Pause'} onPress={replay.togglePause} />
        )}
      </View>

      {paused && !done ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(160)}
          pointerEvents="none"
          style={styles.pausedBadge}
        >
          <Text style={type.caption}>Paused · tap the map to resume</Text>
        </Animated.View>
      ) : null}

      {/* Bottom: photos, kinetic caption, timeline */}
      {!done ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + space.sm }]} pointerEvents="box-none">
          {showPhotos ? (
            <PhotoFan
              key={moment.id}
              moment={moment}
              paused={paused}
              reducedMotion={reducedMotion}
              onPress={() => openStop(moment.id)}
            />
          ) : null}

          {showCaption ? (
            <KineticCaption
              key={`cap-${moment.id}`}
              moment={moment}
              progress={replay.captionProgress}
              reducedMotion={reducedMotion}
              onPress={() => openStop(moment.id)}
            />
          ) : null}

          {!opening ? (
            <Animated.View entering={FadeIn.duration(400)} style={styles.footer}>
              <Timeline moments={moments} index={index} progress={replay.filmProgress} onJump={replay.jumpTo} />
              <Text style={styles.counter}>
                {Math.max(1, index + 1)}/{moments.length}
              </Text>
            </Animated.View>
          ) : null}
        </View>
      ) : null}

      {opening ? (
        <TitleCard
          title={trip.title}
          date={dateLabel}
          meta={[
            plural(stats.stops, 'stop'),
            stats.people ? `${stats.people} ${stats.people === 1 ? 'person' : 'people'}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        />
      ) : null}

      {done ? (
        <EndCard
          title={trip.title}
          date={dateLabel}
          stats={stats}
          palette={trip.palette}
          bottomInset={insets.bottom}
          onFrame={() => router.push({ pathname: '/frame/[id]', params: { id: trip.id } })}
          onWalkIn={
            walkInMoment
              ? () => router.push({ pathname: '/walkin/[id]', params: { id: walkInMoment.id } })
              : undefined
          }
          onAgain={replay.restart}
        />
      ) : null}
    </View>
  );
}

function Pill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      style={({ pressed }) => [styles.pill, pressed && { transform: [{ scale: 0.97 }], opacity: 0.85 }]}
    >
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '600', color: colors.text, opacity: 0.9 },
  pill: {
    minWidth: 64,
    alignItems: 'center',
    backgroundColor: 'rgba(23,27,34,0.72)',
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(242,238,230,0.16)',
  },
  pillSpacer: { minWidth: 64 },
  pillText: { fontSize: 15, fontWeight: '600', color: colors.text },
  pausedBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    backgroundColor: 'rgba(23,27,34,0.88)',
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  counter: { fontSize: 12, fontWeight: '600', color: colors.textMuted, fontVariant: ['tabular-nums'], minWidth: 28 },
});
