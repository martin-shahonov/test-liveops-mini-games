/**
 * What the resting card waits for: the static card before the cover comes
 * off, and the glow round the button, which fades in just after, before
 * the open is over.
 */
export type RevealPart =
  | 'cardshadow'
  | 'card'
  | 'titlegame'
  /** QUICK SCRATCH, the universal button: every slice of its frame and faces, and its word's face. */
  | 'btnquick'
  /** COLLECT, the same, mounted unseen beside QUICK SCRATCH, so the swap never waits on a decode or the face. */
  | 'btncollect'
  /** The text lines, every glyph sheet in: the cells' values and the top prize's. */
  | 'prizes'
  /** The backdrop's still. */
  | 'backdrop'
  /** The trays' canvases, the coating drawn intact over each. */
  | 'traywinning'
  | 'trayyours'
  /** Each tray's cells under its coating: every tile and symbol image in. */
  | 'artwinning'
  | 'artyours'
  | 'canvasKit'
  /** The glow's sheet, decoded. */
  | 'sheets'
  /** The glow's canvas, every clip drawn unseen, so none uploads on screen. */
  | 'buttonGlow';

export const REVEAL_PARTS: readonly RevealPart[] = [
  'cardshadow',
  'card',
  'titlegame',
  'btnquick',
  'btncollect',
  'prizes',
  'backdrop',
  'traywinning',
  'trayyours',
  'artwinning',
  'artyours',
  'canvasKit',
  'sheets',
  'buttonGlow',
];

/**
 * The longest the static card stays covered from mount, counting only time
 * the player could see it. Past it the card is shown with what it has, and
 * what it was still waiting for is reported. The glow is not part of it:
 * see `LIT_WITHIN_MS`.
 */
export const REVEAL_WITHIN_MS = 2500;

/**
 * How long the card may stay covered, in view, before the coin loader is
 * drawn over the cover: `LOADER.appearAfterMs`, the owner's pick in the Game
 * Loading Lab, so an open that is nearly there never flashes it.
 */
export const LOADING_AFTER_MS = 500;

/**
 * The longest the open waits for the glow once the card is shown, counting
 * only time in view. Past it the open goes on without it: the landing's
 * art is readied, and what was still missing is reported.
 */
export const LIT_WITHIN_MS = 2500;

/**
 * Frames between the last part of the static card coming in and the cover
 * coming off, so the last image to arrive has been drawn once under the
 * cover rather than on the frame it lifts.
 */
export const REVEAL_FRAMES = 1;

export type RevealInputs = {
  /** The card prints text lines: its cells' values or a top prize. */
  prizes: boolean;
  /** The skin has a glow round the button. */
  glow: boolean;
  /**
   * The trays and the glow draw through CanvasKit, which loads first on
   * the web; they are not waited for once it has failed, or when there is
   * no way to load it.
   */
  canvasKit: 'native' | 'loading' | 'failed';
};

/**
 * Every part the static card draws, so every part the cover waits for: the
 * stills, both words of the button among them, the text lines, the
 * backdrop, each tray's cells, which are images, and the trays, which draw
 * through Skia and so, on the web, through CanvasKit: they are waited for
 * while it loads and not once it has failed. The TOP PRIZE plate is the
 * card's own still, so a card without a top prize waits for nothing more
 * than one with.
 */
export function revealNeeds({ prizes, canvasKit }: RevealInputs): RevealPart[] {
  const needs: RevealPart[] = [
    'cardshadow',
    'card',
    'titlegame',
    'btnquick',
    'btncollect',
    'backdrop',
    'artwinning',
    'artyours',
  ];
  if (prizes) needs.push('prizes');
  if (canvasKit !== 'failed') needs.push('traywinning', 'trayyours');
  return needs;
}

/**
 * Every part the glow needs before it is lit: its sheet decoded, its canvas
 * readied and, on the web, CanvasKit. Nothing for a skin without a glow,
 * or once CanvasKit has failed and it cannot draw.
 */
export function glowNeeds({ glow, canvasKit }: RevealInputs): RevealPart[] {
  if (!glow || canvasKit === 'failed') return [];
  const needs: RevealPart[] = ['sheets', 'buttonGlow'];
  if (canvasKit === 'loading') needs.push('canvasKit');
  return needs;
}

export function pendingParts(
  needs: readonly RevealPart[],
  settled: ReadonlySet<RevealPart>,
): RevealPart[] {
  return needs.filter((part) => !settled.has(part));
}

/** A timer, cancelled by what it returns, and the time it counts in. */
export type RevealClock = {
  after: (ms: number, run: () => void) => () => void;
  now: () => number;
};

export type RevealWait = {
  settle: (part: RevealPart) => void;
  /** How many of the parts waited for have settled, of how many: a loader's decoding. */
  progress: () => { done: number; total: number };
  /** Looks again at what is waited for, which can change from render to render. */
  check: () => void;
  /**
   * Whether the player can see the card. The timeout only counts time in
   * view: an open the player switched away from, a hidden page or an app
   * in the background, has nothing to show and loads nothing, so is not
   * slow. Out of view pauses the timer rather than ending the wait, so a
   * card unmounted and mounted again, as an effect cleaned up and set up
   * again is, carries on where it was.
   */
  inView: (seen: boolean) => void;
};

/**
 * Waits for the parts `needs` names, then calls `open` once: with nothing,
 * when every one has settled, or with those still pending once the card
 * has been in view for `withinMs`. The timer starts when it is first told
 * the card is in view, and stops whenever it is told it is not.
 */
export function createRevealWait(
  needs: () => readonly RevealPart[],
  open: (late: readonly RevealPart[]) => void,
  clock: RevealClock,
  withinMs: number = REVEAL_WITHIN_MS,
): RevealWait {
  const settled = new Set<RevealPart>();
  let done = false;
  /** What is left of the limit, in time in view. */
  let left = withinMs;
  let since: number | null = null;
  let cancel: (() => void) | null = null;

  const stop = () => {
    cancel?.();
    cancel = null;
  };
  const finish = (late: readonly RevealPart[]) => {
    if (done) return;
    done = true;
    stop();
    open(late);
  };
  const check = () => {
    if (!done && pendingParts(needs(), settled).length === 0) finish([]);
  };
  const pause = () => {
    if (since === null) return;
    stop();
    left = Math.max(0, left - (clock.now() - since));
    since = null;
  };

  return {
    settle: (part) => {
      settled.add(part);
      check();
    },
    progress: () => {
      const all = needs();
      return {
        done: all.length - pendingParts(all, settled).length,
        total: all.length,
      };
    },
    check,
    inView: (seen) => {
      if (done) return;
      if (seen && since !== null) return;
      pause();
      if (!seen) return;
      since = clock.now();
      cancel = clock.after(left, () => {
        cancel = null;
        finish(pendingParts(needs(), settled));
      });
    },
  };
}

/**
 * Counts the copies of a part in: `done` once, when as many have settled as
 * `drawn` says are drawn. Every prize line is an image of its own, which
 * Android requests one by one, so one line being in says nothing of the
 * rest.
 */
export function createCopies(
  drawn: () => number,
  done: () => void,
): { settle: () => void; check: () => void } {
  let settled = 0;
  let told = false;
  const check = () => {
    const count = drawn();
    if (told || count === 0 || settled < count) return;
    told = true;
    done();
  };
  return {
    settle: () => {
      settled += 1;
      check();
    },
    check,
  };
}
