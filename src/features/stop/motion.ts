import { ease } from '@/theme';

// Curves come from the theme; these names stay for existing imports.
export const EASE_OUT = ease.out;
export const EASE_IN_OUT = ease.inOut;

export function clamp(v: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(v, min), max);
}
