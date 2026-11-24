// Ported from MiniGames games/wheel/src/soundCues.ts (0.11.0): the cues' numbers the web
// plays by. The iOS tick train, glides and bridge (most of that file) are left out: Web Audio
// plays every tick on its own, as MiniGames' web build does.
import { POINTER_ANGLE, SPIN_TIMING, TAU } from '../../../../shared/ported/engine';
import type { SpinLaunch } from '../../../../shared/ported/engine';

/** From MiniGames' `wheelMotion.ts`: what moved the wheel on a frame. */
export const MOTION = { spin: 0, hand: 1 } as const;
export type MotionKind = (typeof MOTION)[keyof typeof MOTION];

/**
 * The wheel's top speed in radians a second: a turn per cruise. The launch
 * ends on it and the settle starts from it, so no spin goes faster.
 */
export const CRUISE_SPEED = TAU / (SPIN_TIMING.cruiseMs / 1000);

/**
 * Which wedge boundary the pointer has last passed at `rotation`, counted
 * without wrapping: it changes by one each time a boundary passes under the
 * pointer. A boundary sits under it when the rotation is a whole number of
 * arcs from `POINTER_ANGLE`, as sector `i`'s centre is half an arc in.
 */
export function wedgeBoundary(rotation: number, sectorCount: number): number {
  'worklet';
  return Math.floor(
    (rotation - POINTER_ANGLE) / (TAU / Math.max(1, sectorCount)),
  );
}

/**
 * Boundaries passed between two readings of `wedgeBoundary`, whichever way
 * the wheel turned. The cruise repeats a whole turn, jumping back by a full
 * turn between repeats, which moves the count by the sector count and passes
 * nothing: a step is read as the shortest way round.
 */
export function boundariesPassed(
  from: number,
  to: number,
  sectorCount: number,
): number {
  'worklet';
  const count = Math.max(1, sectorCount);
  const step = to - from;
  return Math.abs(step - count * Math.round(step / count));
}

/** The rotation from one reading to the next, the shortest way round, in radians. */
export function turnedBy(from: number, to: number): number {
  'worklet';
  const step = to - from;
  return step - TAU * Math.round(step / TAU);
}

/**
 * Whether a reading of the speed can be taken at its word. No spin goes
 * faster than the cruise, but an animation catching up after a stall can
 * move the wheel most of a turn in one frame.
 */
export function believableSpeed(radiansPerSecond: number): boolean {
  'worklet';
  return Math.abs(radiansPerSecond) <= CRUISE_SPEED * 1.5;
}

/**
 * When the throw sounds: on the first reading of the wheel turning forward,
 * after its wind-up or from rest, and not again until it has stood still or
 * another spin starts. A reading that looks backwards mid-spin, as the
 * shortest way round reads an animation catching up after a stall, is no new
 * throw.
 *
 * A spin can start before the last one has stood still: a claim refused
 * just after an instant start stops the wheel over seconds, and Spin is
 * offered again while it coasts. Nothing between the two is a rest, so the
 * start itself re-arms the throw. An instant one sounds on the next forward
 * reading, at the press. A wind-up waits for its turn back first, since the
 * readings until then can still be the coast's, and then sounds on the
 * first forward one, exactly as from rest.
 */
export type ThrowCue = {
  /** A reading of the speed; true when the throw sounds on it. */
  read(radiansPerSecond: number): boolean;
  /** A spin has started, leaving rest, or the coast, as `start` says. */
  spinStarted(start: SpinLaunch): void;
  /** The wheel has stood still. */
  rest(): void;
};

export function createThrowCue(): ThrowCue {
  let thrown = false;
  // A wind-up started that has not been read turning back yet.
  let windingUp = false;
  return {
    read(radiansPerSecond) {
      if (windingUp) {
        if (!(radiansPerSecond > 0)) windingUp = false;
        return false;
      }
      if (thrown || !(radiansPerSecond > 0)) return false;
      thrown = true;
      return true;
    },
    spinStarted(start) {
      thrown = false;
      windingUp = start === 'windUp';
    },
    rest() {
      thrown = false;
      windingUp = false;
    },
  };
}

export type RestWatchOptions = {
  /** A pause in the readings longer than this is a stop. */
  restAfterMs: number;
  /** Less than this since the last reading, in radians, and the wheel has not moved. */
  stillRadians: number;
  /** The wheel's rotation now. */
  rotation: () => number;
  /** The time now, in ms. */
  now: () => number;
  /** The wheel has come to rest. */
  onRest: () => void;
};

/**
 * Tells when the wheel has stopped: no reading of its speed for
 * `restAfterMs`, and no turn since the last one. One timer covers a run of
 * readings, going back to sleep for what is left of the pause each time it
 * finds a newer one, rather than a timer cleared and set again per reading.
 */
export function createRestWatch({
  restAfterMs,
  stillRadians,
  rotation,
  now,
  onRest,
}: RestWatchOptions): {
  /** A reading of the speed, taken at rotation `turn`. */
  read(turn: number): void;
  /** Forgets a pending check, as the screen closes. */
  cancel(): void;
} {
  let readAt = 0;
  let readingAt = -Infinity;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const check = () => {
    const quiet = now() - readingAt;
    if (quiet < restAfterMs) {
      timer = setTimeout(check, restAfterMs - quiet);
      return;
    }
    // A stall of the JS thread holds this timer and the readings back alike,
    // so a quiet spell can be a busy moment rather than a stop: a wheel that
    // has moved since its last reading is still turning.
    const turn = rotation();
    if (Math.abs(turn - readAt) > stillRadians) {
      readAt = turn;
      timer = setTimeout(check, restAfterMs);
      return;
    }
    timer = null;
    onRest();
  };
  return {
    read(turn) {
      readAt = turn;
      readingAt = now();
      if (!timer) timer = setTimeout(check, restAfterMs);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

/**
 * Hands one frame's motion to its cues: a reading of the speed, NaN when the
 * frame had none, then a tick at `tickShare` of the top speed, NaN when no
 * wedge passed, each with what moved the wheel on that frame, a `MOTION`.
 * The speed goes first, as the throw and the tick's share were read in that
 * order on the frame.
 */
export function dispatchMotion(
  velocity: number,
  turn: number,
  tickShare: number,
  at: number,
  kind: MotionKind,
  onSpeed: (velocity: number, turn: number, kind: MotionKind) => void,
  onTick: (share: number, at: number, kind: MotionKind) => void,
): void {
  if (!Number.isNaN(velocity)) onSpeed(velocity, turn, kind);
  if (!Number.isNaN(tickShare)) onTick(tickShare, at, kind);
}

/** A speed in radians a second as a share of the cruise's, 0 to 1. */
export function speedShare(radiansPerSecond: number): number {
  'worklet';
  return Math.min(1, Math.abs(radiansPerSecond) / CRUISE_SPEED);
}

const clampShare = (share: number) => Math.min(1, Math.max(0, share));

/** The spin air's volume at `share` of the top speed: most of it early in the rise. */
export function spinLoopVolume(share: number): number {
  return clampShare(share) ** 0.8;
}

/** The spin air's playback rate: 0.84 at rest to 1.16 at the top speed. */
export function spinLoopRate(share: number): number {
  return 1 + 0.16 * (2 * clampShare(share) - 1);
}

/**
 * A tick's volume: full at rest down to 0.3 at the top speed, where the ticks
 * come 20 or more a second and would otherwise run together into a buzz. Each
 * is nudged within 6% either way, so a run of them does not sound machined.
 */
export function tickVolume(share: number, random: () => number): number {
  const level = 1 - 0.7 * clampShare(share);
  return Math.min(1, level * (0.94 + 0.12 * random()));
}

/** A tick's playback rate: 0.03 higher at the top speed, within 0.01 either way. */
export function tickRate(share: number, random: () => number): number {
  return 1 + 0.03 * clampShare(share) + (random() - 0.5) * 0.02;
}

/**
 * The bed makes room for the win: down to 0.56 over 0.35 s as the wheel
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

/** How long the spin air takes to fade once the wheel has stopped. */
export const SPIN_LOOP_FADE_SECONDS = 0.3;

/**
 * The title's glints while the wheel waits: the first at full level, the
 * second a little under, and every one after quieter still, so a glint every
 * seven seconds does not nag.
 */
export function shimmerVolume(nth: number): number {
  return nth <= 0 ? 1 : nth === 1 ? 0.8 : 0.6;
}
