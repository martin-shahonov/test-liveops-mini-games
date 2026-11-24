import type { BoardFit, BoardSpec, PlacedBox as VfxBox } from '../runtime/layout/fit';

/**
 * Board points per world unit for the coin shower.
 *
 * The export carries no scale of its own, so the board sets one, for the
 * whole effect at once: where the spouts are, how far the coins fly and how
 * big they are. At 32.5 points a unit a coin's cell, 1.96 units, is 64
 * points, 192 px of the 3x artboard, about the 200 px of the export's
 * cells, and the spouts, 22.8 units apart, sit 371 points either side of
 * the centre: most of the way out to the corners of the desktop view, 932
 * points wide, and 156 points beyond each side of a phone's 430.
 */
export const COIN_SHOWER_POINTS_PER_UNIT = 32.5;

/**
 * How tall the coins' throws are drawn against how wide. At the scale above
 * the export's highest throws rise 38.6 units, 1,255 points: past the top of
 * the frame, where they turn and slow down out of sight, so only the fast
 * part of each throw is seen. At 0.65 the highest one peaks at 816 points,
 * 88% of the frame's height, and the whole throw shows, rising and falling at
 * 0.65 of the speed in the same time. The coins keep their size and their
 * spouts, and still cross.
 */
export const COIN_SHOWER_HEIGHT_SCALE = 0.65;

/**
 * How many times the size COIN_SHOWER_POINTS_PER_UNIT gives it each coin
 * is drawn at, its size alone: the spouts, the throws and their timing stay
 * as authored.
 * At 1.2 a coin is 76 points, 115 px on the particles' canvas, so the
 * sheet's 100 px cells are drawn slightly enlarged.
 */
export const COIN_SHOWER_SIZE_SCALE = 1.2;

/**
 * Where between its two spouts the shower is centred, in world units: the
 * export has them at x -6.142 and -28.953, not about its origin.
 */
export const COIN_SHOWER_CENTRE_UNITS = -17.5477;

export type CoinShowerPlacement = {
  /** The whole frame: coins that leave the board are clipped by it. */
  box: VfxBox;
  /** The effect's origin, in screen points: its spouts centred on the board's bottom edge. */
  origin: { x: number; y: number };
  pointsPerUnit: number;
  heightScale: number;
};

/** Where the coin shower sits for one fit of the board. */
export function coinShowerPlacement(
  fit: BoardFit,
  spec: BoardSpec,
): CoinShowerPlacement {
  const [width, height] = spec.board;
  return {
    box: { left: 0, top: 0, width: fit.frameWidth, height: fit.frameHeight },
    origin: {
      x:
        fit.offsetX +
        (width / 2 - COIN_SHOWER_CENTRE_UNITS * COIN_SHOWER_POINTS_PER_UNIT) *
          fit.k,
      y: fit.offsetY + height * fit.k,
    },
    pointsPerUnit: COIN_SHOWER_POINTS_PER_UNIT * fit.k,
    heightScale: COIN_SHOWER_HEIGHT_SCALE,
  };
}
