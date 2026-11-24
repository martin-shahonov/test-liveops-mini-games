import {
  FLICK,
  LAUNCH_AT_MS,
  SPIN_TIMING,
  TAU,
  THROW_MS,
  type SpinLaunch,
} from '../../../../shared/ported/engine';
import {
  settleEasing,
  settleEasingSlope,
  settleTarget,
} from './spinController';

const {
  windUpMs: WINDUP_MS,
  windUpRadians: WINDUP_RADIANS,
  launchMs: LAUNCH_MS,
  cruiseMs: CRUISE_MS,
  settleMs: SETTLE_MS,
} = SPIN_TIMING;

/** In radians a millisecond. */
const CRUISE_SPEED = TAU / CRUISE_MS;
/**
 * The launch speeds up on `Easing.in(quad)`, which ends at twice its average
 * speed, so it covers v * L / 2 to end on the cruise speed, v.
 */
const LAUNCH_RADIANS = (CRUISE_SPEED * LAUNCH_MS) / 2;

const BLEND_MS = FLICK.blendMs;

/** How long a spin stopped short takes to slow to rest. */
export const STOP_MS = SETTLE_MS / 2;

/**
 * A whole spin as one curve of the time since its first frame, in
 * milliseconds, to the wheel's angle, in radians: the wind-up and its hold,
 * where the spin has them, the launch, the cruise, then the settle or a stop.
 * Each piece takes over at the angle and the speed the one before leaves at,
 * whatever the time it takes over, so a frame read off it anywhere moves the
 * wheel as far as the curve does over that frame, and no join between pieces
 * loses or gains time. A wind-up's start is the one join that is not smooth:
 * it snaps back from rest. An instant start is smooth there too, the launch
 * picking up from no speed at all, and so is a flick, which picks up from
 * the speed the finger left the wheel at.
 */
export type SpinCurve = {
  /** How the spin left rest. */
  start: SpinLaunch;
  /** The angle the spin started from. */
  from: number;
  /** A flick's release speed, in radians a millisecond: 0 for the other starts. */
  speed: number;
  /** When the settle takes over: Infinity until one is asked for. */
  settleAt: number;
  /** The angle the settle takes over at. */
  settleFrom: number;
  /** Where the settle comes to rest: the claimed sector. */
  settleTo: number;
  /** When the spin was stopped short: Infinity unless it was. */
  stopAt: number;
  /** The angle it was stopped at. */
  stopFrom: number;
  /** How fast it was turning then, in radians a millisecond. */
  stopSpeed: number;
};

// A worklet takes the functions it calls as it is defined, so each helper is
// declared above the worklets that call it.

/**
 * A spin thrown from `from`, turning until a settle or a stop is asked for:
 * a flick from `speed`, in radians a millisecond, as the finger left it.
 */
export function throwCurve(
  from: number,
  start: SpinLaunch,
  speed = 0,
): SpinCurve {
  'worklet';
  return {
    start,
    from,
    speed: start === 'flick' ? speed : 0,
    settleAt: Infinity,
    settleFrom: from,
    settleTo: from,
    stopAt: Infinity,
    stopFrom: from,
    stopSpeed: 0,
  };
}

/** Where the launch starts from, against the angle the spin started at. */
function launchFrom(start: SpinLaunch): number {
  'worklet';
  return start === 'windUp' ? -WINDUP_RADIANS : 0;
}

/**
 * How far a flick has turned the wheel `t` after its release, from `speed`
 * there: the speed moves to the cruise's on a smoothstep of the blend's
 * time, 3u^2 - 2u^3, whose slope is nought at both ends, so the speed joins
 * the release and the cruise with no step and no kink. The angle is that
 * speed's integral: the release speed's run, plus the share of the gap the
 * smoothstep has covered, u^3 - u^4 / 2 of it over the blend. Then on at
 * the cruise, the blend having covered the two speeds' mean over its time.
 */
function flickedBy(speed: number, t: number): number {
  'worklet';
  if (t >= BLEND_MS) {
    return (
      (BLEND_MS * (speed + CRUISE_SPEED)) / 2 + CRUISE_SPEED * (t - BLEND_MS)
    );
  }
  const u = t / BLEND_MS;
  return (
    speed * t + (CRUISE_SPEED - speed) * BLEND_MS * u * u * u * (1 - u / 2)
  );
}

/** How fast a flick turns the wheel `t` after its release. */
function flickSpeed(speed: number, t: number): number {
  'worklet';
  if (t >= BLEND_MS) return CRUISE_SPEED;
  const u = t / BLEND_MS;
  return speed + (CRUISE_SPEED - speed) * u * u * (3 - 2 * u);
}

/**
 * How far the throw has turned the wheel `t` in: back on `Easing.out(poly(4))`
 * for a wind-up, still for its hold, forward on `Easing.in(quad)` up to the
 * cruise speed, then on at it. An instant start has no wind-up or hold, so
 * its launch begins at the press, from rest. A flick blends from its release
 * speed instead: see `flickedBy`.
 */
function thrownBy(curve: SpinCurve, t: number): number {
  'worklet';
  if (t <= 0) return 0;
  const start = curve.start;
  if (start === 'flick') return flickedBy(curve.speed, t);
  const launchAt = LAUNCH_AT_MS[start];
  if (t < launchAt) {
    if (t >= WINDUP_MS) return -WINDUP_RADIANS;
    const left = 1 - t / WINDUP_MS;
    return -WINDUP_RADIANS * (1 - left * left * left * left);
  }
  const back = launchFrom(start);
  const thrown = THROW_MS[start];
  if (t < thrown) {
    const launched = (t - launchAt) / LAUNCH_MS;
    return back + LAUNCH_RADIANS * launched * launched;
  }
  return back + LAUNCH_RADIANS + CRUISE_SPEED * (t - thrown);
}

/** How fast the throw turns the wheel `t` in, in radians a millisecond. */
function throwSpeed(curve: SpinCurve, t: number): number {
  'worklet';
  const start = curve.start;
  if (start === 'flick') return flickSpeed(curve.speed, Math.max(0, t));
  if (t <= 0) return 0;
  const launchAt = LAUNCH_AT_MS[start];
  if (t < launchAt) {
    if (t >= WINDUP_MS) return 0;
    const left = 1 - t / WINDUP_MS;
    return (-4 * WINDUP_RADIANS * left * left * left) / WINDUP_MS;
  }
  if (t < THROW_MS[start]) return (CRUISE_SPEED * (t - launchAt)) / LAUNCH_MS;
  return CRUISE_SPEED;
}

/** Where the settle has got to `t` in, as a share of its time, 0 to 1. */
function settleProgress(curve: SpinCurve, t: number): number {
  'worklet';
  return Math.min(1, (t - curve.settleAt) / SETTLE_MS);
}

/** The wheel's angle `t` into the spin. */
export function angleAt(curve: SpinCurve, t: number): number {
  'worklet';
  if (t >= curve.stopAt) {
    // Stopped before its launch, the wind-up plays out and holds.
    const launchAt = LAUNCH_AT_MS[curve.start];
    if (curve.stopAt < launchAt) {
      return curve.from + thrownBy(curve, Math.min(t, launchAt));
    }
    const left = 1 - Math.min(1, (t - curve.stopAt) / STOP_MS);
    // An out-cubic opens at three times its average speed.
    const distance = (curve.stopSpeed * STOP_MS) / 3;
    return curve.stopFrom + distance * (1 - left * left * left);
  }
  if (t >= curve.settleAt) {
    const progress = settleProgress(curve, t);
    if (progress === 1) return curve.settleTo;
    const distance = curve.settleTo - curve.settleFrom;
    return curve.settleFrom + distance * settleEasing(distance)(progress);
  }
  return curve.from + thrownBy(curve, t);
}

/**
 * How fast the wheel turns `t` into the spin, before any stop, in radians a
 * millisecond: what a stop slows from, and what a refused flick's ease
 * starts at.
 */
export function turningAt(curve: SpinCurve, t: number): number {
  'worklet';
  if (t >= curve.settleAt) {
    const distance = curve.settleTo - curve.settleFrom;
    const slope = settleEasingSlope(distance, settleProgress(curve, t));
    return (distance * slope) / SETTLE_MS;
  }
  return throwSpeed(curve, t);
}

/**
 * The spin asked, `t` in, to settle on `resting`. The settle takes over once
 * the launch, or a flick's blend, has reached the cruise speed, or at `t` if
 * that is later, from
 * the angle the curve is at then, so it joins the cruise wherever a frame
 * falls. Asked again, or once stopped, it changes nothing.
 */
export function settling(
  curve: SpinCurve,
  t: number,
  resting: number,
): SpinCurve {
  'worklet';
  if (curve.settleAt !== Infinity || curve.stopAt !== Infinity) return curve;
  const settleAt = Math.max(THROW_MS[curve.start], t);
  const settleFrom = angleAt(curve, settleAt);
  return {
    start: curve.start,
    from: curve.from,
    speed: curve.speed,
    settleAt,
    settleFrom,
    settleTo: settleTarget(settleFrom, resting),
    stopAt: Infinity,
    stopFrom: curve.from,
    stopSpeed: 0,
  };
}

/** When the wheel comes to rest: Infinity while it is still to be told how. */
export function restsAt(curve: SpinCurve): number {
  'worklet';
  if (curve.stopAt !== Infinity) {
    return curve.stopAt < LAUNCH_AT_MS[curve.start]
      ? Math.max(curve.stopAt, WINDUP_MS)
      : curve.stopAt + STOP_MS;
  }
  return curve.settleAt + SETTLE_MS;
}

/**
 * The spin stopped short `t` in: it slows to rest from the speed it is
 * turning at, so the stop is as smooth as the rest of the curve. Asked
 * again, or once at rest, it changes nothing.
 */
export function stopping(curve: SpinCurve, t: number): SpinCurve {
  'worklet';
  if (curve.stopAt !== Infinity || t >= restsAt(curve)) return curve;
  return {
    start: curve.start,
    from: curve.from,
    speed: curve.speed,
    settleAt: curve.settleAt,
    settleFrom: curve.settleFrom,
    settleTo: curve.settleTo,
    stopAt: t,
    stopFrom: angleAt(curve, t),
    stopSpeed: turningAt(curve, t),
  };
}

/** Whether the spin comes to rest by its settle, on the claimed sector. */
export function settles(curve: SpinCurve): boolean {
  'worklet';
  return curve.stopAt === Infinity && curve.settleAt !== Infinity;
}
