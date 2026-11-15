import { Text, View } from 'react-native';

import { colors, type } from '@/theme';

// Placeholder. Owned by a feature agent; replace with the real screen.
export default function Screen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <Text style={type.body}>stop/[id]</Text>
    </View>
  );
}
