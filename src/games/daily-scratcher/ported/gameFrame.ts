import {
  gameFrame as frameOf,
  gameSheetPresentation as presentationOf,
} from '../../../shared/ported/runtime';
import type {
  GameFrameInput,
  GameSheetPresentation,
} from '../../../shared/ported/runtime';

/**
 * The scratcher's frame and sheet: the runtime's, so on a desktop the
 * square every game opens in, every game's popup being the same size. The
 * card is laid out in it as on the designer's Square screen; the 760 x 620
 * desktop window she draws, with a background of its own, is the product
 * owner's call and not built. A phone, or a window narrower than desktop,
 * takes the whole screen as every game does.
 */
export function gameFrame(input: GameFrameInput): {
  width: number | '100%';
  height: number;
} {
  return frameOf(input);
}

/** The sheet geometry the host should open the scratcher with. */
export function gameSheetPresentation(
  input: GameFrameInput,
): GameSheetPresentation {
  return presentationOf(input);
}
