/**
 * The universal button, as the designer's `button-tokens.json` of 5 Nov 2026
 * gives it (in the repository's `assets/ui/tokens`, kept as she delivered it
 * and left out of the package): every length in px at her @3x reference,
 * 1290 x 2796, three to a point, scaled like every other part of a screen.
 * Her file but for its ten tier tints, which are the Daily Wheel's and live
 * in the wheel, and for a size class only one game draws, which that game
 * passes as its own; a test holds these to her file.
 */
export const BUTTON_TOKENS = {
  /** The fill of every button that is not a Daily Wheel tier's SPIN. */
  baseHex: '#F1998F',
  /** The sprites' own sizes, in their pixels. */
  master: {
    /** The faces' and the frame's height, and so their H at full size. */
    fileH: 275,
    frameW: 807,
    /** Each side's cap of the faces and the frame, kept whole. */
    cap: 140,
    glowW: 981,
    glowH: 455,
    glowCap: 227,
    /** Where the pill sits in the glow's canvas, across and down. */
    glowOffset: [87, 90],
    /** The fill's inset under the frame, on every side, at H 275. */
    fillInset: 8,
  },
  /** Each size class: its height, label size, padding either side of the label and least width. */
  sizes: {
    spin: { H: 275, font: 152, pad: 207, minW: 0 },
    howtoplay: { H: 218, font: 91, pad: 166, minW: 0 },
    popup: { H: 162, font: 66, pad: 114, minW: 474 },
  },
  label: {
    /** Set in capitals, in Inter Black. */
    idle: '#FDF6F6',
    active: '#FDF6F6',
    pressed: '#E9E2E2',
    /** Straight down, under the label, in px whatever the size. */
    shadowIdle: {
      color: '#14080A',
      opacity: 0.75,
      offsetYPx: 5,
      blurSigmaPx: 8,
    },
    shadowPressed: {
      color: '#14080A',
      opacity: 0.65,
      offsetYPx: 3,
      blurSigmaPx: 5,
    },
  },
  press: { scale: 0.97, downMs: 80, upMs: 160 },
} as const;

/**
 * Her label sizes in `sizes` were set for Pliant Black, whose capitals
 * stand 714 of its 1000 units; the labels are now Inter Black, whose
 * capitals stand 1490 of its 2048 (both cuts of Inter 4). A label at her
 * size times this, 0.98139, has the capitals hers had: SPIN's 152 px is
 * 149.17 px of Inter, its capitals 108.5 px tall either way.
 */
export const LABEL_CAP_SCALE = 714 / 1000 / (1490 / 2048);

/** One of the kit's size classes, by name. */
export type UiButtonSize = keyof typeof BUTTON_TOKENS.sizes;

/**
 * A size class as `BUTTON_TOKENS.sizes` holds one, in px at her reference:
 * what a game passes as `size` for a button of its own size.
 */
export type UiButtonSizeClass = {
  readonly H: number;
  readonly font: number;
  readonly pad: number;
  readonly minW: number;
};

/**
 * How far the label drops while pressed, in px: her `round(0.024 x H)`,
 * whole px, 7, 6, 5 and 4 for her four heights.
 */
export const pressDrop = (H: number): number => Math.round(0.024 * H);

/**
 * How far past its words the label's shadow can reach, in px: three of the
 * resting shadow's sigma. The label's boxes leave this much room on every
 * side, so no platform cuts the shadow at the box's edge.
 */
export const SHADOW_REACH_PX = 3 * BUTTON_TOKENS.label.shadowIdle.blurSigmaPx;

/**
 * The middle of the frame's gold band, in from the pill's edge, as a share
 * of its height: 6.5 of her frame's 275 px, the band being 13 px deep at
 * alpha past half on her 5 Nov export. A glow laid along the band is
 * placed by it: see `glowRing`.
 */
export const FRAME_BAND = 6.5 / 275;

/**
 * How much of the pill each resting face covers: its mean alpha over the
 * 190,077 px of her 807 x 275 sprites where the fill is whole, measured on
 * her 5 Nov exports. The `even` cross of the faces holds the pressed face
 * back by it. It holds while `buttonFiles.test.ts` holds her sprites' md5s:
 * a new export of the faces is measured again.
 */
export const FACE_COVER = { idle: 0.697, active: 0.637 } as const;
