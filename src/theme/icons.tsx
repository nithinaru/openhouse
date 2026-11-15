import Svg, { Circle, Path } from 'react-native-svg';

// One line-icon set: 24 grid, 1.75 stroke, round caps. Icons take the color of the
// text next to them; they never get their own.

type IconProps = { size?: number; color: string };

const base = (size: number, color: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color,
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function ClockIcon({ size = 16, color }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function PinIcon({ size = 16, color }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <Circle cx={12} cy={9.5} r={2.5} />
    </Svg>
  );
}

export function CloudIcon({ size = 16, color }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.1 4.5 4.5 0 0 0 7 18z" />
    </Svg>
  );
}

export function SunIcon({ size = 16, color }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
    </Svg>
  );
}

export function CloseIcon({ size = 16, color }: IconProps) {
  return (
    <Svg {...base(size, color)} strokeWidth={2}>
      <Path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function BackIcon({ size = 18, color }: IconProps) {
  return (
    <Svg {...base(size, color)} strokeWidth={2}>
      <Path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 16, color }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M9 5l7 7-7 7" />
    </Svg>
  );
}

export function ArrowIcon({ size = 18, color }: IconProps) {
  return (
    <Svg {...base(size, color)} strokeWidth={2}>
      <Path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

export function ChevronsIcon({ size = 18, color }: IconProps) {
  return (
    <Svg {...base(size, color)} strokeWidth={2}>
      <Path d="M9 6l-5 6 5 6M15 6l5 6-5 6" />
    </Svg>
  );
}

export function PlayIcon({ size = 16, color }: IconProps) {
  return (
    <Svg {...base(size, color)} fill={color}>
      <Path d="M8 5.5v13l10-6.5z" />
    </Svg>
  );
}

export function PauseIcon({ size = 16, color }: IconProps) {
  return (
    <Svg {...base(size, color)} strokeWidth={2.4}>
      <Path d="M9 6v12M15 6v12" />
    </Svg>
  );
}

export function PeopleIcon({ size = 18, color }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Circle cx={9} cy={8.5} r={3.5} />
      <Path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
      <Path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c1.8.7 3 2.4 3.5 5.2" />
    </Svg>
  );
}

export function HouseIcon({ size = 18, color }: IconProps) {
  return (
    <Svg {...base(size, color)} strokeWidth={2}>
      <Path d="M3.5 11 12 4l8.5 7" />
      <Path d="M6 9.5V20h12V9.5" />
      <Path d="M10 20v-5.5h4V20" />
    </Svg>
  );
}

export function MapIcon({ size = 18, color }: IconProps) {
  return (
    <Svg {...base(size, color)} strokeWidth={2}>
      <Path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z" />
      <Path d="M9 4.5v13M15 6.5v13" />
    </Svg>
  );
}

export function PlusIcon({ size = 18, color }: IconProps) {
  return (
    <Svg {...base(size, color)} strokeWidth={2.2}>
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function ChatIcon({ size = 18, color }: IconProps) {
  return (
    <Svg {...base(size, color)} strokeWidth={2}>
      <Path d="M5 18.5 4 21l3.6-1.6A9 9 0 1 0 3 12a8.9 8.9 0 0 0 2 6.5z" />
      <Path d="M8.5 12h.01M12 12h.01M15.5 12h.01" strokeWidth={2.6} />
    </Svg>
  );
}

/** Hand-drawn star doodle for scrapbook margins. */
export function StarDoodleIcon({ size = 24, color }: IconProps) {
  return (
    <Svg {...base(size, color)} strokeWidth={1.5}>
      <Path d="M12 2.8l2.6 6.4 6.6.4-5.1 4.3 1.7 6.6L12 16.8l-5.8 3.7 1.7-6.6-5.1-4.3 6.6-.4z" />
      <Path d="M12.4 3.6 10.2 9.8" />
    </Svg>
  );
}

export function SpeakerIcon({ size = 16, color }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
      <Path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </Svg>
  );
}
