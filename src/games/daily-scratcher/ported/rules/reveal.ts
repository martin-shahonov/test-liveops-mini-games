import type { ScratcherSymbol } from './types';

/**
 * When a finger has revealed a cell and a box. A cell is read from its
 * reading zones, never from its whole area: the symbol's zone, and in YOUR
 * SYMBOLS one zone for each character its value prints, the coin left out.
 * A zone's share is the part of it the brush has been over. In WINNING a
 * zone is its symbol's ink box; in YOUR SYMBOLS each symbol and each
 * character is read by its own ink, the part of the tray its ink covers,
 * never the box round it (the game lays them).
 *
 * Nothing under a finger clears itself as it is read: the player scratches
 * every symbol and value into view, and once every one of them can be read
 * the coating left between them clears, so the card looks clean and no one
 * chases the last slivers of a box they have already read.
 *
 * Each tray is read by a rule of its own (`WINNING_REVEAL`, `YOURS_REVEAL`).
 * WINNING waits for every symbol plainly seen and for more than half its
 * row scratched, so one stroke through its three symbols never clears it
 * and a second does. As the last box left to scratch it waits on its
 * symbols alone, under a finger as left alone: the outcome waits on it,
 * and with its symbols read all that is left there is blank coating. YOUR
 * SYMBOLS clears the moment every symbol shows 55 percent of its ink and
 * every character 65 percent of its own: as soon as everything printed in
 * it can be read. It waits on no area. A character the finger left between
 * 62 and 65 percent, read but short of that, holds it a second at most:
 * the box clears a second later, the finger on it or not, so no one
 * scratches on for a digit they have already read.
 *
 * YOUR SYMBOLS waits only on the values that can still be won. Once all
 * three winning symbols are read, a cell whose symbol is read and is none
 * of them has no prize to give, and the player can see it has none, so
 * the box no longer waits on its value (`valueWaived`): played, a card
 * whose every symbol and every winning value could be read still waited
 * on the coating over one value that could not be won (owner, 13 Nov
 * 2026). It is decided on what the player can see, as `matchCalled` is,
 * never on the card's data alone, so a box clearing tells nothing early:
 * with any winning symbol still under its foil every value counts, and a
 * cell whose own symbol is unread keeps its value. The shares stay as they
 * are; only what the box waits on changes.
 *
 * A box scratched past its rule's `areaCap` on average clears whatever its
 * zones say. Both rules put it at 1, which no share passes, so it changes
 * nothing until a rule lowers it.
 */

/**
 * The share of a WINNING symbol's zone, its ink box, scratched away at
 * which it counts as read under a finger: plainly seen, a symbol known by
 * its gem without a second look.
 */
export const READ_SHARE = 0.7;

/**
 * The share a WINNING symbol's zone needs for its box to clear once it is
 * left alone a while: a little under `READ_SHARE`, for a player who stopped
 * with the edge of a gem still under the coating.
 */
export const IDLE_READ_SHARE = 0.65;

/**
 * YOUR SYMBOLS: the share of a symbol's ink scratched clear at which it is
 * read, its cell told, and, with every other symbol and character read,
 * the box cleared: the half of its ink at which her gem is known by its
 * colour and cut, and a margin over it.
 */
export const YOURS_SYMBOL_INK_SHARE = 0.55;

/**
 * YOUR SYMBOLS: the share of a printed character's ink scratched clear at
 * which it is read, a digit, the dot, a K or an M: the 60 percent a
 * character is read at, and a margin over it for the coarser count a thin
 * 1 or the dot gets from whole texels.
 */
export const YOURS_GLYPH_INK_SHARE = 0.65;

/**
 * YOUR SYMBOLS: the share of each printed character's ink scratched clear
 * at which, every symbol at `YOURS_SYMBOL_INK_SHARE`, the box clears a
 * second later, the finger still on it or not, or a second after it was
 * left alone: past the 60 percent a character is read at, so the one
 * character a finger left read but short of `YOURS_GLYPH_INK_SHARE`, a
 * thin 1 or a K whose last texels it keeps missing, holds the box a second
 * at most.
 */
export const YOURS_DWELL_GLYPH_INK_SHARE = 0.62;

/**
 * WINNING under a finger: its cells' mean share scratched, besides every
 * symbol read, until YOUR SYMBOLS is done (see `boxRead`). One stroke
 * through its symbols scratches about a third of the row and a second
 * about three fifths, so one pass never clears it and the second does.
 */
export const WINNING_AREA_SHARE = 0.55;

/**
 * WINNING left alone: half its row scratched, besides every symbol at
 * `IDLE_READ_SHARE`, until YOUR SYMBOLS is done (see `idleClean`).
 */
export const WINNING_IDLE_AREA_SHARE = 0.5;

/**
 * Both trays: the cells' mean share scratched past which a box clears
 * whatever its zones say, read or not, under a finger, left alone and for
 * the dwell. At 1 it clears none, no share passing 1, so each tray reads
 * its box by its zones and its area alone. Lowered, it can clear a box
 * before everything in it is read: a player scratching YOUR SYMBOLS row by
 * row uncovers its last values at about 95 percent.
 */
export const REVEAL_AREA_CAP = 1;

/**
 * How a tray's box is read: plain numbers, which the UI thread takes from
 * the tray's plan as they are. A symbol is a cell's symbol zone, a
 * character every other zone, and an area the mean share of the box's
 * cells scratched, 0 for none to wait on.
 */
export type RevealRule = {
  /** Under a finger: a cell is read, and told, once its symbol's zone is at this share; the box clears once every one is. */
  readonly symbol: number;
  /** Under a finger: every character's zone, for the box to clear. */
  readonly glyph: number;
  /** Under a finger, and for the dwell: the cells' mean, for the box to clear. */
  readonly area: number;
  /** Left alone a while: every symbol's zone, every character's and the cells' mean. */
  readonly idleSymbol: number;
  readonly idleGlyph: number;
  readonly idleArea: number;
  /**
   * The dwell: every symbol's zone at `dwellSymbol`, every character's at
   * `dwellGlyph` and the cells' mean at `area`, and the box clears a beat
   * later, the finger on it or not.
   */
  readonly dwellSymbol: number;
  readonly dwellGlyph: number;
  /**
   * Under a finger, left alone and for the dwell: the cells' mean past
   * which the box clears whatever its zones say, read or not; 1 for none.
   */
  readonly areaCap: number;
};

/**
 * WINNING: every symbol read and more than half the row scratched, or left
 * alone every symbol at `IDLE_READ_SHARE` and half the row; as the last
 * box, its symbols alone. Its dwell is its finger's rule, so it never
 * comes first. A plain object: a value set on it from outside, as the
 * studio sets it, plays from the next card (see the tray's plan).
 */
export const WINNING_REVEAL: RevealRule = {
  symbol: READ_SHARE,
  glyph: READ_SHARE,
  area: WINNING_AREA_SHARE,
  idleSymbol: IDLE_READ_SHARE,
  idleGlyph: IDLE_READ_SHARE,
  idleArea: WINNING_IDLE_AREA_SHARE,
  dwellSymbol: READ_SHARE,
  dwellGlyph: READ_SHARE,
  areaCap: REVEAL_AREA_CAP,
};

/**
 * YOUR SYMBOLS, read by its ink: every symbol at `YOURS_SYMBOL_INK_SHARE`
 * and every character at `YOURS_GLYPH_INK_SHARE` under a finger; left
 * alone and for the dwell, the same symbols and every character at
 * `YOURS_DWELL_GLYPH_INK_SHARE`, so a box whose last character is read but
 * short of the finger's share clears a second later. Nothing waits on its
 * area. A plain object, as `WINNING_REVEAL` is.
 */
export const YOURS_REVEAL: RevealRule = {
  symbol: YOURS_SYMBOL_INK_SHARE,
  glyph: YOURS_GLYPH_INK_SHARE,
  area: 0,
  idleSymbol: YOURS_SYMBOL_INK_SHARE,
  idleGlyph: YOURS_DWELL_GLYPH_INK_SHARE,
  idleArea: 0,
  dwellSymbol: YOURS_SYMBOL_INK_SHARE,
  dwellGlyph: YOURS_DWELL_GLYPH_INK_SHARE,
  areaCap: REVEAL_AREA_CAP,
};

/** Whether a cell is read under a finger: its symbol's zone at `rule.symbol`. */
export const cellRead = (symbolShare: number, rule: RevealRule): boolean =>
  symbolShare >= rule.symbol;

/**
 * Whether every symbol's zone is at `symbol`, every character's at `glyph`
 * and the cells at `area` on average, or the cells past `cap` on average
 * whatever the zones say. A share that is not a number holds what it is
 * part of, a zone's the zones' rule and a cell's the cap as well, and a box
 * with no cells has no area to wait on and no cap to pass.
 */
function sharesMet(
  symbolShares: readonly number[],
  glyphShares: readonly number[],
  cellShares: readonly number[],
  symbol: number,
  glyph: number,
  area: number,
  cap: number,
): boolean {
  const mean =
    cellShares.length === 0
      ? NaN
      : cellShares.reduce((sum, share) => sum + share, 0) / cellShares.length;
  if (mean > cap) return true;
  if (!symbolShares.every((share) => share >= symbol)) return false;
  if (!glyphShares.every((share) => share >= glyph)) return false;
  if (cellShares.length === 0) return true;
  return mean >= area;
}

/**
 * Whether a box is read under a finger, every symbol and character in it
 * and its area, or its area past the cap, by `rule`: it clears the rest of
 * its coating there and then. The `last` box left to scratch waits on its
 * zones alone, its area lifted, as `idleClean` has it. A box with no zones
 * and no cells has nothing left to read. The characters of a value the box
 * no longer waits on (`valueWaived`) are not among `glyphShares`.
 */
export function boxRead(
  symbolShares: readonly number[],
  glyphShares: readonly number[],
  cellShares: readonly number[],
  rule: RevealRule,
  last = false,
): boolean {
  return sharesMet(
    symbolShares,
    glyphShares,
    cellShares,
    rule.symbol,
    rule.glyph,
    last ? 0 : rule.area,
    rule.areaCap,
  );
}

/**
 * Whether a box left alone a while clears the rest of its coating, by
 * `rule`'s idle shares, or its area past the cap. The `last` box left to
 * scratch waits on its zones alone, its area lifted: the outcome waits on
 * it, and with its symbols and values read all that is left there is blank
 * coating between them.
 */
export function idleClean(
  symbolShares: readonly number[],
  glyphShares: readonly number[],
  cellShares: readonly number[],
  rule: RevealRule,
  last: boolean,
): boolean {
  return sharesMet(
    symbolShares,
    glyphShares,
    cellShares,
    rule.idleSymbol,
    rule.idleGlyph,
    last ? 0 : rule.idleArea,
    rule.areaCap,
  );
}

/**
 * Whether a box is read well enough to clear a beat later, the finger on
 * it or not, by `rule`'s dwell shares and its area, or its area past the
 * cap.
 */
export function dwellRead(
  symbolShares: readonly number[],
  glyphShares: readonly number[],
  cellShares: readonly number[],
  rule: RevealRule,
): boolean {
  return sharesMet(
    symbolShares,
    glyphShares,
    cellShares,
    rule.dwellSymbol,
    rule.dwellGlyph,
    rule.area,
    rule.areaCap,
  );
}

/**
 * Quick Scratch's path: the share of a cell's whole area its brush has
 * scratched away at which the cell counts as revealed and clears the rest
 * of its coating as the path goes on. The path is the designer's, drawn
 * for the player, so it reveals cell by cell as she timed it.
 */
export const CELL_REVEALED_SHARE = 0.6;

/**
 * Quick Scratch's path: the share of a box's whole area, on average, at
 * which the box counts as done before the path's strokes end.
 */
export const BOX_DONE_SHARE = 0.85;

/** Whether the path has revealed a cell at `share` of its area: see `CELL_REVEALED_SHARE`. */
export const cellRevealed = (share: number): boolean =>
  share >= CELL_REVEALED_SHARE;

/** Indices of the cells the path has revealed, in grid order. */
export const revealedCells = (shares: readonly number[]): number[] =>
  shares.flatMap((share, index) => (cellRevealed(share) ? [index] : []));

/**
 * Whether the path has done a box: every cell revealed, or the box
 * scratched to `BOX_DONE_SHARE` over all its cells. A box with no cells has
 * nothing left to reveal.
 */
export function boxDone(shares: readonly number[]): boolean {
  if (shares.every((share) => cellRevealed(share))) return true;
  const mean = shares.reduce((sum, share) => sum + share, 0) / shares.length;
  return mean >= BOX_DONE_SHARE;
}

/**
 * Whether a cell's match may be called: the cell is revealed, and so is a
 * winning cell showing its symbol. A match is called on what the player can
 * see, never on the card's data, so a winning symbol still under its foil
 * lights nothing.
 */
export function matchCalled(
  winningRevealed: readonly boolean[],
  revealed: boolean,
  symbol: ScratcherSymbol,
  winning: readonly ScratcherSymbol[],
): boolean {
  if (!revealed) return false;
  return winning.some(
    (candidate, index) =>
      candidate === symbol && winningRevealed[index] === true,
  );
}

/**
 * Whether YOUR SYMBOLS no longer waits on a cell's value: the cell is
 * revealed, every winning cell is revealed, and none of them shows the
 * cell's symbol. Its prize cannot be won, and the player can see that it
 * cannot, so the box clears without it: its characters count as read
 * under a finger, left alone and for the dwell. Decided on what the player
 * can see, as `matchCalled` is, never on the card's data alone: with a
 * winning symbol still under its foil, or the cell's own, its value
 * counts.
 */
export function valueWaived(
  winningRevealed: readonly boolean[],
  revealed: boolean,
  symbol: ScratcherSymbol,
  winning: readonly ScratcherSymbol[],
): boolean {
  if (!revealed) return false;
  if (!winning.every((_, index) => winningRevealed[index] === true)) {
    return false;
  }
  return !winning.includes(symbol);
}
