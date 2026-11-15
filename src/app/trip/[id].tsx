import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PersonPin } from '@/features/replay/PersonPin';
import { personFor } from '@/features/replay/people';
import { PhotoFan } from '@/features/replay/PhotoFan';
import { StopMarker } from '@/features/replay/StopMarker';
import { useReplay } from '@/features/replay/useReplay';
import { useTrip } from '@/features/replay/useTrip';
import { colors, radius, space, tintFor, type } from '@/theme';

export default function ReplayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const replay = useReplay(trip, mapRef);
  const { moments, index, moment, phase, paused } = replay;

  const first = moments[0];
  const hour = new Date((moment ?? first)?.startAt ?? Date.now()).getHours();
  const tint = tintFor(hour, moment?.isGoldenHour);
  const cameraHeading = moment?.headingDeg ?? 0;
  const showPhotos = moment && (phase === 'photos' || phase === 'narrating');
  const showCaption = moment && phase === 'narrating';

  const openStop = (momentId: string) =>
    router.push({ pathname: '/stop/[id]', params: { id: momentId, tripId: trip.id } });

  return (
    <View style={[styles.fill, { backgroundColor: tint }]}>
      <MapView
        ref={mapRef}
        style={styles.fill}
        initialCamera={
          first
            ? {
                center: { latitude: first.lat, longitude: first.lng },
                pitch: 0,
                heading: 0,
                zoom: 14,
                altitude: 4000,
              }
            : undefined
        }
        onMapReady={replay.start}
        onPress={(e) => {
          if (e.nativeEvent.action === 'marker-press') return;
          replay.togglePause();
        }}
        scrollEnabled={paused || phase === 'done'}
        zoomEnabled={paused || phase === 'done'}
        rotateEnabled={paused || phase === 'done'}
        pitchEnabled={paused || phase === 'done'}
        showsPointsOfInterests={false}
        showsCompass={false}
        toolbarEnabled={false}
        userInterfaceStyle="dark"
      >
        {moments.map((m, i) =>
          i <= index ? (
            <StopMarker
              key={m.id}
              moment={m}
              active={i === index}
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

      {/* Light-of-the-moment tint over the map */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: 0.35 }]} />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <Pill label="Back" onPress={() => router.back()} />
        <Text style={[type.heading, styles.title]} numberOfLines={1}>
          {trip.title}
        </Text>
        <Pill
          label={phase === 'done' ? 'Replay' : paused ? 'Play' : 'Pause'}
          onPress={phase === 'done' ? replay.restart : replay.togglePause}
        />
      </View>

      {paused ? (
        <View pointerEvents="none" style={styles.pausedBadge}>
          <Text style={type.caption}>Paused · tap map to resume</Text>
        </View>
      ) : null}

      {/* Bottom: photos, caption, progress, actions */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.md }]} pointerEvents="box-none">
        {showPhotos ? <PhotoFan key={moment.id} moment={moment} onPress={() => openStop(moment.id)} /> : null}

        {showCaption ? (
          <Animated.View key={`cap-${moment.id}`} entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
            <Pressable style={styles.caption} onPress={() => openStop(moment.id)}>
              <Text style={type.caption}>
                {[moment.placeName, formatTime(moment.startAt)].filter(Boolean).join(' · ')}
              </Text>
              <Text style={[type.body, { marginTop: space.xs }]}>{moment.narration ?? moment.caption ?? ''}</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.dots}>
            {moments.map((m, i) => (
              <Pressable key={m.id} hitSlop={8} onPress={() => replay.jumpTo(i)}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: i <= index ? colors.accent : colors.line,
                      width: i === index ? 18 : 8,
                    },
                  ]}
                />
              </Pressable>
            ))}
          </View>
          <Pill label="Frame it" onPress={() => router.push({ pathname: '/frame/[id]', params: { id: trip.id } })} />
        </View>
      </View>
    </View>
  );
}

function Pill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.pill}>
      <Text style={[type.body, { fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
  title: { flex: 1, textAlign: 'center' },
  pill: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  pausedBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.md,
    gap: space.md,
  },
  caption: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { height: 8, borderRadius: radius.full },
});
