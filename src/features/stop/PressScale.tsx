import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { EASE_OUT } from './motion';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** Scale while pressed. */
  to?: number;
};

/** Pressable that scales down on press-in (feedback) and commits on press-out. */
export function PressScale({ style, children, to = 0.97, onPressIn, onPressOut, ...rest }: Props) {
  const s = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));

  return (
    <Pressable
      {...rest}
      pressRetentionOffset={16}
      onPressIn={(e) => {
        s.set(withTiming(to, { duration: 100, easing: EASE_OUT }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.set(withTiming(1, { duration: 150, easing: EASE_OUT }));
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}
