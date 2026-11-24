import { backdropBox, croppedBackdropBox } from '../../../../shared/ported/runtime/layout/fit';
import type { PlacedBox } from '../../../../shared/ported/runtime/layout/fit';
import { pickBackdropCrop } from '../../../../shared/ported/runtime/layout/videoSource';
import type { BackdropVideo } from '../../../../shared/ported/runtime/layout/videoSource';

/**
 * How far in from each of its edges the square melts into its sides, as a
 * share of its height: the designer's Duo notes fade the video's left and
 * right 40 pt on the 669-pt screen of an iPhone Duo on its side.
 */
export const SIDE_FADE = 40 / 669;

/** The black over each side at the frame's edge, none at the square: the Duo notes' 30%. */
export const SIDE_SHADE = 0.3;

/** Where a frame wider than the backdrop's square draws its sides. */
export type SidesPlacement = {
  /** The whole composition, square, as the board places the rows of it it plays. */
  square: PlacedBox;
  /** The frame's width: where the right side ends. */
  width: number;
  /** How far in from each of the square's edges it melts into its side. */
  fade: number;
};

/**
 * Where a frame draws its sides: on a frame wider than tall the board fits
 * the backdrop's composition to the height (see `croppedBackdropBox`), and
 * what it leaves either side of it is the sides'. None where the
 * composition covers the frame, or where the backdrop is not a cut
 * composition, as a video that covers the frame itself is not.
 */
export function placeBackdropSides(
  video: BackdropVideo | undefined,
  frameWidth: number,
  frameHeight: number,
): SidesPlacement | undefined {
  const frame = backdropBox(frameWidth, frameHeight);
  const crop = pickBackdropCrop(video, frameWidth, frameHeight);
  if (!frame || !crop) return undefined;
  const square = croppedBackdropBox(frame, crop.frame, 0, crop.frame[1]);
  if (square.left <= 0) return undefined;
  return { square, width: frameWidth, fade: square.height * SIDE_FADE };
}
