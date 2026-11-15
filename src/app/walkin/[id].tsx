import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WalkInViewer } from '@/features/walkin/WalkInViewer';
import { getDemoMoment, getDemoTrip } from '@/lib/demo/demoTrip';
import { colors, radius, space, type } from '@/theme';

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

      <Pressable
        onPress={close}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={({ pressed }) => [
          styles.close,
          { top: insets.top + space.sm, left: space.md, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={styles.closeGlyph}>×</Text>
      </Pressable>

      {moment?.placeName ? (
        <View
          pointerEvents="none"
          style={[styles.caption, { bottom: insets.bottom + space.md }]}
        >
          <Text style={type.caption} numberOfLines={1}>
            {moment.placeName}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  close: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { ...type.heading, lineHeight: 24 },
  caption: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '80%',
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
});
