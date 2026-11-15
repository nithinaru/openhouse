// The collection laid flat on a sky board, like a designer's monitor shot: every piece a
// little crooked, overlapping just enough. Tap a piece to open it large.

import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { duration, ease, radius, shadow } from '@/theme';
import { Press, SkyBackground, Sticker } from '@/theme/ui';

import { PieceArt } from './designs';
import { PIECES, type DropArt, type Edition, type PieceId, type Side } from './model';

type Spot = { piece: PieceId; x: number; y: number; w: number; rot: number; side: Side };

// Fractions of the board width (the board is 1.24 widths tall).
const SPOTS: Spot[] = [
  { piece: 'hoodie', x: 0.02, y: 0.02, w: 0.5, rot: -3, side: 'front' },
  { piece: 'tee', x: 0.5, y: 0.03, w: 0.48, rot: 4, side: 'back' },
  { piece: 'cap', x: 0.53, y: 0.57, w: 0.42, rot: 7, side: 'front' },
  { piece: 'tote', x: 0.03, y: 0.62, w: 0.42, rot: -4, side: 'front' },
  { piece: 'stickers', x: 0.47, y: 0.86, w: 0.27, rot: -7, side: 'front' },
  { piece: 'pin', x: 0.77, y: 0.95, w: 0.19, rot: 10, side: 'front' },
];

export const BOARD_RATIO = 1.24;

export function FlatLay({
  art,
  edition,
  serial,
  width,
  onOpen,
}: {
  art: DropArt;
  edition: Edition;
  serial?: string;
  width: number;
  onOpen: (piece: PieceId) => void;
}) {
  const reduced = useReducedMotion();
  return (
    <View style={[styles.board, { width, height: width * BOARD_RATIO }]}>
      <SkyBackground variant="soft" style={StyleSheet.absoluteFill} />
      {SPOTS.map((s, i) => {
        const w = s.w * width;
        return (
          <Animated.View
            key={s.piece}
            entering={
              reduced
                ? FadeIn.duration(duration.base)
                : FadeInDown.duration(duration.enter)
                    .delay(120 + i * 70)
                    .easing(ease.out)
            }
            style={[styles.spot, { left: s.x * width, top: s.y * width, width: w, transform: [{ rotate: `${s.rot}deg` }] }]}
          >
            <Press onPress={() => onOpen(s.piece)} accessibilityRole="button" accessibilityLabel={`open the ${PIECES[s.piece].name}`} haptic="selection">
              <View style={shadow.print}>
                <PieceArt piece={s.piece} art={art} side={s.side} edition={edition} serial={serial} width={w} />
              </View>
            </Press>
          </Animated.View>
        );
      })}
      <Sticker label={art.dateLong} small rotate={-6} style={[styles.tag, { top: width * 1.15 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  board: { borderRadius: radius.xl, overflow: 'hidden', alignSelf: 'center' },
  spot: { position: 'absolute' },
  tag: { position: 'absolute', left: 16 },
});
