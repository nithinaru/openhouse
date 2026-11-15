import { Link } from 'expo-router';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { demoTrip } from '@/lib/demo/demoTrip';
import { colors, radius, space, type } from '@/theme';

// Trips list. Uses the cached demo trip until Convex queries land.
export default function TripsScreen() {
  const trips = [demoTrip];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
        <Text style={type.title}>Wish You Were Here</Text>
        {trips.map((t) => {
          const hero = t.moments[0]?.photos[0];
          return (
            <Link key={t.id} href={{ pathname: '/trip/[id]', params: { id: t.id } }} asChild>
              <Pressable style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
                {hero && <Image source={{ uri: hero.uri }} style={{ width: '100%', aspectRatio: 4 / 3 }} />}
                <View style={{ padding: space.md, gap: space.xs }}>
                  <Text style={type.heading}>{t.title}</Text>
                  <Text style={type.caption}>
                    {t.moments.length} stops · {t.people.length} people
                  </Text>
                </View>
              </Pressable>
            </Link>
          );
        })}
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Link href="/onboarding" style={type.caption}>Read my photos</Link>
          <Link href="/people" style={type.caption}>People</Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
