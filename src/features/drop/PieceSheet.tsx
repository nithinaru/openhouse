// One piece, large: front/back flip, size picker, buy. A native page sheet (Modal pageSheet)
// so dismissal and the drag-down gesture are the platform's own.

import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCents } from '@/features/commerce/checkout';
import { PurchaseStatus } from '@/features/commerce/ui';
import type { Purchase } from '@/features/commerce/usePurchase';
import { colors, ease, fonts, radius, space, type } from '@/theme';
import { Button, Chip, haptic, Press, SheetHeader, SkyBackground } from '@/theme/ui';

import { PieceArt } from './designs';
import type { DropPaid } from './api';
import { PIECES, type DropArt, type Edition, type PieceId, type Side } from './model';

const FLIP_MS = 420;

export function PieceSheet({
  piece,
  art,
  edition,
  serial,
  size,
  onSize,
  onClose,
  onBuy,
  purchase,
  soldOut,
}: {
  piece: PieceId | null;
  art: DropArt;
  edition: Edition;
  serial?: string;
  size?: string;
  onSize: (piece: PieceId, size: string) => void;
  onClose: () => void;
  onBuy: (piece: PieceId) => void;
  purchase: Purchase<DropPaid>;
  soldOut: boolean;
}) {
  return (
    <Modal visible={piece != null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {piece ? (
        <SheetBody
          piece={piece}
          art={art}
          edition={edition}
          serial={serial}
          size={size}
          onSize={onSize}
          onClose={onClose}
          onBuy={onBuy}
          purchase={purchase}
          soldOut={soldOut}
        />
      ) : null}
    </Modal>
  );
}

function SheetBody({
  piece,
  art,
  edition,
  serial,
  size,
  onSize,
  onClose,
  onBuy,
  purchase,
  soldOut,
}: {
  piece: PieceId;
  art: DropArt;
  edition: Edition;
  serial?: string;
  size?: string;
  onSize: (piece: PieceId, size: string) => void;
  onClose: () => void;
  onBuy: (piece: PieceId) => void;
  purchase: Purchase<DropPaid>;
  soldOut: boolean;
}) {
  const info = PIECES[piece];
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [side, setSide] = useState<Side>('front');
  const flip = useSharedValue(0);

  useEffect(() => {
    // Spatial consistency: the garment turns over rather than swapping.
    flip.set(withTiming(side === 'back' ? 1 : 0, { duration: reduced ? 200 : FLIP_MS, easing: ease.inOut }));
  }, [flip, side, reduced]);

  const frontStyle = useAnimatedStyle(() => {
    const p = flip.get();
    return reduced
      ? { opacity: 1 - p }
      : { opacity: p < 0.5 ? 1 : 0, transform: [{ perspective: 900 }, { rotateY: `${p * 180}deg` }] };
  });
  const backStyle = useAnimatedStyle(() => {
    const p = flip.get();
    return reduced
      ? { opacity: p }
      : { opacity: p >= 0.5 ? 1 : 0, transform: [{ perspective: 900 }, { rotateY: `${p * 180 - 180}deg` }] };
  });

  const stageW = width - space.lg * 2;
  const artW = Math.min(stageW * 0.82, 340);
  const artH = (artW * info.box.h) / info.box.w;
  const turn = () => {
    haptic('selection');
    setSide((s) => (s === 'front' ? 'back' : 'front'));
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]}>
      <SheetHeader eyebrow={edition === 'was_there' ? '“was there” edition' : 'public edition'} title={info.name} onClose={onClose} />

      <Press onPress={turn} haptic="none" scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`showing the ${side}. tap to flip`}>
        <SkyBackground variant="soft" style={[styles.stage, { height: artH + space.xl * 2 }]}>
          <View style={StyleSheet.absoluteFill}>
            <Animated.View style={[styles.face, frontStyle]}>
              <PieceArt piece={piece} art={art} side="front" edition={edition} serial={serial} width={artW} />
            </Animated.View>
            <Animated.View style={[styles.face, backStyle]}>
              <PieceArt piece={piece} art={art} side="back" edition={edition} serial={serial} width={artW} />
            </Animated.View>
          </View>
        </SkyBackground>
      </Press>

      <View style={styles.sides}>
        {(['front', 'back'] as Side[]).map((s) => (
          <Chip
            key={s}
            label={s}
            onPress={() => s !== side && turn()}
            style={s === side ? styles.chipOn : undefined}
            textStyle={s === side ? { color: colors.accentInk } : undefined}
          />
        ))}
        <Text style={[type.caption, { marginLeft: 'auto' }]}>tap to flip</Text>
      </View>

      <Text style={type.callout}>{info.blurb}</Text>

      {info.sizes ? (
        <View style={{ gap: space.sm }}>
          <Text style={type.caption}>size</Text>
          <View style={styles.sizes}>
            {info.sizes.map((s) => {
              const on = (size ?? 'm') === s;
              return (
                <Press
                  key={s}
                  onPress={() => onSize(piece, s)}
                  haptic="selection"
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`size ${s}`}
                  style={[styles.size, on && styles.sizeOn]}
                >
                  <Text style={[styles.sizeText, on && { color: colors.accentInk }]}>{s}</Text>
                </Press>
              );
            })}
          </View>
        </View>
      ) : (
        <Text style={type.caption}>one size</Text>
      )}

      <Button
        label={soldOut ? 'sold out' : `buy · ${formatCents(info.priceCents)}`}
        disabled={soldOut}
        loading={purchase.busy}
        onPress={() => onBuy(piece)}
      />
      <PurchaseStatus purchase={purchase} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md },
  stage: { borderRadius: radius.xl, overflow: 'hidden' },
  face: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backfaceVisibility: 'hidden' },
  sides: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chipOn: { backgroundColor: colors.ink },
  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  size: {
    minWidth: 52,
    height: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  sizeOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  sizeText: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.2, color: colors.text },
});
