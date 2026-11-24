import { BOX_DONE_SHARE, CELL_REVEALED_SHARE } from '../rules/reveal';

/**
 * The cells under a tray's coating, and the card's rules for when a cell
 * and a box count as revealed, spelled out as worklets the UI thread can
 * run: how much of each cell and each reading zone is scratched is the
 * mask's to count (see `mask.ts`). Nothing here touches Skia or the
 * gesture, so it all runs under node as it does on the UI thread.
 */

/** A cell's box in the tray's points, from its top-left corner. */
export type CellBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * A reading zone: its box, in the tray's points from its top-left corner,
 * and where its ink lies on the tray's mask, `texels`, as runs [row, first,
 * last, ...] of whole texels from the tray's corner, row by row. A zone
 * with texels is read by them, one without by its box. See `cardZones`.
 */
export type ReadingZone = CellBox & { texels?: readonly number[] };

/**
 * Where a cell is read: its symbol's zone, its ink box where the symbol is
 * placed, and in YOUR SYMBOLS a zone for each character its value prints,
 * the coin left out, each read by the texels its own ink covers where the
 * skin has its ink. A skin that says nothing of its ink is read by the box
 * every symbol's ink fits in and its value line's widest ink. See
 * `readingZones` and `cardZones`.
 */
export type CellZones = {
  symbol: ReadingZone;
  value?: readonly ReadingZone[];
};

// The card's rules are no worklets, so they are spelled out here for the
// UI thread; `coverage.test.ts` holds the two to each other. The finger's
// take their thresholds as arguments, the tray handing them its plan's
// rule, the rules' `WINNING_REVEAL` or `YOURS_REVEAL` as the card opened.

/** Whether a cell whose symbol zone is at `share` is read: the rules' `cellRead` at `readShare`. */
export function cellReadAt(share: number, readShare: number): boolean {
  'worklet';
  return share >= readShare;
}

/**
 * Whether a box's zones at `zoneShares` and its cells at `cellShares` meet
 * the shares given: every symbol's zone at `symbolShare`, every other zone,
 * a character's, at `glyphShare`, and the cells' mean at `areaShare`, a
 * box with no cells waiting on none; or the cells' mean past `areaCap`,
 * whatever the zones say, which a box with no cells never passes.
 * `symbolZone` is each cell's symbol zone, in the ascending order the mask
 * lays them. A cell `waived` names, by its index, has its characters taken
 * as read whatever their shares: the box no longer waits on its value (the
 * rules' `valueWaived`). The rules' `boxRead`, `idleClean` and `dwellRead`
 * at a rule's shares, a waived cell's characters left out of theirs.
 */
export function boxReadAt(
  zoneShares: readonly number[],
  symbolZone: readonly number[],
  cellShares: readonly number[],
  symbolShare: number,
  glyphShare: number,
  areaShare: number,
  areaCap: number,
  waived?: readonly boolean[],
): boolean {
  'worklet';
  let mean = NaN;
  if (cellShares.length > 0) {
    let sum = 0;
    for (let c = 0; c < cellShares.length; c++) sum += cellShares[c]!;
    mean = sum / cellShares.length;
  }
  if (mean > areaCap) return true;
  let next = 0;
  for (let z = 0; z < zoneShares.length; z++) {
    while (next < symbolZone.length && symbolZone[next]! < z) next++;
    const symbol = next < symbolZone.length && symbolZone[next] === z;
    // A character is its cell's, the last whose symbol zone comes before it.
    if (!symbol && waived !== undefined && waived[next - 1] === true) continue;
    if (!(zoneShares[z]! >= (symbol ? symbolShare : glyphShare))) return false;
  }
  return cellShares.length === 0 || mean >= areaShare;
}

/** Whether Quick Scratch's path has revealed a cell at `share`: the rules' `cellRevealed`. */
export function revealedAt(share: number): boolean {
  'worklet';
  return share >= CELL_REVEALED_SHARE;
}

/** Whether Quick Scratch's path has done a box at `shares`: the rules' `boxDone`. */
export function boxDoneAt(shares: readonly number[]): boolean {
  'worklet';
  let sum = 0;
  let every = true;
  for (let c = 0; c < shares.length; c++) {
    const share = shares[c]!;
    sum += share;
    if (!revealedAt(share)) every = false;
  }
  return every || sum / shares.length >= BOX_DONE_SHARE;
}

/** The cells the path has revealed at `shares`, in grid order: the rules' `revealedCells`. */
export function revealedCellsAt(shares: readonly number[]): number[] {
  'worklet';
  const revealed: number[] = [];
  for (let c = 0; c < shares.length; c++) {
    if (revealedAt(shares[c]!)) revealed.push(c);
  }
  return revealed;
}
