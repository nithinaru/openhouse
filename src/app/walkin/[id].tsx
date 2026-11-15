import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WalkInViewer } from '@/features/walkin/WalkInViewer';
import { getDemoMoment, getDemoTrip } from '@/lib/demo/demoTrip';
import { colors, space } from '@/theme';
import { PinIcon } from '@/theme/icons';
import { CloseButton, Sticker } from '@/theme/ui';

export default function WalkInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  // TODO: replace with Convex useQuery(api.worlds.forMoment, { momentId: id }).
  const moment = id ? getDemoMoment(id) : undefined;
  const palette = getDemoTrip(moment?.tripId).palette;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={styles.root}>
      <WalkInViewer moment={moment} palette={palette} />

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
