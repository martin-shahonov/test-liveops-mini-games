import type { CellBox } from './coverage';
import { alongDiagonal, type Diagonal } from './diagonal';

/**
 * Quick Scratch's wipe: a soft-edged band that crosses the tray from its
 * top-left corner to its bottom-right, clearing the foil as it goes, the
 * coin riding ahead of it. Everything here is a function of the time since
 * the sweep began, so the screen and the UI thread read the same sweep.
 */
export const QUICK_SWEEP = {
  ms: 650,
  /** How wide the band's edge is, board points: foil fades across it. */
  soft: 40,
  /** How far ahead of the band's centre the coin rides, board points. */
  coinAhead: 60,
  /** No two reveal ticks closer than this, as the band passes cells: see `thinTicks`. */
  tickGapMs: 60,
} as const;

/** More sweeps than one card's restores ever ask for: see `sweepToken`. */
const SWEEPS_PER_RESTORE = 2 ** 20;

/**
 * The token that starts sweep number `sweep`, asked for while the card is
 * on restore `restore`: a number, so it reaches the UI thread as a shared
 * value does, that carries the restore it was asked under. A refused
 * claim's restore and the next press can reach a tray in the same frame,
 * and the tray tells a sweep asked for since the foil came back, which it
 * plays, from one asked for before, which the restore ends.
 */
export function sweepToken(restore: number, sweep: number): number {
  'worklet';
  return restore * SWEEPS_PER_RESTORE + sweep;
}

/** The restore a sweep's token was asked for under. */
export function sweepTokenRestore(token: number): number {
  'worklet';
  return Math.floor(token / SWEEPS_PER_RESTORE);
}

/** An ease-in-out, cubic each way: the band starts from rest and comes to rest. */
export function sweepEase(t: number): number {
  'worklet';
  const u = Math.min(1, Math.max(0, t));
  if (u < 0.5) return 4 * u * u * u;
  const back = 2 - 2 * u;
  return 1 - (back * back * back) / 2;
}

/** The time, 0 to 1, at which `sweepEase` reaches `progress`. */
export function sweepEaseInverse(progress: number): number {
  'worklet';
  const p = Math.min(1, Math.max(0, progress));
  if (p < 0.5) return Math.cbrt(p / 4);
  return 1 - Math.cbrt(2 * (1 - p)) / 2;
}

/** How far the sweep has got, 0 to 1, `elapsedMs` after it began. */
export function sweepProgress(elapsedMs: number): number {
  'worklet';
  return sweepEase(elapsedMs / QUICK_SWEEP.ms);
}

/**
 * The band's centre along the diagonal at `progress`: it starts with its
 * far edge on the top-left corner, so nothing is cleared before it moves,
 * and ends with its near edge past the bottom-right one, so everything is.
 */
export function sweepFront(progress: number, d: Diagonal): number {
  'worklet';
  return -QUICK_SWEEP.soft / 2 + progress * (d.length + QUICK_SWEEP.soft);
}

/**
 * Milliseconds into the band that its coin, `coinAhead` of the band's
 * centre, reaches the tray's far corner, where it lifts away.
 */
export function bandCoinLiftMs(d: Diagonal): number {
  'worklet';
  const reach = d.length + QUICK_SWEEP.soft;
  const front = d.length - QUICK_SWEEP.coinAhead;
  const progress = reach > 0 ? (front + QUICK_SWEEP.soft / 2) / reach : 1;
  return QUICK_SWEEP.ms * sweepEaseInverse(progress);
}

/** Where the coin is with the band's centre at `front`: on the diagonal, `coinAhead` further along. */
export function sweepCoin(
  front: number,
  d: Diagonal,
): { x: number; y: number } {
  'worklet';
  const along = front + QUICK_SWEEP.coinAhead;
  return { x: d.ux * along, y: d.uy * along };
}

/** A cell as the sweep passes it: when, and where the band's centre is then. */
export type SweepStep = {
  index: number;
  /** The cell's centre along the diagonal. */
  front: number;
  /** Milliseconds after the sweep began that the band's centre reaches it. */
  atMs: number;
};

/**
 * The cells in the order the band passes their centres, with when it does:
 * what the screen ticks to, and the UI thread reveals by. A cell further
 * along the diagonal is passed later, whatever its row or column.
 */
export function sweepOrder(
  cells: readonly CellBox[],
  d: Diagonal,
): SweepStep[] {
  'worklet';
  const reach = d.length + QUICK_SWEEP.soft;
  const steps: SweepStep[] = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    const front = alongDiagonal(
      d,
      cell.left + cell.width / 2,
      cell.top + cell.height / 2,
    );
    const progress = reach > 0 ? (front + QUICK_SWEEP.soft / 2) / reach : 1;
    steps.push({
      index: i,
      front,
      atMs: QUICK_SWEEP.ms * sweepEaseInverse(progress),
    });
  }
  steps.sort((a, b) => a.front - b.front || a.index - b.index);
  return steps;
}

/**
 * The ticks to play out of those due at `atMs`, in order: the first, and
 * each later one `gapMs` or more after the last played, so cells the band
 * passes together sound as one tick rather than a burst.
 */
export function thinTicks(atMs: readonly number[], gapMs: number): number[] {
  'worklet';
  const kept: number[] = [];
  let last = -Infinity;
  for (let i = 0; i < atMs.length; i++) {
    const at = atMs[i]!;
    if (at - last < gapMs) continue;
    kept.push(at);
    last = at;
  }
  return kept;
}
