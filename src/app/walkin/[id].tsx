import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMoment } from '@/features/replay/useTrip';
import { WalkInViewer, type WalkInBadge } from '@/features/walkin/WalkInViewer';
import { colors, space } from '@/theme';
import { PinIcon } from '@/theme/icons';
import { CloseButton, Sticker } from '@/theme/ui';

export default function WalkInScreen() {
  // splat + badge come from the World Labs build screen (/world/[id]); without them the
  // viewer picks the moment's own splat (worldSplatUrl via trips.get) or the sample.
  const { id, tripId, splat, badge } = useLocalSearchParams<{ id: string; tripId?: string; splat?: string; badge?: WalkInBadge }>();
  const insets = useSafeAreaInsets();
  const { trip, moment } = useMoment(id, tripId);
  const palette = trip.palette;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={styles.root}>
      <WalkInViewer moment={moment} palette={palette} splatUrl={splat || undefined} badge={badge || undefined} />

      <View style={[styles.close, { top: insets.top + space.sm }]}>
        <CloseButton tone="media" onPress={close} />
      </View>

      {moment?.placeName ? (
        <View pointerEvents="none" style={[styles.caption, { bottom: insets.bottom + space.md }]}>
          <Sticker label={moment.placeName} rotate={-3} icon={<PinIcon size={14} color={colors.pinkEdge} />} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sky },
  close: { position: 'absolute', left: space.md },
  caption: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
});
