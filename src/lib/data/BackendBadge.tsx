import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '@/theme';

import { useBackendStatus } from './useBackendStatus';

const LABEL = { live: 'Live', offline: 'Offline demo', checking: 'Connecting' } as const;

/** Small pill: "Live" when Convex answers, "Offline demo" otherwise. Drop into any header. */
export function BackendBadge({ style }: { style?: StyleProp<ViewStyle> }) {
  const state = useBackendStatus();
  const live = state === 'live';
  return (
    <View
      style={[styles.pill, style]}
      accessibilityRole="text"
      accessibilityLabel={live ? 'Connected to live backend' : 'Offline demo data'}
    >
      <View style={[styles.dot, { backgroundColor: live ? colors.accent : colors.textMuted }]} />
      <Text style={styles.text}>{LABEL[state]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    minHeight: 24,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { color: colors.text, fontSize: 12, fontWeight: '600' },
});
