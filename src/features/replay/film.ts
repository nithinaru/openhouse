import { Platform } from 'react-native';
import { Easing } from 'react-native-reanimated';

// Local look for the Replay film. Builds on '@/theme'; the designer can fold
// these into the theme later.

export const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

export const INK = '#05070A'; // letterbox / scrim black, a hair warmer than pure black
export const LETTERBOX_H = 54;
