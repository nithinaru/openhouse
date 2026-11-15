import { forwardRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { Trip } from '@/lib/types';

import { Poster, type PosterVariant } from './Poster';

export type FrameStyle = {
  /** Wall behind the frame. */
  wall: string;
  frame: string;
  /** Inner lip of the moulding, a shade darker than the frame. */
  lip: string;
  frameWidth: number;
  mat: string;
  matWidth: number;
};

export const FRAME_STYLES: Record<PosterVariant, FrameStyle> = {
  minimal: { wall: '#D9D4CB', frame: '#F5F2EC', lip: '#D6D0C4', frameWidth: 11, mat: '#FFFFFF', matWidth: 16 },
  night: { wall: '#2C3342', frame: '#141414', lip: '#2B2B2B', frameWidth: 12, mat: '#0A0F1B', matWidth: 6 },
  field: { wall: '#8E7C62', frame: '#9A6A3E', lip: '#6E4826', frameWidth: 13, mat: '#F4ECDD', matWidth: 16 },
};

/** Outer width taken by frame + mat on one side. */
export function frameInset(variant: PosterVariant): number {
  const f = FRAME_STYLES[variant];
  return f.frameWidth + 1 + f.matWidth;
}

type Props = { trip: Trip; variant: PosterVariant; posterWidth: number };

/** A poster in a moulded frame with a mat, a soft wall shadow and a glass sheen. */
export const FramedPoster = forwardRef<ComponentRef<typeof View>, Props>(function FramedPoster({ trip, variant, posterWidth }, ref) {
  const f = FRAME_STYLES[variant];
  const posterH = (posterWidth * 4) / 3;

  return (
    <View style={styles.shadow}>
      <View ref={ref} collapsable={false} style={{ backgroundColor: f.frame, padding: f.frameWidth }}>
        <View style={{ borderWidth: 1, borderColor: f.lip, backgroundColor: f.mat, padding: f.matWidth }}>
          <View style={{ width: posterWidth, height: posterH }}>
            <Poster trip={trip} width={posterWidth} variant={variant} />
            {/* Mat bevel: a hairline shadow where the mat is cut. */}
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.25)' }]} />
          </View>
        </View>
        <Sheen id={variant} />
      </View>
    </View>
  );
});

function Sheen({ id }: { id: string }) {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id={`sheen-${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <Stop offset="0.35" stopColor="#fff" stopOpacity="0.03" />
          <Stop offset="0.36" stopColor="#fff" stopOpacity="0" />
          <Stop offset="1" stopColor="#fff" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#sheen-${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 16 },
    elevation: 14,
  },
});
