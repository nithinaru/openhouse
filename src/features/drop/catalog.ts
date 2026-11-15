// The drop catalog: every piece, its price, sizes, and (optionally) a real product photo.
//
// Each piece is drawn as a generated SVG mockup from the trip (src/features/drop/designs/*).
// When `image` is set, that photo is shown instead of the SVG front; `imageBack` replaces the
// back. Leave them unset to keep the generated design. See ./README.md.

export type PieceId = 'hoodie' | 'tee' | 'tote' | 'cap' | 'stickers' | 'pin';
export type Side = 'front' | 'back';
export type Edition = 'was_there' | 'public';

/** A bundled asset (`require('...png')`) or a remote https url. */
export type PieceImage = number | string;

export type PieceInfo = {
  id: PieceId;
  name: string;
  /** One line under the name in the sheet. */
  blurb: string;
  priceCents: number;
  sizes: string[] | null;
  /** viewBox of the SVG mockup; real photos are shown at this aspect ratio (contain). */
  box: { w: number; h: number };
  /** Real product photo, front. Replaces the generated SVG when present. */
  image?: PieceImage;
  /** Real product photo, back. Falls back to the generated back. */
  imageBack?: PieceImage;
};

const APPAREL = ['xs', 's', 'm', 'l', 'xl', 'xxl'];

export const PIECES: Record<PieceId, PieceInfo> = {
  hoodie: {
    id: 'hoodie',
    name: '“i was there” hoodie',
    blurb: 'heavyweight fleece · venue, coordinates and the date on the chest',
    priceCents: 7200,
    sizes: APPAREL,
    box: { w: 200, h: 220 },
    // image: require('../../../assets/merch/hoodie-front.png'),
    // imageBack: require('../../../assets/merch/hoodie-back.png'),
  },
  tee: {
    id: 'tee',
    name: 'route-map tee',
    blurb: 'garment-dyed cotton · your route through every stop on the back',
    priceCents: 3800,
    sizes: APPAREL,
    box: { w: 200, h: 210 },
    // image: require('../../../assets/merch/tee-front.png'),
    // imageBack: require('../../../assets/merch/tee-back.png'),
  },
  tote: {
    id: 'tote',
    name: 'cutout tote',
    blurb: 'natural canvas · everyone from the day as standees',
    priceCents: 2800,
    sizes: null,
    box: { w: 200, h: 230 },
    // image: require('../../../assets/merch/tote-front.png'),
    // imageBack: require('../../../assets/merch/tote-back.png'),
  },
  cap: {
    id: 'cap',
    name: 'dad cap',
    blurb: 'washed twill · embroidered route mark',
    priceCents: 3200,
    sizes: null,
    box: { w: 200, h: 160 },
    // image: require('../../../assets/merch/cap-front.png'),
    // imageBack: require('../../../assets/merch/cap-back.png'),
  },
  stickers: {
    id: 'stickers',
    name: 'sticker sheet',
    blurb: 'die-cut vinyl · every stop and everyone in it',
    priceCents: 800,
    sizes: null,
    box: { w: 200, h: 250 },
    // image: require('../../../assets/merch/stickers-front.png'),
    // imageBack: require('../../../assets/merch/stickers-back.png'),
  },
  pin: {
    id: 'pin',
    name: 'enamel pin',
    blurb: 'hard enamel, gold plate · the venue in a badge',
    priceCents: 1400,
    sizes: null,
    box: { w: 200, h: 200 },
    // image: require('../../../assets/merch/pin-front.png'),
    // imageBack: require('../../../assets/merch/pin-back.png'),
  },
};

export const PIECE_ORDER: PieceId[] = ['hoodie', 'tee', 'tote', 'cap', 'stickers', 'pin'];

/** "the full drop": all six pieces. */
export const BUNDLE_CENTS = 14900;
export const PIECES_TOTAL_CENTS = PIECE_ORDER.reduce((s, p) => s + PIECES[p].priceCents, 0);

/** The real photo for a side, if one is set. */
export function pieceImage(piece: PieceId, side: Side): PieceImage | undefined {
  const p = PIECES[piece];
  return side === 'back' ? p.imageBack : p.image;
}
