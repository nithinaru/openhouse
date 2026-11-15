import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Pressed scale. 0.97 for cards, 0.96 for buttons. */
  scaleTo?: number;
  haptic?: 'light' | 'medium' | 'none';
};

// Feedback on press-in (scale down, UI thread), commit on press-out with one haptic.
export function PressableScale({ children, style, scaleTo = 0.97, haptic = 'light', onPressIn, onPressOut, onPress, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      {...rest}
      pressRetentionOffset={{ top: 20, left: 20, right: 20, bottom: 20 }}
      onPressIn={(e) => {
        scale.set(withTiming(scaleTo, { duration: 110, easing: EASE_OUT, reduceMotion: ReduceMotion.System }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, { duration: 160, easing: EASE_OUT, reduceMotion: ReduceMotion.System }));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic !== 'none') {
          void Haptics.impactAsync(haptic === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
        }
        onPress?.(e);
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}
