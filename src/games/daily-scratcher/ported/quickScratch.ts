// The sweep's numbers by their own modules rather than the tray's entry
// point, which mounts the canvas: nothing here draws, and the play's tests
// run where React Native does not load.
import { BRUSH_RADIUS } from './tray/brush';
import { COIN_MOTION, coinAwayMs } from './tray/coinMotion';
import { boxDoneAt, revealedAt } from './tray/coverage';
import type { CellBox } from './tray/coverage';
import { alongDiagonal } from './tray/diagonal';
import type { Diagonal } from './tray/diagonal';
import type { RoundedBox } from './tray/field';
import { makeCoverage, maskShares, stampCoverage } from './tray/mask';
import {
  QUICK_PATH,
  pathBows,
  pathPoint,
  pathSteps,
  pathStrokeMs,
} from './tray/quickPath';
import {
  QUICK_SWEEP,
  bandCoinLiftMs,
  sweepEaseInverse,
  sweepOrder,
  thinTicks,
} from './tray/quickSweep';

/**
 * Quick Scratch over both trays, as one pass: the winning tray's band
 * starts at the press, and the yours tray's band as the first leaves the
 * winning tray's last cell, so the coin reads as one top to bottom and the
 * yours tray clears as fast as the winning one. Each tray sweeps on its own
 * token and rides its own coin: the winning tray's lifts at the far corner
 * of its band, and the yours tray's presses in once it has gone.
 */

/** How far along `d` the far corner of the cell the band passes last projects. */
function lastCellFar(cells: readonly CellBox[], d: Diagonal): number {
  let far = 0;
  for (const cell of cells) {
    far = Math.max(
      far,
      alongDiagonal(d, cell.left + cell.width, cell.top + cell.height),
    );
  }
  return far;
}

/**
 * Milliseconds after the winning tray's sweep begins that the yours tray's
 * does: when the band's trailing edge clears the winning tray's last cell,
 * and, with a `coin` riding the band, not before it has lifted away from the
 * far corner, so two coins never show at once. The whole sweep for a tray
 * with no cells. The coin's release is read as the hand-over is worked out,
 * so it follows `COIN_MOTION` as it stands.
 */
export function sweepHandOverMs(
  winningCells: readonly CellBox[],
  winning: Diagonal,
  coin = false,
): number {
  if (winningCells.length === 0) return QUICK_SWEEP.ms;
  const reach = winning.length + QUICK_SWEEP.soft;
  const progress = Math.min(
    1,
    (lastCellFar(winningCells, winning) + QUICK_SWEEP.soft) / reach,
  );
  const cleared = QUICK_SWEEP.ms * sweepEaseInverse(progress);
  return coin
    ? Math.max(cleared, bandCoinLiftMs(winning) + coinAwayMs(COIN_MOTION))
    : cleared;
}

/**
 * When Quick Scratch's reveal ticks sound under the band on both trays, in
 * milliseconds from the press: each tray's cells as its band reaches them,
 * the yours tray's from its hand-over, thinned to one per
 * `QUICK_SWEEP.tickGapMs`, so cells the band passes together sound as one
 * tick.
 */
export function sweepTickTimes(
  winningCells: readonly CellBox[],
  winning: Diagonal,
  yoursCells: readonly CellBox[],
  yours: Diagonal,
  handOverMs: number,
): number[] {
  const times = [
    ...sweepOrder(winningCells, winning).map((step) => step.atMs),
    ...sweepOrder(yoursCells, yours).map((step) => step.atMs + handOverMs),
  ].sort((a, b) => a - b);
  return thinTicks(times, QUICK_SWEEP.tickGapMs);
}

/**
 * A tray the designer's path is drawn over: its cells, its size and its
 * field, board points. Quick Scratch clears YOUR SYMBOLS with the band since
 * the owner's call of 13 Nov 2026, so nothing on the card asks for the path
 * now; the tray keeps it (its `quickPath`), and its tests time it by
 * `pathRevealTimes`.
 */
export type PathTray = {
  cells: readonly CellBox[];
  width: number;
  height: number;
  field: RoundedBox;
};

/** When the path reveals each cell, and the box: see `pathRevealTimes`. */
export type PathReveals = { cellsMs: readonly number[]; boxMs: number };

/** The last few trays' reveals by their geometry: every card of a layout has the same. */
const revealsByTray = new Map<string, PathReveals>();
const REVEALS_KEPT = 4;

/**
 * When each cell of `tray` is revealed as the designer's path is drawn over
 * it, milliseconds from the path's start, in grid order: run through the
 * same coverage, the same steps and the same thresholds as the UI thread, a
 * 60 Hz frame at a time, so a cell is told on the frame its share first
 * passes the threshold; the cells the path leaves short, as its strokes end
 * and the rest of the box fades. Also when the box is done. Worked out once
 * for a tray's geometry.
 */
export function pathRevealTimes(tray: PathTray): PathReveals {
  const key = JSON.stringify([tray.cells, tray.width, tray.height, tray.field]);
  const kept = revealsByTray.get(key);
  if (kept) return kept;
  const reveals = revealsOf(tray);
  if (revealsByTray.size >= REVEALS_KEPT) {
    const oldest = revealsByTray.keys().next().value;
    if (oldest !== undefined) revealsByTray.delete(oldest);
  }
  revealsByTray.set(key, reveals);
  return reveals;
}

function revealsOf(tray: PathTray): PathReveals {
  // Coverage alone, which counts what the UI thread's mask counts at a
  // fraction of its cost.
  const mask = makeCoverage(tray.width, tray.height, tray.cells);
  const bows = pathBows(QUICK_PATH.seed);
  const cellsMs = tray.cells.map(() => -1);
  const strokeMs = pathStrokeMs();
  const start = pathPoint(0, tray.field, bows);
  let x = start.x;
  let y = start.y;
  stampCoverage(mask, x, y, x, y, BRUSH_RADIUS);
  let drawn = 0;
  let boxMs = -1;
  const reveal = (now: number) => {
    const shares = maskShares(mask);
    for (let i = 0; i < shares.length; i++) {
      if (cellsMs[i]! < 0 && revealedAt(shares[i]!)) cellsMs[i] = now;
    }
    if (boxMs < 0 && boxDoneAt(shares)) boxMs = now;
  };
  reveal(0);
  for (let frame = 1; boxMs < 0; frame++) {
    const now = frame * QUICK_PATH.frameMs;
    const ended = now >= strokeMs - QUICK_PATH.slackMs;
    const until = ended ? strokeMs : now;
    const steps = pathSteps(drawn, until, tray.field, bows, x, y);
    for (let i = 0; i < steps.length; i += 2) {
      stampCoverage(mask, x, y, steps[i]!, steps[i + 1]!, BRUSH_RADIUS);
      x = steps[i]!;
      y = steps[i + 1]!;
    }
    drawn = until;
    reveal(now);
    if (ended && boxMs < 0) boxMs = now;
  }
  for (let i = 0; i < cellsMs.length; i++) {
    if (cellsMs[i]! < 0) cellsMs[i] = boxMs;
  }
  return { cellsMs, boxMs };
}

/** Which trays a press sweeps: those whose box is not done yet. */
export type SweptTrays = { readonly winning: boolean; readonly yours: boolean };

/** Both trays swept, as on a card the finger has not finished either box of. */
export const BOTH_SWEPT: SweptTrays = { winning: true, yours: true };

/** Quick Scratch's pass, as the screen times it: see `quickPass`. */
export type QuickPass = {
  /**
   * Milliseconds after the press that the yours tray's sweep begins, both
   * trays swept: see `sweepHandOverMs`.
   */
  handOverMs: number;
  /** When the reveal ticks sound, milliseconds from the press, for the trays a press sweeps. */
  ticksMs: (swept: SweptTrays) => readonly number[];
};

/** A tray as Quick Scratch's band times it: its cells, and the diagonal the band runs along. */
export type BandTray = { cells: readonly CellBox[]; diagonal: Diagonal };

/**
 * Quick Scratch's pass over the two trays, a band over each in
 * `QUICK_SWEEP.ms`: the winning tray's from the press and the yours
 * tray's from the hand-over, which with `coin`, a coin riding the bands as
 * motion allows, waits for the winning tray's to lift away. A tray whose
 * box the finger has already finished is not swept, so it sounds no tick,
 * and with the winning tray finished the yours tray's sweep begins at the
 * press.
 */
export function quickPass(
  winning: BandTray,
  yours: BandTray,
  coin: boolean,
): QuickPass {
  const handOverMs = sweepHandOverMs(winning.cells, winning.diagonal, coin);
  return {
    handOverMs,
    ticksMs: (swept) =>
      sweepTickTimes(
        swept.winning ? winning.cells : [],
        winning.diagonal,
        swept.yours ? yours.cells : [],
        yours.diagonal,
        swept.winning ? handOverMs : 0,
      ),
  };
}
