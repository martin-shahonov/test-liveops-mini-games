import type { BoardBox } from '../../../shared/ported/runtime';

/**
 * The card lit at the landing: a rounded rect the plate's shape in the
 * art's highlight, blurred, drawn behind the card so the light halos its
 * frame. `grow` is how far the rect reaches past the plate, `blur` the
 * blur's sigma, both in board points, `alpha` the light at the plate's
 * edge, and `inMs` how long it takes to come in with the landing; it goes
 * out with the dim.
 */
export const CARD_GLOW = {
  color: '#F6D9C8',
  grow: 6,
  blur: 22,
  alpha: 0.9,
  inMs: 450,
} as const;

/** How far a Gaussian blur of `sigma` reaches before it is gone, as Skia draws it. */
const BLUR_REACH = 3;

/** The glow's canvas: the plate grown by the rect's reach and the blur's, so nothing is clipped. */
export function cardGlowCanvas(plate: BoardBox): BoardBox {
  const reach = CARD_GLOW.grow + BLUR_REACH * CARD_GLOW.blur;
  return {
    centre: plate.centre,
    size: [plate.size[0] + 2 * reach, plate.size[1] + 2 * reach],
  };
}

/** The lit rect inside its canvas, in the canvas's own board points. */
export function cardGlowRect(plate: BoardBox): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const canvas = cardGlowCanvas(plate);
  const width = plate.size[0] + 2 * CARD_GLOW.grow;
  const height = plate.size[1] + 2 * CARD_GLOW.grow;
  return {
    left: (canvas.size[0] - width) / 2,
    top: (canvas.size[1] - height) / 2,
    width,
    height,
  };
}
