import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import MapView, { Marker, type Camera } from 'react-native-maps';
import { useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppDock } from '@/features/dock/Dock';
import { activeMoment, clock, framesAt, momentForRoom, peopleCopy, placementsAt } from '@/features/house/model';
import { RoomPin, RoomSticker } from '@/features/house/RoomSticker';
import { Standee } from '@/features/house/Standee';
import { TimeSlider } from '@/features/house/TimeSlider';
import { HOUSE_DAY, HOUSE_PEOPLE, ROOMS, roomForMoment, VENUE, type Room } from '@/lib/demo/demoHouse';
import { DEMO_TRIP_ID, getDemoTrip } from '@/lib/demo/demoTrip';
import { colors, fonts, radius, shadow, space, type } from '@/theme';
import { BackIcon } from '@/theme/icons';
import { Chip, haptic, IconButton } from '@/theme/ui';

// "the house": today's hackathon as a 3D place you can spin. Apple's photoreal flyover
// of the real venue (560 20th St, Dogpatch), slowly orbiting, with everyone standing as
// a cardboard cutout where they stood and a time slider that walks them through the day.
// The house is demo content (src/lib/demo/demoHouse.ts), so it always reads the cached trip.

const ORBIT_DEG_PER_S = 4;
const RESUME_AFTER_MS = 2600;
const STANDEE_H = 96;
const STANDEE_GAP = 54;
const PITCH = 60;
const FLYOVER_OK = Platform.OS === 'ios';
/** Roughly how much of the screen the bottom sheet covers; the map centers above it. */
const SHEET_H = 300;

// Center on the venue's own rooms (not the far-off park), nudged north so the
// cutouts sit above the bottom sheet instead of at the screen edge.
const VENUE_ROOMS = ROOMS.filter((r) => r.key === 'door' || r.key === 'hall' || r.key === 'floor');
const CENTER = {
  latitude: VENUE_ROOMS.reduce((s, r) => s + r.lat, 0) / VENUE_ROOMS.length - 0.0004,
  longitude: VENUE_ROOMS.reduce((s, r) => s + r.lng, 0) / VENUE_ROOMS.length,
};

// Start where everyone was together: the hacking floor just before noon.
const INITIAL_HEADING = 24;
const INITIAL_CAMERA: Camera = { center: CENTER, pitch: PITCH, heading: INITIAL_HEADING, altitude: 1150, zoom: 16.2 };

const START_T = HOUSE_DAY.start + (3 * 60 + 40) * 60_000;

export default function HouseScreen() {
  const trip = getDemoTrip(DEMO_TRIP_ID);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [map, setMap] = useState<MapView | null>(null);
  const [flyover, setFlyover] = useState(FLYOVER_OK);
  const [t, setT] = useState(START_T);

  // Camera state the gestures and the orbit loop share (JS-side shared values: no re-renders).
  const heading = useSharedValue(INITIAL_HEADING);
  const spinFrom = useSharedValue(0);
  const holding = useSharedValue(false);
  const resumeIn = useSharedValue(0);
  const ready = useSharedValue(false);

  // Slow orbit: a few degrees a second, paused while a finger is on the map and for a
  // beat after it lifts.
  useEffect(() => {
    if (reduced || !map) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? now - last : 0;
      if (dt < 32 && last) return; // ~30 fps is plenty for a slow turn
      last = now;
      if (!ready.get() || holding.get()) return;
      if (resumeIn.get() > 0) {
        resumeIn.set(resumeIn.get() - dt);
        return;
      }
      heading.set((heading.get() + (ORBIT_DEG_PER_S * dt) / 1000) % 360);
      map.setCamera({ heading: heading.get() });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, map, ready, holding, resumeIn, heading]);

  const hold = () => holding.set(true);
  const release = () => {
    holding.set(false);
    resumeIn.set(RESUME_AFTER_MS);
    // A native two-finger rotate may have moved the camera: pick up from there.
    map
      ?.getCamera()
      .then((c) => {
        if (typeof c.heading === 'number') heading.set(c.heading);
      })
      .catch(() => {});
  };

  // One finger, sideways: spin the house. Runs on JS because it drives the native map camera.
  const spin = Gesture.Pan()
    .runOnJS(true)
    .maxPointers(1)
    .activeOffsetX([-12, 12])
    .failOffsetY([-24, 24])
    .onStart(() => {
      hold();
      spinFrom.set(heading.get());
    })
    .onUpdate((e) => {
      heading.set((((spinFrom.get() - e.translationX * 0.4) % 360) + 360) % 360);
      map?.setCamera({ heading: heading.get() });
    })
    .onFinalize(() => release());

  const moment = activeMoment(trip, t);
  const hereRoom = moment ? roomForMoment(moment.id) : undefined;
  const placements = useMemo(() => placementsAt(t), [t]);
  const hereCount = placements.filter((p) => p.room.key === hereRoom?.key).length;

  const lastRoom = useRef(hereRoom?.key);
  useEffect(() => {
    if (lastRoom.current !== hereRoom?.key) {
      lastRoom.current = hereRoom?.key;
      haptic('selection');
    }
  }, [hereRoom?.key]);

  const roomState = (room: Room): 'here' | 'seen' | 'later' => {
    if (room.key === hereRoom?.key) return 'here';
    return framesAt(trip, room, t) > 0 ? 'seen' : 'later';
  };

  const openRoom = (room: Room) => {
    router.push({ pathname: '/stop/[id]', params: { id: momentForRoom(trip, room, t), tripId: DEMO_TRIP_ID } });
  };
  const openPerson = (id: string) => router.push(`/house/person/${id}` as Href);

  const marks = trip.moments.map((m) => m.startAt);

  return (
    <View style={styles.root}>
      <GestureDetector gesture={spin}>
        <View style={StyleSheet.absoluteFill} onTouchStart={hold} onTouchEnd={release} onTouchCancel={release}>
          <MapView
            ref={setMap}
            style={StyleSheet.absoluteFill}
            mapType={flyover ? 'hybridFlyover' : 'standard'}
            initialCamera={INITIAL_CAMERA}
            mapPadding={{ top: insets.top + 56, bottom: SHEET_H, left: 0, right: 0 }}
            onMapReady={() => {
              ready.set(true);
            }}
            showsBuildings
            pitchEnabled
            rotateEnabled
            zoomEnabled
            scrollEnabled={false}
            showsCompass={false}
            showsPointsOfInterests={false}
            showsUserLocation={false}
            toolbarEnabled={false}
            accessibilityLabel={`3d view of ${VENUE.address}`}
          >
            {ROOMS.map((room) => {
              const state = roomState(room);
              const frames = framesAt(trip, room, t);
              return [
                <Marker
                  key={`${room.key}-pin-${state}`}
                  coordinate={{ latitude: room.lat, longitude: room.lng }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  onPress={() => openRoom(room)}
                  stopPropagation
                >
                  <RoomPin active={state === 'here'} />
                </Marker>,
                <Marker
                  key={`${room.key}-sticker-${state}-${frames}`}
                  coordinate={{ latitude: room.lat, longitude: room.lng }}
                  centerOffset={room.nudge}
                  onPress={() => openRoom(room)}
                  stopPropagation
                  zIndex={state === 'here' ? 3 : 1}
                >
                  <RoomSticker label={room.label} frames={frames} state={state} rotate={room.nudge.x < 0 ? -4 : room.nudge.x > 0 ? 3 : -2} />
                </Marker>,
              ];
            })}

            {placements.map(({ person, room, index, count }) => (
              <Marker
                key={person.id}
                coordinate={{ latitude: room.lat, longitude: room.lng }}
                centerOffset={{ x: (index - (count - 1) / 2) * STANDEE_GAP, y: -(STANDEE_H + 22) / 2 }}
                anchor={{ x: 0.5, y: 1 }}
                onPress={() => openPerson(person.id)}
                stopPropagation
                zIndex={5 + index}
              >
                <Standee person={person} height={STANDEE_H} tagRotate={index % 2 ? 4 : -5} />
              </Marker>
            ))}
          </MapView>
        </View>
      </GestureDetector>

      {/* top: back, place pill, flyover toggle */}
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <IconButton icon={<BackIcon color={colors.text} />} label="back" tone="media" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={styles.placePill}>
          <Text style={styles.placeText} numberOfLines={1}>
            {VENUE.name} · 560 20th st
          </Text>
          <Text style={styles.placeMeta} numberOfLines={1}>
            · nov 15
          </Text>
        </View>
        {FLYOVER_OK ? (
          <Chip label={flyover ? '3d' : 'map'} tone="media" onPress={() => setFlyover((v) => !v)} style={styles.toggle} />
        ) : (
          <View style={styles.toggle} />
        )}
      </View>

      {/* bottom sheet: who stood here, when, and the dock */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.sm }]}>
        <View style={styles.grabber} />
        <View style={styles.sheetRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {peopleCopy(hereCount)}
            </Text>
            <Text style={styles.sheetSub} numberOfLines={1}>
              {hereRoom?.label ?? 'the house'} · {hereCount ? 'tap a cutout' : 'drag the day forward'}
            </Text>
          </View>
          <View style={styles.timePill}>
            <Text style={styles.timeText}>{clock(t)}</Text>
          </View>
        </View>
        <TimeSlider start={HOUSE_DAY.start} end={HOUSE_DAY.end} initial={START_T} marks={marks} onChange={setT} />
        <View style={styles.sliderEnds}>
          <Text style={styles.endText}>8 am · doors</Text>
          <Text style={styles.endText}>{HOUSE_PEOPLE.length} people · 8 pm</Text>
        </View>
        <Text style={styles.hint}>drag to spin · tap a stop to step in</Text>
        <AppDock active="house" tripId={trip.id} style={styles.dock} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sky },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    gap: space.sm,
  },
  placePill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    backgroundColor: colors.scrimStrong,
    borderRadius: radius.full,
    paddingHorizontal: 18,
    height: 44,
    paddingTop: 11,
    ...shadow.chip,
  },
  placeText: { fontFamily: fonts.bold, fontSize: 17, letterSpacing: -0.4, color: colors.text, textTransform: 'lowercase' },
  placeMeta: { ...type.caption, fontSize: 14 },
  toggle: { minWidth: 56, justifyContent: 'center' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: space.sm,
    ...shadow.float,
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: colors.elevated, marginBottom: space.md },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sheetTitle: { ...type.title, fontSize: 26, lineHeight: 30, letterSpacing: -1 },
  sheetSub: { ...type.callout, color: colors.textMuted, marginTop: 2 },
  timePill: { backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: 16, height: 44, justifyContent: 'center' },
  timeText: { fontFamily: fonts.bold, fontSize: 17, letterSpacing: -0.3, color: colors.text, fontVariant: ['tabular-nums'] },
  sliderEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  endText: { ...type.stamp, color: colors.textFaint },
  hint: { ...type.callout, color: colors.textMuted, textAlign: 'center', marginTop: space.md },
  dock: { marginTop: space.md, alignSelf: 'center', width: '86%' },
});
