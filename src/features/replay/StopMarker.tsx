import { View } from 'react-native';
import { Marker } from 'react-native-maps';
import Svg, { Circle, Path } from 'react-native-svg';

import type { Moment } from '@/lib/types';
import { colors } from '@/theme';

const SIZE = 64;
const HALF_ANGLE = 28; // degrees each side of the facing direction

// Wedge pointing "up" from the centre; the whole SVG is rotated to the heading.
function wedgePath(): string {
  const c = SIZE / 2;
  const r = SIZE / 2 - 2;
  const a1 = ((-90 - HALF_ANGLE) * Math.PI) / 180;
  const a2 = ((-90 + HALF_ANGLE) * Math.PI) / 180;
  const x1 = c + r * Math.cos(a1);
  const y1 = c + r * Math.sin(a1);
  const x2 = c + r * Math.cos(a2);
  const y2 = c + r * Math.sin(a2);
  return `M ${c} ${c} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
}

const WEDGE = wedgePath();

export function ViewCone({ rotationDeg, active }: { rotationDeg: number; active: boolean }) {
  return (
    <View style={{ width: SIZE, height: SIZE, transform: [{ rotate: `${rotationDeg}deg` }] }}>
      <Svg width={SIZE} height={SIZE}>
        <Path d={WEDGE} fill={colors.accent} fillOpacity={active ? 0.45 : 0.22} />
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={active ? 7 : 5} fill={colors.accent} stroke={colors.text} strokeWidth={2} />
      </Svg>
    </View>
  );
}

type Props = {
  moment: Moment;
  active: boolean;
  // Marker views stay screen-aligned while the camera rotates, so the cone is
  // drawn relative to the current camera heading to point the true way.
  cameraHeading: number;
  onPress: () => void;
};

export function StopMarker({ moment, active, cameraHeading, onPress }: Props) {
  const rotation = ((moment.headingDeg ?? 0) - cameraHeading + 360) % 360;
  return (
    <Marker
      identifier={moment.id}
      coordinate={{ latitude: moment.lat, longitude: moment.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={onPress}
      tracksViewChanges
    >
      {moment.headingDeg != null ? (
        <ViewCone rotationDeg={rotation} active={active} />
      ) : (
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: colors.accent,
            borderWidth: 2,
            borderColor: colors.text,
          }}
        />
      )}
    </Marker>
  );
}
