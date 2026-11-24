import { FRAME_BAND } from '../tokens';

/**
 * A loop of light made to run round a pill: a sheet whose frames are
 * `canvas` px, in which its bright line is a stadium `line` px across and
 * down about the canvas's centre, as the motion designer's SPIN loop is.
 */
export type GlowRingArt = {
  canvas: { width: number; height: number };
  line: { width: number; height: number };
};

/** A laid-out pill: its middle in its parent's points, and its size. */
export type GlowRingPill = {
  centre: { x: number; y: number };
  width: number;
  height: number;
};

/** Where a ring is drawn round a pill, as `SpriteSequence` takes it. */
export type GlowRingPlace = {
  /** The canvas, in the pill's parent's points, centred on the pill. */
  box: { left: number; top: number; width: number; height: number };
  /** Where the sheet's whole canvas lands in the box, before the stretch. */
  tile: { x: number; y: number; width: number; height: number };
  /** How far the drawing is stretched across, about the box's middle. */
  stretchX: number;
};

/**
 * Where a ring of `art` is drawn round `pill`: its bright line laid along
 * the middle of the pill's gold band all the way round, the canvas scaled
 * by the band's height and stretched across to the band's width, about the
 * pill's middle. The size is the pill's as laid out, unpressed: the press
 * moves the ring with the pill, as the pill's own transform on the ring's
 * view (`glowLoopLook`), which a box centred on the pill takes about the
 * same middle. The box is `span` wide, the button's own width, so a new
 * word only stretches the drawing and never resizes the canvas; a pill
 * wider than that widens it.
 */
export function glowRing(
  pill: GlowRingPill,
  art: GlowRingArt,
  span: number,
): GlowRingPlace {
  const band = FRAME_BAND * pill.height;
  const scale = (pill.height - 2 * band) / art.line.height;
  const tileWidth = art.canvas.width * scale;
  const tileHeight = art.canvas.height * scale;
  const stretchX = (pill.width - 2 * band) / (art.line.width * scale);
  const width = Math.max(span, tileWidth * Math.max(1, stretchX));
  return {
    box: {
      left: pill.centre.x - width / 2,
      top: pill.centre.y - tileHeight / 2,
      width,
      height: tileHeight,
    },
    tile: {
      x: (width - tileWidth) / 2,
      y: 0,
      width: tileWidth,
      height: tileHeight,
    },
    stretchX,
  };
}
