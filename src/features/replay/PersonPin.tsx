import { Image } from 'expo-image';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import type { Pairing, Person } from '@/lib/types';
import { colors, radius, type } from '@/theme';

const SIZE = 40;

export function PersonPin({ pairing, person }: { pairing: Pairing; person?: Person }) {
  // Keep re-rendering the marker snapshot until the remote avatar has loaded.
  const [loaded, setLoaded] = useState(!person?.avatarUri);
  return (
    <Marker
      identifier={`pairing-${pairing.id}`}
      coordinate={{ latitude: pairing.lat, longitude: pairing.lng }}
      anchor={{ x: 0.5, y: 1.2 }}
      tracksViewChanges={!loaded}
      title={person?.name}
    >
      <View
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: radius.full,
          borderWidth: 2,
          borderColor: colors.accent,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {person?.avatarUri ? (
          <Image
            source={{ uri: person.avatarUri }}
            style={{ width: SIZE, height: SIZE }}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        ) : (
          <Text style={type.caption}>{person?.name?.[0] ?? '?'}</Text>
        )}
      </View>
    </Marker>
  );
}
