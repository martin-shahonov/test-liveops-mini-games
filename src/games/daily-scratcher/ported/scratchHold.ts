import type { Tray } from './screenState';

/**
 * The longest a decode waits on a finger that never rests, ms: past it the
 * sheet decodes under the finger, so a scratch that keeps going cannot keep
 * a claim's lockup back for good. A stroke across a tray takes well under
 * a second, and a finger rests between strokes.
 */
export const SCRATCH_HOLD_MOST_MS = 1500;

/** Work on the JS thread held back while a finger scratches: see `createScratchHold`. */
export type ScratchHold = {
  /**
   * Settles at once while no finger moves; otherwise once none does, or
   * after `SCRATCH_HOLD_MOST_MS`.
   */
  clear: () => Promise<void>;
  /**
   * A tray's reading of the finger's speed, as the tray reports it: above
   * 0 while the finger moves, and 0 once as it stops.
   */
  speed: (tray: Tray, pointsPerSecond: number) => void;
  /**
   * The moving finger went on from one tray onto the other without
   * lifting: still held, and nothing woken.
   */
  handOver: (from: Tray, to: Tray) => void;
  /** No finger may scratch: whatever the trays said last, none moves now. */
  lifted: () => void;
  /** The screen has gone: whatever waits goes on. */
  dispose: () => void;
};

/**
 * Holds back a decode on the JS thread while a finger scratches. That
 * thread carries what the finger feels and hears, the haptic ticks, the
 * speed the scratch loop follows, the reveal ticks and the match chimes,
 * so a page decoded under a moving finger stalls all of them for as long
 * as it takes; one decoded as the finger rests between strokes stalls
 * nothing it would notice. A finger moves on a tray from a speed above 0
 * to the 0 the tray reports as it stops, or until the card is taken from
 * the finger. `after` is a timer, cancelled by what it returns.
 */
export function createScratchHold(
  after: (ms: number, run: () => void) => () => void = (ms, run) => {
    const timer = setTimeout(run, ms);
    return () => clearTimeout(timer);
  },
): ScratchHold {
  const moving: Record<Tray, boolean> = { winning: false, yours: false };
  let waiting: (() => void)[] = [];
  let ceiling: (() => void) | null = null;
  const held = () => moving.winning || moving.yours;
  const wake = () => {
    ceiling?.();
    ceiling = null;
    const woken = waiting;
    waiting = [];
    woken.forEach((resolve) => resolve());
  };
  const lifted = () => {
    moving.winning = false;
    moving.yours = false;
    wake();
  };
  return {
    clear: () => {
      if (!held()) return Promise.resolve();
      return new Promise((resolve) => {
        waiting.push(resolve);
        ceiling ??= after(SCRATCH_HOLD_MOST_MS, wake);
      });
    },
    speed: (tray, pointsPerSecond) => {
      moving[tray] = pointsPerSecond > 0;
      if (!held()) wake();
    },
    handOver: (from, to) => {
      moving[to] = moving[from];
      moving[from] = false;
    },
    lifted,
    dispose: lifted,
  };
}
