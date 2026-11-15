import { Press, type PressProps } from '@/theme/ui';

type Props = Omit<PressProps, 'scaleTo'> & {
  /** Scale while pressed. */
  to?: number;
};

/** Thin alias over the shared Press control (scale on press-in, commit on press-out). */
export function PressScale({ to = 0.97, haptic = 'none', ...rest }: Props) {
  return <Press scaleTo={to} haptic={haptic} {...rest} />;
}
