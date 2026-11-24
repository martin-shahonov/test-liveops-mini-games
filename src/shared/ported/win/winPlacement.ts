import type { BoardFit, PlacedBox as VfxBox } from '../runtime/layout/fit';

/**
 * Board points per world unit for the win's particles.
 *
 * The effect carries no scale of its own. At 17 points a unit their spray
 * reaches about 466 points tip to tip; "The particles" in `docs/art/ruby.md`
 * has what that is fitted to.
 */
export const WIN_PARTICLES_POINTS_PER_UNIT = 17;

/**
 * How many times their authored size the win's particles are drawn. At 17
 * points a unit the export's dots are 3 points across on average and 7 at
 * most, specks on a phone; drawn 2.5 times larger they are about 7 and 17.
 */
export const WIN_PARTICLES_SIZE_SCALE = 2.5;

/**
 * Where the win's particles play: over the whole frame, sprayed from
 * `centre`, the tier's particles point, in board points.
 */
export function winParticlesPlacement(
  fit: Pick<
    BoardFit,
    'frameWidth' | 'frameHeight' | 'k' | 'offsetX' | 'offsetY'
  >,
  centre: readonly [number, number],
): { box: VfxBox; origin: { x: number; y: number }; pointsPerUnit: number } {
  return {
    box: { left: 0, top: 0, width: fit.frameWidth, height: fit.frameHeight },
    origin: {
      x: fit.offsetX + centre[0] * fit.k,
      y: fit.offsetY + centre[1] * fit.k,
    },
    pointsPerUnit: WIN_PARTICLES_POINTS_PER_UNIT * fit.k,
  };
}

/**
 * Board points per world unit for the sparks thrown at the landing.
 *
 * The export carries no scale of its own, so they are drawn at the size the
 * animator rendered them: laid at the export sheet's scale-down, as the win
 * glow they play with on the wheel is, that sequence's sparks reach as far
 * from where they are thrown as the export's do at 17 points a unit, over
 * the same time. The whole effect is drawn at that one scale, where they fly
 * and how big they are; "The sparks" in `docs/art/ruby.md` has the
 * measurements.
 */
export const WIN_SPARKS_POINTS_PER_UNIT = 17;

/**
 * Where the sparks play: over the whole frame, thrown from `origin`, in
 * board points: the wheel's centre, or whatever a game lights at the landing.
 */
export function winSparksPlacement(
  fit: Pick<
    BoardFit,
    'frameWidth' | 'frameHeight' | 'k' | 'offsetX' | 'offsetY'
  >,
  origin: readonly [number, number],
): { box: VfxBox; origin: { x: number; y: number }; pointsPerUnit: number } {
  return {
    box: { left: 0, top: 0, width: fit.frameWidth, height: fit.frameHeight },
    origin: {
      x: fit.offsetX + origin[0] * fit.k,
      y: fit.offsetY + origin[1] * fit.k,
    },
    pointsPerUnit: WIN_SPARKS_POINTS_PER_UNIT * fit.k,
  };
}
