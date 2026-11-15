import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { peopleAt } from '@/features/replay/people';
import { useMoment } from '@/features/replay/useTrip';
import type { Photo } from '@/lib/types';
import { colors, radius, space, type } from '@/theme';

export default function StopScreen() {
  const { id, tripId } = useLocalSearchParams<{ id: string; tripId?: string }>();
  const { trip, moment } = useMoment(id, tripId);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [theirs, setTheirs] = useState(false);
  const [page, setPage] = useState(0);

  if (!moment) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={type.body}>Stop not found</Text>
        <Pressable onPress={() => router.back()} style={[styles.button, { marginTop: space.md }]}>
          <Text style={type.body}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const theirPhotos = trip.theirAngles?.[moment.id] ?? [];
  const hasTheirs = theirPhotos.length > 0;
  const photos: Photo[] = theirs && hasTheirs ? theirPhotos : moment.photos;
  const people = peopleAt(trip, moment.id);
  const friend = hasTheirs ? trip.people.find((p) => p.id === theirPhotos[0].userId) : undefined;
  const pageW = width - space.md * 2;

  const switchTo = (next: boolean) => {
    setTheirs(next);
    setPage(0);
  };

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={{ padding: space.md, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl, gap: space.md }}
    >
      <View style={styles.row}>
        <Text style={[type.title, { flex: 1 }]} numberOfLines={2}>
          {moment.placeName ?? 'Stop'}
        </Text>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.button}>
          <Text style={type.body}>Close</Text>
        </Pressable>
      </View>

      {hasTheirs ? (
        <View style={styles.toggle}>
          <ToggleItem label="Your photos" active={!theirs} onPress={() => switchTo(false)} />
          <ToggleItem label={`Their angle${friend ? ` · ${friend.name}` : ''}`} active={theirs} onPress={() => switchTo(true)} />
        </View>
      ) : null}

      {/* Photo carousel */}
      <View>
        <ScrollView
          key={theirs ? 'theirs' : 'mine'}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ width: pageW, borderRadius: radius.md }}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / pageW))}
        >
          {photos.map((p) => (
            <Image
              key={p.id}
              source={{ uri: p.uri }}
              style={{ width: pageW, height: (pageW * 3) / 4, backgroundColor: colors.surface }}
              contentFit="cover"
              transition={150}
            />
          ))}
        </ScrollView>
        {photos.length > 1 ? (
          <View style={styles.dots}>
            {photos.map((p, i) => (
              <View key={p.id} style={[styles.dot, { backgroundColor: i === page ? colors.text : colors.line }]} />
            ))}
          </View>
        ) : null}
      </View>

      {moment.caption ? <Text style={type.heading}>{moment.caption}</Text> : null}

      <Text style={type.caption}>
        {[
          formatTime(moment.startAt),
          moment.weather ? `${Math.round(moment.weather.tempF)}°F · ${moment.weather.summary}` : null,
          moment.isGoldenHour ? 'Golden hour' : null,
        ]
          .filter(Boolean)
          .join('  ·  ')}
      </Text>

      {moment.narration ? <Text style={type.body}>{moment.narration}</Text> : null}

      {moment.fact ? (
        <View style={styles.card}>
          <Text style={type.caption}>Nearby</Text>
          <Text style={[type.body, { marginTop: space.xs }]}>{moment.fact}</Text>
        </View>
      ) : null}

      {people.length ? (
        <View style={styles.card}>
          <Text style={type.caption}>Met here</Text>
          <View style={[styles.row, { marginTop: space.sm, flexWrap: 'wrap' }]}>
            {people.map((person) => (
              <View key={person.id} style={styles.person}>
                {person.avatarUri ? (
                  <Image source={{ uri: person.avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.center]}>
                    <Text style={type.caption}>{person.name[0]}</Text>
                  </View>
                )}
                <Text style={type.body}>{person.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Pressable
        style={[styles.button, styles.primary]}
        onPress={() => router.push({ pathname: '/walkin/[id]', params: { id: moment.id } })}
      >
        <Text style={[type.body, { fontWeight: '600', color: colors.bg }]}>Walk in</Text>
      </Pressable>
    </ScrollView>
  );
}

function ToggleItem({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toggleItem, active && { backgroundColor: colors.surface, borderColor: colors.line }]}
    >
      <Text style={[type.body, { color: active ? colors.text : colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  button: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    alignItems: 'center',
  },
  primary: { backgroundColor: colors.accent, paddingVertical: space.md },
  toggle: {
    flexDirection: 'row',
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: space.xs,
    gap: space.xs,
  },
  toggleItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.xs, marginTop: space.sm },
  dot: { width: 6, height: 6, borderRadius: radius.full },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginRight: space.md },
  avatar: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.line },
});
