import type { SoundVoice } from '../../../shared/ported/runtime';

/**
 * How the scratcher's sounds follow the game: every number the cues play
 * by, as plain functions, so they can be checked without a device.
 */

/**
 * The finger's speed at which the scratch loop is at full volume, in points
 * a second: a brisk stroke across a tray. A finger scratching in earnest
 * moves 200 to 800 points a second, so a slow, careful stroke is heard
 * below this and a fast one is no louder than the file.
 */
export const SCRATCH_FULL_SPEED = 600;

/**
 * How long the scratch loop takes to fall silent once the finger slows,
 * stops or lifts: long enough to ride over a reading or two of a finger
 * that merely paused, short enough that a lifted finger is not followed
 * by a scrape.
 */
export const SCRATCH_RELEASE_SECONDS = 0.15;

/**
 * How fast the loop comes up as the finger moves, and goes as it lifts: the
 * designer's 40 ms, short enough that the scrape reads as the stroke's own
 * start and end, long enough not to click.
 */
export const SCRATCH_ATTACK_SECONDS = 0.04;
export const SCRATCH_LIFT_SECONDS = 0.04;

/**
 * How far the loop's rate bends either way with the finger's speed: 0.85
 * at rest, as recorded at 300 points a second, 1.15 from
 * `SCRATCH_FULL_SPEED`, as the wheel's spin air bends. The pitch moves with
 * it where the player bends it, on the web and on Android; iOS plays a
 * loop's rate as its tempo alone, so the engine leaves this loop unbent
 * there and only its volume follows.
 */
export const SCRATCH_RATE_BEND = 0.15;

const clampShare = (share: number) => Math.min(1, Math.max(0, share));

/**
 * The scratch loop's volume at the finger's speed: 0 at rest, 1 from
 * `SCRATCH_FULL_SPEED` up, with most of the rise early, so a slow stroke
 * is heard and the loop stops growing before the finger stops going
 * faster.
 */
export function scratchVolume(pointsPerSecond: number): number {
  return clampShare(pointsPerSecond / SCRATCH_FULL_SPEED) ** 0.6;
}

/** The scratch loop's rate at the finger's speed: see `SCRATCH_RATE_BEND`. */
export function scratchRate(pointsPerSecond: number): number {
  const share = clampShare(pointsPerSecond / SCRATCH_FULL_SPEED);
  return 1 + SCRATCH_RATE_BEND * (2 * share - 1);
}

/**
 * Where the scratch loop goes from `from`, and how fast: up with the
 * finger over the attack, down over the release.
 */
export function scratchMove(
  pointsPerSecond: number,
  from: number,
): { volume: number; seconds: number } {
  const volume = scratchVolume(pointsPerSecond);
  return {
    volume,
    seconds: volume < from ? SCRATCH_RELEASE_SECONDS : SCRATCH_ATTACK_SECONDS,
  };
}

export type ScratchCue = {
  /**
   * A reading of the finger's speed while it is on a tray: the loop starts
   * on the first reading of it moving and follows each one after, its
   * volume and its rate, down to silence over the release when it stops,
   * kept running so the next move is heard at once.
   */
  read(pointsPerSecond: number): void;
  /** The finger lifted, or the stroke ended: the loop fades over `seconds` and goes. */
  lift(seconds?: number): void;
};

export type ScratchCueOptions = {
  /** Starts the loop, or declines with null while its file cannot play. */
  play(options: {
    volume: number;
    fadeIn: number;
    rate: number;
  }): SoundVoice | null;
};

/**
 * Plays the scratch loop under a moving finger. One voice serves a stroke:
 * started as the finger first moves, its volume and its rate following the
 * finger's speed through `scratchMove` and `scratchRate`, and stopped as the
 * finger lifts. A finger that stops without lifting leaves the loop running
 * silent, so its next move needs no new play.
 */
export function createScratchCue({ play }: ScratchCueOptions): ScratchCue {
  let voice: SoundVoice | null = null;
  let level = 0;
  return {
    read(pointsPerSecond) {
      const move = scratchMove(pointsPerSecond, level);
      const rate = scratchRate(pointsPerSecond);
      if (!voice) {
        if (move.volume <= 0) return;
        voice = play({
          volume: move.volume,
          fadeIn: SCRATCH_ATTACK_SECONDS,
          rate,
        });
        level = voice ? move.volume : 0;
        return;
      }
      voice.setVolume(move.volume, move.seconds);
      // At rest the loop keeps its last bend: it is silent there anyway.
      if (pointsPerSecond > 0) voice.setRate(rate);
      level = move.volume;
    },
    lift(seconds = SCRATCH_RELEASE_SECONDS) {
      voice?.stop(seconds);
      voice = null;
      level = 0;
    },
  };
}

/**
 * How long the loop runs on silent after the finger has stopped before it
 * is put away, should no lift be heard: a finger that paused mid-stroke
 * keeps its voice, and one that has left the card frees its player after
 * this. The tray's lift puts it away at once.
 */
export const SCRATCH_REST_MS = 1500;

/**
 * Puts the scratch loop away once the finger has read as stopped for
 * `restAfterMs`: `lift` runs then, and not for a stop a move interrupts.
 * `after` is a timer, cancelled by what it returns.
 */
export function createScratchRest(
  lift: () => void,
  after: (ms: number, run: () => void) => () => void,
  restAfterMs: number = SCRATCH_REST_MS,
): {
  /** A reading of the finger's speed, 0 as it stops. */
  read(pointsPerSecond: number): void;
  /** Forgets a pending lift, as the loop is put away by other means or the screen closes. */
  cancel(): void;
} {
  let pending: (() => void) | null = null;
  const cancel = () => {
    pending?.();
    pending = null;
  };
  return {
    read(pointsPerSecond) {
      if (pointsPerSecond > 0) {
        cancel();
        return;
      }
      if (pending) return;
      pending = after(restAfterMs, () => {
        pending = null;
        lift();
      });
    },
    cancel,
  };
}

/**
 * The reveal tick's level, nudged within 6% either way as the wheel's
 * ticks are, so a run of cells revealing in a sweep does not sound
 * machined.
 */
export const REVEAL_VOLUME = 0.8;

export function revealVolume(random: () => number): number {
  return Math.min(1, REVEAL_VOLUME * (0.94 + 0.12 * random()));
}

/** The reveal tick's playback rate, within 0.01 either way. */
export function revealRate(random: () => number): number {
  return 1 + (random() - 0.5) * 0.02;
}

/**
 * The shortest gap between two reveal ticks, in ms: a stroke can uncover
 * two cells at once, and Quick Scratch's band crosses the yours tray's
 * cells in under 200 ms, in the fast middle of its ease, so the ticks are
 * thinned to one per this. The sweep's nine or twelve cells there sound as
 * three ticks, the winning tray's three cells one each. A matched cell's
 * chime comes with its tick, so the chimes are held to the same gap.
 */
export const REVEAL_TICK_GAP_MS = 60;

/** The most reveal ticks, or match chimes, a second: what sizes their players. */
export function revealPeakRate(): number {
  return 1000 / REVEAL_TICK_GAP_MS;
}

/** The match chime: at the file's own level, the brightest moment of the card. */
export const MATCH_VOLUME = 1;

/**
 * The coin's tink as it touches down and its whoosh as it lifts after a
 * stroke: wired, and silent until the skin carries the recordings the owner
 * picks. Both under the reveal tick's 0.8, which they can land with.
 */
export const TINK_VOLUME = 0.6;
export const WHOOSH_VOLUME = 0.35;

/** The Quick Scratch swish, a step under the chime it leads to. */
export const QUICK_VOLUME = 0.9;

/** The no-win tone, soft: it closes the card rather than scolds. */
export const NOWIN_VOLUME = 0.8;

/**
 * The bed makes room for the win: down to 0.56 over 0.35 s as the win
 * lands, held there while the coins fall, and back to full over 1.6 s.
 */
export const AMBIENCE_DUCK = {
  volume: 0.56,
  downSeconds: 0.35,
  upSeconds: 1.6,
};

/** Where the bed goes, and how fast, as a win lands or its shower ends. */
export function ambienceMove(ducked: boolean): {
  volume: number;
  seconds: number;
} {
  return ducked
    ? { volume: AMBIENCE_DUCK.volume, seconds: AMBIENCE_DUCK.downSeconds }
    : { volume: 1, seconds: AMBIENCE_DUCK.upSeconds };
}
