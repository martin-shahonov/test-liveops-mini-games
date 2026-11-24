// The parts of MiniGames packages/win/src/types.ts (0.11.0) the ported win logic reads.
// The art types themselves (words, lights, effects) are the skin's: see `skin/types.ts`.

/** The tiers the win screen has art for: the top one is MAX WIN. */
export type WinArtTier = 'nice' | 'mega' | 'max';

/**
 * How one image of a lockup moves, frame by frame of its export at 30 fps
 * from frame `from`: four numbers a frame, its scale (1 at rest), how far
 * its centre has moved from where it rests (art px, x right, y down) and its
 * opacity.
 */
export type MotionTrack = { from: number; values: readonly number[] };

/** One image of a lockup: see MiniGames' `LockupElement`. */
export type LockupElement = {
  image: readonly [number, number];
  scale: number;
  centre: readonly [number, number];
  restOpacity: number;
  in: MotionTrack;
  out?: MotionTrack;
};

/** A pass of light: sheet frame `frames[i]` shows at export frame `from + i`. */
export type LockupRun = { from: number; frames: readonly number[] };

export type LockupPass = {
  over: 'tier' | 'win';
  frame: readonly [number, number];
  scale: number;
  centre: readonly [number, number];
  runs: readonly LockupRun[];
};

/** A tier's lockup over its export's `frames`: see MiniGames' `TierMotion`. */
export type TierMotion = {
  frames: number;
  settled: number;
  words: { tier: LockupElement; win: LockupElement };
  glows: { tier: LockupElement; win: LockupElement };
  passes: readonly LockupPass[];
};
