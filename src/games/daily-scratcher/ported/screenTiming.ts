/**
 * The screen's own pace, in milliseconds and board points: what happens
 * between the trays' last cell and the win package's screen, and how the
 * overlays come and go. `docs/art/scratcher.md` has where each number comes
 * from.
 */

/**
 * From the outcome becoming final, both boxes done and the claim
 * reconciled, to the win screen or the no-win end: time for the last
 * cell's fade to end, a win's darkening (`UNMATCHED_DARK`) to land, and the
 * eye to read the card before it is covered.
 */
export const OUTCOME_AFTER_MS = 400;

/**
 * The no-win end. Where a skin shows the no-win plate (`noWinPlate`), it
 * rises `risePt` from a little below the card's centre over `riseMs` with
 * a short ease, COLLECT over it, and stays. `handOverMs` is how long after
 * the end shows the reward goes to the host by itself, COLLECT then a way
 * to go sooner: null waits for COLLECT or the close (Jackie's design, the
 * default until the user says otherwise); 2500 was the hold before COLLECT.
 */
export const NO_WIN: {
  readonly riseMs: number;
  readonly risePt: number;
  readonly handOverMs: number | null;
} = { riseMs: 350, risePt: 24, handOverMs: null };

/**
 * How a win's reward reaches the host: 'collect' on COLLECT, offered once
 * the win screen has gone, or on the close (Jackie's design, the default
 * until the user says otherwise); 'auto' as the celebration ends, as
 * before COLLECT. A close or an unmount hands it over either way, and a
 * reward goes over exactly once.
 */
export type WinHandOver = 'collect' | 'auto';

export const WIN_HAND_OVER: WinHandOver = 'collect';

/** The yours cells dim as a card with no match ends: an overlay per cell, to `opacity` over `ms`. */
export const CELL_DIM = { opacity: 0.45, ms: 300 } as const;

/**
 * A win's cells with no part in its match go dark as soon as it is known,
 * to her non-matching numbers, which their darkened copies are baked with:
 * over `ms`, eased out, which ends before the win screen covers the card,
 * and there they stay.
 */
export const UNMATCHED_DARK = { ms: 300 } as const;

/** How long the dim under How To Play and the no-win plate takes to come in and go. */
export const OVERLAY_FADE_MS = 200;
