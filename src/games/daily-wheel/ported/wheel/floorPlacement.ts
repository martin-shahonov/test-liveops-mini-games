import { croppedBackdropBox } from '../../../../shared/ported/runtime/layout/fit';
import type { PlacedBox } from '../../../../shared/ported/runtime/layout/fit';
import type { VideoRect } from '../../skin/types';

/**
 * Where a rect of a backdrop cut's composition lands on the screen: the
 * composition, `frame` pixels, covers `box` about its centre as the board
 * covers it with the cut's video, by the board's own maths, so whatever is
 * placed through this stays registered with the video on every frame size.
 */
export function placeInComposition(
  box: PlacedBox,
  frame: readonly [number, number],
): (rect: VideoRect) => PlacedBox {
  const whole = croppedBackdropBox(box, frame, 0, frame[1]);
  const scale = whole.width / frame[0];
  return (rect) => ({
    left: whole.left + rect.x * scale,
    top: whole.top + rect.y * scale,
    width: rect.w * scale,
    height: rect.h * scale,
  });
}
