import { Image } from 'expo-image';
import { memo } from 'react';

import { pieceImage, PIECES } from '../catalog';
import type { DropArt, Edition, PieceId, Side } from '../model';
import { Cap } from './Cap';
import { Hoodie } from './Hoodie';
import { Pin } from './Pin';
import { Stickers } from './Stickers';
import { Tee } from './Tee';
import { Tote } from './Tote';

export type PieceArtProps = { piece: PieceId; art: DropArt; side?: Side; edition: Edition; serial?: string; width: number };

/**
 * One drop piece as a merch mockup. A real product photo from ./catalog.ts wins when set;
 * otherwise the generated SVG drawn from the trip. Height follows PIECES[piece].box.
 */
export const PieceArt = memo(function PieceArt({ piece, side = 'front', ...rest }: PieceArtProps) {
  const photo = pieceImage(piece, side);
  if (photo != null) {
    const { w, h } = PIECES[piece].box;
    return (
      <Image
        source={typeof photo === 'string' ? { uri: photo } : photo}
        style={{ width: rest.width, height: (rest.width * h) / w }}
        contentFit="contain"
        transition={150}
        accessibilityIgnoresInvertColors
      />
    );
  }
  const p = { side, ...rest };
  switch (piece) {
    case 'hoodie':
      return <Hoodie {...p} />;
    case 'tee':
      return <Tee {...p} />;
    case 'tote':
      return <Tote {...p} />;
    case 'cap':
      return <Cap {...p} />;
    case 'stickers':
      return <Stickers {...p} />;
    case 'pin':
      return <Pin {...p} />;
  }
});
