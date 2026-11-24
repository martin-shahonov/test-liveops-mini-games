import { FLICK, POINTER_ANGLE, TAU } from '../../../../shared/ported/engine';

/**
 * The maths of turning the wheel by hand, as plain worklets: where a touch
 * may take the disc, how the finger's angle is followed, how a release is
 * read off the finger's own velocity, whether it throws a spin, how fast
 * the wheel leaves the hand, and how a release that throws nothing eases
 * the wheel to rest. The gesture that feeds them lives in
 * `WheelDragArea`, the frame loop that applies them in `dragMotion`; nothing
 * here touches either, so it all runs under node as it does on the UI
 * thread.
 */

/**
 * The disc's geometry for a touch, in points, from the art: the hit area is
 * the rim's square, so its centre is the wheel's. A touch takes the wheel
 * between the gem's opaque disc, whose radius is `hubShare` of the gem's
 * width, and the rim's outer edge, half the rim's box; near the centre the finger's
 * angle swings wildly for a small move, so inside `deadShare` of the hub
 * the wheel holds still and takes the angle up again as the finger leaves.
 */
export const DRAG_RING = {
  hubShare: 0.401,
  deadShare: 0.6,
} as const;

/**
 * Android's system Back gesture starts from either side edge of the
 * screen, and the disc reaches within a few points of both, so a drag that
 * started there would close the wheel. A touch inside this band of either
 * edge, in points of the window, takes nothing there: the band is the
 * gesture navigation's own default inset. iOS and the web keep the whole
 * ring.
 */
export const ANDROID_EDGE_BAND = 24;

/**
 * The ease that brings the wheel to rest after a release that throws no
 * spin: a slow, a short, a backward or a cancelled one, or a flick the
 * screen refused. However fast the wheel turns as it is let go, it then
 * travels half a sector's arc at most, its seat included, so a release
 * that threw nothing never carries the pointer on past the prize beside
 * the one it was on.
 *
 * It opens at the speed the wheel was drawn turning, no faster than the
 * finger went as it lifted, and from rest for a finger that had stopped
 * (see `leaveSpeed` and `STILL_SPEED`), so the hand-over moves nothing,
 * and brakes as an out-cubic does, the deceleration falling away to nothing as the coast
 * ends. A slow release coasts on for `250 + 40 x |speed|` ms, a third of
 * its speed times that far; the coast goes `coastArcs` of an arc at most,
 * and one that would go further brakes over just that, in the time its
 * speed would take to cross one sector. From the fastest releases
 * that is short and strong, `2 x speed^2 / arc` at the start: from 20 rad/s
 * on twenty sectors, 2546 rad/s^2 over 15.7 ms, and 637 over 62.8 ms on
 * five; from 5 rad/s, 159 over 62.8 ms on twenty and 40 over 251 ms on
 * five. A jab read at 43 rad/s brakes in 7.3 ms on twenty.
 *
 * The wheel then comes to rest in a seat, within `seatArcs` of an arc of a
 * sector's centre, the middle two thirds where the landings rest, so it
 * never rests on a boundary where the pointer names two prizes. The seat is
 * the nearest one, either way, a sixth of an arc at most, so it never
 * pushes the pointer on to another prize, and it glides in over `minMs` at
 * least, however short the coast.
 */
export const EASE = {
  minMs: 250,
  msPerRadianPerSecond: 40,
  coastArcs: 1 / 3,
  seatArcs: 1 / 3,
} as const;

/** A touch's place against the disc's centre, in points: whether it may take the wheel. */
export function grabsAt(
  dx: number,
  dy: number,
  hubRadius: number,
  rimRadius: number,
): boolean {
  'worklet';
  const r2 = dx * dx + dy * dy;
  return r2 >= hubRadius * hubRadius && r2 <= rimRadius * rimRadius;
}

/** Whether a touch `absoluteX` across a window `width` wide is in a side band `band` wide. */
export function inEdgeBand(
  absoluteX: number,
  width: number,
  band: number,
): boolean {
  'worklet';
  return band > 0 && (absoluteX < band || absoluteX > width - band);
}

/**
 * Whether a finger going down takes the wheel: while the screen lets a
 * finger have it (`grabbable`) and no spin holds it (`inSpin`), on the ring
 * between the hub and the rim, `dx`, `dy` from the centre, and out of the
 * side bands, `absoluteX` across a window `width` wide.
 */
export function takesTouch(
  grabbable: boolean,
  inSpin: boolean,
  dx: number,
  dy: number,
  hubRadius: number,
  rimRadius: number,
  absoluteX: number,
  width: number,
  band: number,
): boolean {
  'worklet';
  return (
    grabbable &&
    !inSpin &&
    grabsAt(dx, dy, hubRadius, rimRadius) &&
    !inEdgeBand(absoluteX, width, band)
  );
}

/**
 * The finger on the wheel: its angle around the centre, unwrapped since the
 * grab, and the last raw angle, `atan2`'s, it was read at. Screen y points
 * down, so the angle grows clockwise, the way `rotate()` turns the disc and
 * a spin goes forward.
 */
export type FingerAngle = {
  /** Radians turned since the grab, any number of turns either way. */
  angle: number;
  /** The last raw reading, -pi to pi. */
  raw: number;
  /** The finger is in the dead zone: the angle holds until it leaves. */
  lost: boolean;
  /**
   * The angle the finger last came out of the dead zone at, or null for one
   * that never went in: a release counts only what it turned since (see
   * `clearOfHub`).
   */
  outAt: number | null;
};

/** The finger as it takes the wheel at `dx`, `dy` from the centre. */
export function fingerAt(dx: number, dy: number): FingerAngle {
  'worklet';
  return { angle: 0, raw: Math.atan2(dy, dx), lost: false, outAt: null };
}

/**
 * The finger moved to `dx`, `dy`: the angle moves by the step the shortest
 * way round, so crossing the raw reading's seam at pi turns on smoothly
 * rather than a turn back. In the dead zone it holds, and on leaving it the
 * raw reading is taken afresh, so the wheel never jumps by the swing the
 * finger made across the centre.
 */
export function followFinger(
  finger: FingerAngle,
  dx: number,
  dy: number,
  deadRadius: number,
): FingerAngle {
  'worklet';
  if (dx * dx + dy * dy < deadRadius * deadRadius) {
    return finger.lost ? finger : { ...finger, lost: true };
  }
  const raw = Math.atan2(dy, dx);
  if (finger.lost) {
    return { angle: finger.angle, raw, lost: false, outAt: finger.angle };
  }
  const step = raw - finger.raw;
  return {
    angle: finger.angle + step - TAU * Math.round(step / TAU),
    raw,
    lost: false,
    outAt: finger.outAt,
  };
}

/**
 * How far back the wheel must turn before the run counts as having changed
 * direction, in radians: a finger lifting off wobbles back a hair, which
 * must not cost a flick its travel.
 */
export const RUN_REVERSAL = 0.03;

/**
 * The run the finger is on: which way it is turning the wheel, the furthest
 * it has got that way, and where the forward run started.
 */
export type Run = { way: 1 | -1; turnAt: number; runFrom: number };

/** A run from the grab at `rotation`, taken as forward until it turns back. */
export function runFrom(rotation: number): Run {
  'worklet';
  return { way: 1, turnAt: rotation, runFrom: rotation };
}

/**
 * The run with the wheel at `turned`: it changes direction once the wheel
 * has come back `RUN_REVERSAL` from the furthest point of the run, and a
 * new forward run starts at the bottom of the backward one, so winding the
 * wheel back and then flinging it counts the fling's travel alone.
 */
export function trackRun(run: Run, turned: number): Run {
  'worklet';
  if (run.way > 0) {
    if (turned >= run.turnAt) return { ...run, turnAt: turned };
    if (run.turnAt - turned <= RUN_REVERSAL) return run;
    return { way: -1, turnAt: turned, runFrom: run.runFrom };
  }
  if (turned <= run.turnAt) return { ...run, turnAt: turned };
  if (turned - run.turnAt <= RUN_REVERSAL) return run;
  return { way: 1, turnAt: turned, runFrom: run.turnAt };
}

/** How far forward the finger has turned the wheel on this run, at `turned`. */
export function runTravel(run: Run, turned: number): number {
  'worklet';
  return turned - (run.way > 0 ? run.runFrom : run.turnAt);
}

/**
 * How far a finger must go along its arc round the centre over the last
 * stretch before it lifts to have been moving, points. A resting finger's
 * reading wanders about a point either way, 2 points across at most, half
 * a point short of this, and the slowest flick, `FLICK.minSpeed` at the
 * hub's edge, 42 points out on a 390 point wide phone, goes it in 12 ms.
 */
export const STILL_DISTANCE = 2.5;

/**
 * How fast a finger may still go along its arc round the centre as it
 * lifts and have stopped, points a second: under this the wheel is let go
 * at rest, as it was drawn, and only glides into its seat. It is
 * `STILL_DISTANCE` over 30 ms that tell a stopped finger from one still
 * moving, 83 points a second, rounded down. A resting finger's reading
 * wanders 2 points across at most, which a reading of its speed over 30 ms
 * or more puts at 67 points a second or less. The slowest flick,
 * `FLICK.minSpeed` at the hub's edge, goes 210 points a second, and faster
 * further out, so no finger read as stopped could throw.
 */
export const STILL_SPEED = 80;

/**
 * How recently before a lift a device must have heard the finger move,
 * ms of the UI thread's own time, for the velocity the platform hands over
 * to count (see `heardMovingAt`). A finger still moving is heard lifting
 * well within it: Android hands the lift over as it comes, the moves it
 * still holds first, so within a touch sample of the last move, 17 ms on
 * the slowest, 60 Hz screens; UIKit hands touches over once a display
 * frame, the lift too, so a lift can come a sample and a frame after the
 * last move was heard, 33 ms at 60 Hz for both. That leaves a 60 Hz
 * frame of other work on the thread before a lift heard late reads as a
 * stop. And a moving finger is heard again within it, a 24 Hz frame apart
 * at the slowest.
 */
export const HEARD_MS = 50;

/**
 * What the UI thread heard of a finger on a device, oldest first: when it
 * handled each move, the grab's included, ms on its own clock, and the
 * finger's angle round the centre after it (see `FingerAngle`), which holds
 * while the finger is in the dead zone.
 */
export type MoveTrace = readonly { at: number; angle: number }[];

/**
 * `trace` with a move handled at `at` that left the finger at `angle`,
 * keeping what a lift needs: the moves of the last `HEARD_MS`, and the
 * latest before that, which says where the finger was as that stretch
 * opened.
 */
export function traceWith(
  trace: MoveTrace,
  at: number,
  angle: number,
): MoveTrace {
  'worklet';
  const from = at - HEARD_MS;
  let first = 0;
  for (let i = 0; i < trace.length; i++) {
    if (trace[i]!.at <= from) first = i;
  }
  const kept = trace.slice(first);
  kept.push({ at, angle });
  return kept;
}

/**
 * Whether a device heard the finger still moving as it lifted, the lift
 * handled at `at` on the UI thread's clock, `out` points from the centre:
 * the thread handled a move of it in the last `HEARD_MS`, and over that
 * stretch the finger went `STILL_DISTANCE` or more along its arc.
 *
 * The velocity a device hands over can be stale. Android 8 to 13 ignore
 * the lift and keep the velocity of the last move however long the finger
 * then held still, on a touch screen that sends nothing for a resting
 * finger; only from Android 14 does a lift 40 ms after the last move read
 * as a stop. UIKit's estimator is private, so iOS may do the same. A
 * finger that stopped dead on a prize, held and lifted would then throw at
 * the speed it stopped from and spend the day's claim. The thread hears
 * the moves and the lift in the order they came, so a finger that held
 * still is heard going quiet before its lift, or only wandering where it
 * rests, however late the thread hears it all, and one still moving is
 * heard moving just before it, the moves a busy spell held up included, as
 * they are handed over ahead of the lift.
 *
 * What the thread cannot tell is when the moves it heard all at once after
 * a stall were made, so where the finger was as the stretch opened is
 * taken from a move only if the next was heard within `HEARD_MS` of it.
 * Behind a stall that long the finger may have stopped and held, and the
 * moves heard after it, handed over together, show no travel of their
 * own. So this fails safe: a flick whose lift is heard after the thread
 * went `HEARD_MS` without hearing the finger, a stall from its last move
 * or over its last moves and the lift, reads as a stop and throws nothing,
 * and the player flicks again; and no finger heard holding still throws,
 * whatever velocity the platform hands over.
 */
export function heardMovingAt(
  trace: MoveTrace,
  at: number,
  out: number,
): boolean {
  'worklet';
  const opens = at - HEARD_MS;
  let first = -1;
  for (let i = 0; i < trace.length; i++) {
    if (trace[i]!.at > opens) {
      first = i;
      break;
    }
  }
  if (first < 0) return false;
  const from =
    first > 0 && trace[first]!.at - trace[first - 1]!.at < HEARD_MS
      ? first - 1
      : first;
  let low = Infinity;
  let high = -Infinity;
  for (let i = from; i < trace.length; i++) {
    const { angle } = trace[i]!;
    if (angle < low) low = angle;
    if (angle > high) high = angle;
  }
  return (high - low) * out >= STILL_DISTANCE;
}

/**
 * Whether the finger lifted clear of the hub, `out` points from the
 * centre: outside the dead zone, where the wheel holds still whatever the
 * finger does, and `STILL_DISTANCE` or more along its arc on from where it
 * last came out of it. A finger swung into the gem lifts at a velocity
 * that turned nothing, and one only just out has barely taken the wheel
 * up again, so neither throws, nor eases on at that velocity: the wheel
 * was drawn still.
 */
export function clearOfHub(finger: FingerAngle, out: number): boolean {
  'worklet';
  if (finger.lost) return false;
  if (finger.outAt === null) return true;
  return Math.abs(finger.angle - finger.outAt) * out >= STILL_DISTANCE;
}

/**
 * How the finger let go, as the platform read it from the touches' own
 * times (see `liftVelocity`): whether the gesture ended or was cancelled,
 * how fast it went along its arc round the centre, and whether it was seen
 * moving the wheel at all as it lifted. Both things a release decides,
 * whether it throws and whether the finger had stopped, are read from
 * this, so no stall of the UI thread, frame rate or way the moves were
 * delivered can fake a flick.
 */
export type HandRelease = {
  /** The gesture ended with the finger lifting; false for a cancel, which never throws. */
  ok: boolean;
  /**
   * Points a second along the finger's arc round the centre, forward
   * positive: the part of its velocity across the line to the centre, where
   * it lifted.
   */
  along: number;
  /**
   * Radians a second round the centre, forward positive: `along` over how
   * far out the finger lifted, no nearer than the hub's edge, so a lift
   * that strayed inside the hub reads as at its edge.
   */
  turning: number;
  /**
   * The finger's own speed, points a second, whichever way it went, as the
   * platform handed it over: for the readout, which so shows what a device
   * reports for a finger it was not seen moving.
   */
  fingerSpeed: number;
  /**
   * The finger was seen moving the wheel as it lifted: clear of the hub
   * (see `clearOfHub`), and on a device heard moving up to the lift (see
   * `heardMovingAt`). One that was not had stopped, whatever its velocity.
   */
  moving: boolean;
};

/**
 * The release of a finger going at `vx`, `vy` points a second as it lifted
 * at `dx`, `dy` from the centre, the hub's edge `hubRadius` out, seen
 * `moving` the wheel or not. Screen y points down, so the turn grows
 * clockwise, the way a spin goes forward. A reading that is no number
 * reads as a finger at rest.
 */
export function releaseOf(
  vx: number,
  vy: number,
  dx: number,
  dy: number,
  hubRadius: number,
  ok: boolean,
  moving: boolean,
): HandRelease {
  'worklet';
  const fingerSpeed = Math.sqrt(vx * vx + vy * vy);
  const out = Math.sqrt(dx * dx + dy * dy);
  const along = out > 0 ? (dx * vy - dy * vx) / out : 0;
  const radius = Math.max(hubRadius, out);
  if (!Number.isFinite(fingerSpeed) || !Number.isFinite(along)) {
    return { ok, along: 0, turning: 0, fingerSpeed: 0, moving };
  }
  return {
    ok,
    along,
    turning: radius > 0 ? along / radius : 0,
    fingerSpeed,
    moving,
  };
}

/**
 * Whether the finger had stopped as it lifted: not seen moving the wheel,
 * or going slower than `STILL_SPEED` along its arc.
 */
export function stoppedAt(release: HandRelease): boolean {
  'worklet';
  return !release.moving || !(Math.abs(release.along) >= STILL_SPEED);
}

/**
 * The window the wheel's drawn speed is read over, ms: about three frames
 * at 60 Hz and six at 120, enough to even out a finger's moves landing
 * unevenly between frames, short enough to follow a flick that speeds up
 * into the release.
 */
export const SPEED_WINDOW_MS = 50;

/** The wheel's angle at the latest frames of a drag, oldest first. */
export type Trail = readonly { t: number; r: number }[];

/**
 * `trail` with the wheel at `r` at the frame `t`, keeping what one window
 * needs: the frames of the last two windows, and the last four however old,
 * so a window across a long frame still reads the step the wheel was drawn
 * to take over it.
 */
export function trailWith(trail: Trail, t: number, r: number): Trail {
  'worklet';
  const kept = trail.filter(
    (sample, i) => sample.t >= t - 2 * SPEED_WINDOW_MS || i >= trail.length - 3,
  );
  kept.push({ t, r });
  return kept;
}

/**
 * How fast the frames drew the wheel turning up to the frame `end`, radians
 * a millisecond: its angle's change since the latest frame at least
 * `SPEED_WINDOW_MS` before `end`, or since the oldest kept for a drag
 * younger than that, a frame that held still counting as still. Reaching
 * back to a frame that old keeps a dropped frame from leaving the window
 * one sample short. It is how the wheel was seen to turn, so what it does
 * at the release goes on from it with no step; after a stall that froze the
 * wheel, from the step it was drawn to take across the stall, which was
 * there to see.
 */
export function trailSpeed(trail: Trail, end: number): number {
  'worklet';
  let first = 0;
  let last = -1;
  for (let i = 0; i < trail.length; i++) {
    const { t } = trail[i]!;
    if (t > end) break;
    if (t <= end - SPEED_WINDOW_MS) first = i;
    last = i;
  }
  if (last <= first) return 0;
  const a = trail[first]!;
  const b = trail[last]!;
  return (b.r - a.r) / (b.t - a.t);
}

/**
 * The speed the wheel leaves the hand at, a flick's or an ease's, in the
 * units it is given: `drawn`, the wheel's as its frames drew it (see
 * `trailSpeed`), held to `decided`, the finger's as the release read it,
 * and nothing where the two go opposite ways or the wheel was drawn still.
 * So the wheel goes on as it was drawn, with no step, and never faster than
 * the finger really went: a window of frames that reaches back over a
 * finger slowing into the lift reads more than it went as it lifted.
 */
export function leaveSpeed(drawn: number, decided: number): number {
  'worklet';
  if (drawn > 0) return Math.max(0, Math.min(drawn, decided));
  if (drawn < 0) return Math.min(0, Math.max(drawn, decided));
  return 0;
}

/** Why a release did, or did not, throw a spin: see `releaseVerdict`. */
export type DragReleaseReason =
  /** Forward, fast and far enough: a spin is asked for. */
  | 'flick'
  /** Forward, but slower than `FLICK.minSpeed`, a finger that had stopped included. */
  | 'slow'
  /** Fast enough, but the finger turned the wheel less than `FLICK.minTravel` since it last changed direction. */
  | 'short'
  /** The finger was going backwards round the centre as it lifted. */
  | 'backward'
  /** The gesture was cancelled, as by the system or another gesture, never a throw. */
  | 'cancelled'
  /** A spin took the wheel from the finger before it let go. */
  | 'taken'
  /** A flick the screen could not spin: a spin already in play, a lock, or a wheel that cannot pay out. */
  | 'refused';

export type ReleaseVerdict = {
  flick: boolean;
  /**
   * The finger's speed round the centre that decided it, radians a second:
   * a flick's held to `FLICK.maxSpeed`, and any other release's its own.
   * The wheel leaves no faster (see `leaveSpeed`).
   */
  speed: number;
  reason: DragReleaseReason;
};

/**
 * Whether a release throws a spin, with the finger going round the centre
 * at `speed` radians a second as it lifted, as the platform read it, 0 for
 * one that had stopped, and `travel` the radians the finger turned the
 * wheel forward since it last changed direction: forward, at
 * `FLICK.minSpeed` or faster, over `FLICK.minTravel` or more. A harder
 * flick is held to `FLICK.maxSpeed`. Anything else throws nothing and
 * eases to rest, a cancel, `ok` false, included, as does a quick jab fast
 * enough to throw but too short.
 */
export function releaseVerdict(
  ok: boolean,
  speed: number,
  travel: number,
): ReleaseVerdict {
  'worklet';
  if (!ok) return { flick: false, speed, reason: 'cancelled' };
  if (speed < 0) return { flick: false, speed, reason: 'backward' };
  if (speed < FLICK.minSpeed) return { flick: false, speed, reason: 'slow' };
  if (travel < FLICK.minTravel) return { flick: false, speed, reason: 'short' };
  return {
    flick: true,
    speed: Math.min(speed, FLICK.maxSpeed),
    reason: 'flick',
  };
}

// A worklet takes the functions it calls as it is defined, so each helper is
// declared above the worklets that call it, and the engine's `sectorArc`,
// which is no worklet, is spelled out where it is needed.

/** One sector's arc, radians. */
function arcOf(sectorCount: number): number {
  'worklet';
  return TAU / Math.max(1, sectorCount);
}

/** How far the rotation `r` is past the nearest sector centre under the pointer, in arcs, -0.5 to 0.5. */
function seatOffset(r: number, sectorCount: number): number {
  'worklet';
  const arc = arcOf(sectorCount);
  const along = (POINTER_ANGLE - r) / arc - 0.5;
  return -(along - Math.round(along));
}

/**
 * Where a wheel coasting to `p` comes to rest: `p` itself inside a seat,
 * else the nearer edge of the seat either side, a sixth of an arc at most
 * away, which is always the seat of the sector already under the pointer.
 */
export function seatFor(p: number, sectorCount: number): number {
  'worklet';
  const past = seatOffset(p, sectorCount);
  const edge = EASE.seatArcs;
  if (Math.abs(past) <= edge) return p;
  return p + (past > 0 ? edge - past : -edge - past) * arcOf(sectorCount);
}

/** A release eased to rest: see `easeToRest`. */
export type Ease = {
  from: number;
  /** Radians a millisecond at the release. */
  speed: number;
  /** How long the coast brakes for, ms. */
  coastMs: number;
  /** How long the whole ease takes, seat included, ms. */
  ms: number;
  /** Where the coast alone would end, and where the seat moves that to. */
  coastTo: number;
  restsAt: number;
};

/**
 * The ease from a release at `from`, turning at `speed` radians a
 * millisecond, to rest in a seat; see `EASE`. The coast is an out-cubic
 * from the release speed, which opens at exactly that speed, so the
 * hand-over moves nothing, and lands with nothing left to brake; the
 * seat's shift rides on a smoothstep over the whole ease, which is still
 * at both ends. The coast, a third of an arc at most, and the seat, a
 * sixth, each move only one way, so between them the wheel goes half an
 * arc at most however it turns, even where the seat brings it back.
 */
export function easeToRest(
  from: number,
  speed: number,
  sectorCount: number,
): Ease {
  'worklet';
  // A reading that is no number leaves nothing to coast on.
  const turning = Number.isFinite(speed) ? speed : 0;
  const pace = Math.abs(turning);
  const slowMs = EASE.minMs + EASE.msPerRadianPerSecond * pace * 1000;
  const slowCoast = (pace * slowMs) / 3;
  const reach = EASE.coastArcs * arcOf(sectorCount);
  // Held to its reach, the coast opens at the same speed and brakes harder.
  const coast = Math.min(slowCoast, reach);
  const coastMs = slowCoast > reach ? (3 * reach) / pace : slowMs;
  const coastTo = from + Math.sign(turning) * coast;
  return {
    from,
    speed: turning,
    coastMs,
    ms: Math.max(coastMs, EASE.minMs),
    coastTo,
    restsAt: seatFor(coastTo, sectorCount),
  };
}

/** The eased wheel's angle `t` ms after the release. */
export function easeAngleAt(ease: Ease, t: number): number {
  'worklet';
  if (t >= ease.ms) return ease.restsAt;
  const at = Math.max(0, t);
  const left = 1 - Math.min(1, at / ease.coastMs);
  const u = at / ease.ms;
  return (
    ease.from +
    (ease.coastTo - ease.from) * (1 - left * left * left) +
    (ease.restsAt - ease.coastTo) * u * u * (3 - 2 * u)
  );
}
