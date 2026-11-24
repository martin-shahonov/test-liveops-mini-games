import type {
  BoardFit,
  PlacedBox,
  UiButtonSizeClass,
} from '../../../shared/ported/runtime';

/**
 * QUICK SCRATCH's and COLLECT's size class, the designer's `scratcher` in
 * her `button-tokens.json` of 5 Nov: a pill 253 px tall, its word 79 px,
 * 112 px either side of the word and 675 px wide at least, at her @3x
 * reference. The universal button takes it as `size`, as it takes the
 * kit's own classes.
 */
export const CARD_BUTTON_SIZE: UiButtonSizeClass = {
  H: 253,
  font: 79,
  pad: 112,
  minW: 675,
};

/**
 * The designer's rule for the button, in board points: the pill's centre
 * halfway between the ticket's foot and `bottomMargin` screen points above
 * the board's foot, the bottom safe zone she keeps on every screen she drew.
 * `plateCentre` is her plate's centre on her reference board.
 */
export type ButtonPlace = {
  /** The ticket's foot, board points. */
  ticketFoot: number;
  /** Kept clear under the button's band, screen points, on every frame. */
  bottomMargin: number;
  /** Her plate's centre on her reference board, board points. */
  plateCentre: number;
};

/**
 * Where the pill's centre lands, in board points, on a board drawn `k`
 * screen points a board point, whose foot is `boardFoot` board points down.
 * A fixed margin in screen points is more of the board on a smaller one, so
 * the button rises as the board shrinks. A board not yet measured keeps the
 * boxes' own place.
 */
export function buttonPlateCentre(
  k: number,
  place: ButtonPlace,
  boardFoot: number,
): number {
  if (!(k > 0)) return place.plateCentre;
  return (place.ticketFoot + boardFoot - place.bottomMargin / k) / 2;
}

/**
 * How far down a box drawn about her plate moves on `fit`, in screen
 * points: as far as the rule moves the pill from her plate's place, so
 * something drawn about her plate keeps to the pill. Up when negative. `boardFoot` is
 * the board's height, the skin's `board[1]`: the rule measures from the
 * board's foot, which is the frame's on every frame the board is fitted to
 * by its height.
 */
export function buttonShift(
  fit: Pick<BoardFit, 'k'>,
  place: ButtonPlace,
  boardFoot: number,
): number {
  if (!(fit.k > 0)) return 0;
  return (
    (buttonPlateCentre(fit.k, place, boardFoot) - place.plateCentre) * fit.k
  );
}

/** `box` moved `shift` screen points down, as `buttonShift` moves a box. */
export function shiftedBox(box: PlacedBox, shift: number): PlacedBox {
  return shift === 0 ? box : { ...box, top: box.top + shift };
}
