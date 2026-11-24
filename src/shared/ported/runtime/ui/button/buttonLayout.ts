// From MiniGames packages/runtime/src/ui/button/buttonLayout.ts (0.11.0): the layout half, without the press worklets.
import {
  BUTTON_TOKENS,
  LABEL_CAP_SCALE,
  SHADOW_REACH_PX,
  pressDrop,
} from '../tokens';
import type { UiButtonSize, UiButtonSizeClass } from '../tokens';

const { master, sizes } = BUTTON_TOKENS;

const sizeClass = (
  size: UiButtonSize | UiButtonSizeClass,
): UiButtonSizeClass => (typeof size === 'string' ? sizes[size] : size);

export type Snap = (points: number) => number;

/** How a sprite of its own size is cut into a left cap, a middle and a right cap. */
export type SliceLayout = {
  /** Each cap's width, whole device pixels. */
  cap: number;
  /** The whole sprite at the slice height, drawn in a cap and clipped. */
  sprite: { width: number; height: number };
  /** The sprite in the middle, stretched: its width and left as shares of the middle's box. */
  middle: { width: `${number}%`; left: `${number}%` };
};

/**
 * The 3-slice rule, as the designer's `BettyButton.tsx` cuts a sprite `w0`
 * by `h0` px with caps `cap` px wide, to `height` points: scaled to that
 * height, its caps kept whole and only its middle stretched, by shares of
 * the middle's own box, so nothing is measured.
 */
export function sliceLayout(
  w0: number,
  h0: number,
  cap: number,
  height: number,
  snap: Snap,
): SliceLayout {
  const k = height / h0;
  const mid = w0 - 2 * cap;
  return {
    cap: snap(cap * k),
    sprite: { width: w0 * k, height },
    middle: {
      width: `${(w0 / mid) * 100}%`,
      left: `${(-cap / mid) * 100}%`,
    },
  };
}

/** A text shadow, as React Native styles one. */
export type ButtonLayout = {
  /** The pill's height, whole device pixels. */
  H: number;
  /** Points per px of the sprites, from the snapped height. */
  k: number;
  fontSize: number;
  /** Either side of the label, inside the pill. */
  pad: number;
  minWidth: number;
  /** The fill's inset under the frame, on every side. */
  fillInset: number;
  /** The glow's box round the pill: above it, past either side, and its height. */
  glow: { top: number; side: number; height: number };
  /** How far the label drops while pressed. */
  drop: number;
  /** How far the label's boxes reach past its words, on every side, for its shadow. */
  reach: number;
};

/**
 * Where everything in a button goes, in points, for size class `size` on a
 * screen whose layout scale is `scale` points per px at the designer's
 * reference (a board's k / 3, a sheet's scale / 3): her numbers, the height
 * snapped to device pixels as her component snaps it and `k` taken from it,
 * and the label at the size that gives Inter Black her capitals.
 */
export function buttonLayout(
  size: UiButtonSize | UiButtonSizeClass,
  scale: number,
  snap: Snap,
): ButtonLayout {
  const s = sizeClass(size);
  const H = snap(s.H * scale);
  const k = H / master.fileH;
  return {
    H,
    k,
    fontSize: s.font * LABEL_CAP_SCALE * scale,
    pad: s.pad * scale,
    minWidth: s.minW * scale,
    fillInset: master.fillInset * k,
    glow: {
      top: -master.glowOffset[1] * k,
      side: -master.glowOffset[0] * k,
      height: master.glowH * k,
    },
    drop: pressDrop(s.H) * scale,
    reach: SHADOW_REACH_PX * scale,
  };
}

/**
 * The button's width in px at her reference for a label `labelPx` wide: her
 * `W = max(minW, label + 2 x pad)`. Only a statement of her rule, for its
 * tests and her widths: the button itself gets its width from layout.
 */
export function buttonWidth(
  size: UiButtonSize | UiButtonSizeClass,
  labelPx: number,
): number {
  const s = sizeClass(size);
  return Math.max(s.minW, labelPx + 2 * s.pad);
}

/** `#RRGGBB` at `opacity`, as `rgba()`. */
export function rgba(hex: string, opacity: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

/**
 * The label's shadow at rest or pressed, on a screen of `scale`: her
 * colour, opacity and drop, and her blur's sigma as React Native's radius.
 * On iOS and the web the radius is twice the sigma, as her CSS and React
 * Native values are. Android blurs a radius r by a sigma of 0.57735 r + 0.5
 * device px, so its radius is worked back from the sigma in device px.
 */
