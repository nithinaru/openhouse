import { Easing } from 'react-native-reanimated';

// Curves shared by the stop, frame and people screens.
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1); // strong ease-out for UI
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1); // on-screen movement

export function clamp(v: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(v, min), max);
}
