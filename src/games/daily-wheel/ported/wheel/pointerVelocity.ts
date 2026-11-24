/**
 * A finger's velocity as it lifts in a browser, read off the pointer events
 * the page was handed for it, at the times the browser stamped them as they
 * came in. Gesture Handler's own reading on the web falls short twice: its
 * tracker is fed one sample per pointermove it is dispatched and nothing at
 * the pointerup, so a finger that stopped and held still before lifting
 * keeps the speed of its last move, as fast as it was moving; and moves a
 * busy page is handed as one coalesced event reach it as one sample after a
 * gap that its tracker takes for a stop, so a flick lifted out of a long
 * task reads 0. Here every coalesced move counts at its own time, as the
 * event's list has it, and the lift is judged at the pointerup's own time,
 * so neither a busy page nor its frame rate can fake a stop or a flick: see
 * `liftVelocityOf`.
 */

/**
 * Where a pointer was, in CSS pixels, the web's points, and when, in ms on
 * the page's clock: a pointer event's `clientX`, `clientY` and `timeStamp`.
 */
export type PointerSample = { t: number; x: number; y: number };

/** A pointer's latest samples, oldest first. */
export type PointerTrack = readonly PointerSample[];

/**
 * How long a finger must have held its place before the lift to have
 * stopped, ms. A moving finger is sampled at 60 Hz at the least, so it
 * lifts within 17 ms of its last move, leaving the window 13 ms to spare,
 * and a finger held still over two samples at 60 Hz has stopped by it.
 */
export const STOP_MS = 30;

/**
 * How far a finger that has stopped may still move over `STOP_MS`, pixels:
 * the most any two of its samples since the window opened, with where it
 * was as it opened, lie apart. A resting finger reads within about a pixel
 * of where it rests, so its samples lie 2 apart at most, half a pixel under
 * this. The slowest flick, 5 rad/s at the hub's edge 42 pixels out on a
 * phone, moves 210 pixels a second, 2.8 over the 13 ms that a finger lifted
 * a whole 60 Hz interval after its last move leaves in the window, and
 * further out and at faster input more.
 */
export const STOP_PX = 2.5;

/**
 * The window a moving finger's velocity is read over, ms, up to its last
 * move: two moves at 60 Hz, more at faster input, short enough to follow a
 * flick that speeds up into the lift.
 */
export const VELOCITY_MS = 30;

/**
 * How long a pointer may send nothing between two moves and still have
 * been moving, ms: past that it had stopped, as Android's VelocityTracker
 * and Gesture Handler's own tracker on the web both take it, and its track
 * starts afresh. A browser that hands a busy page its moves coalesced
 * without their list leaves such a gap too; the moves before it then say
 * nothing about how fast the finger went after it, nor about where it
 * stopped, so a lift soon after is read at rest rather than at a speed
 * guessed across the gap.
 */
export const GAP_MS = 40;

/** How far back a track keeps its samples, ms: past both windows, with the latest sample before that kept too. */
const KEEP_MS = 100;

/**
 * `track` with `sample` added, as a browser hands them over in time order;
 * one out of order is left out, and one after a gap starts the track
 * afresh (see `GAP_MS`).
 */
export function trackWith(
  track: PointerTrack,
  sample: PointerSample,
): PointerTrack {
  const latest = track[track.length - 1];
  if (latest !== undefined && sample.t < latest.t) return track;
  if (latest !== undefined && sample.t - latest.t > GAP_MS) return [sample];
  // The latest sample by `from` stays, to say where the finger was as a
  // window opened that far back.
  const from = sample.t - KEEP_MS;
  let first = 0;
  for (let i = 0; i < track.length; i++) {
    if (track[i]!.t <= from) first = i;
  }
  const kept = track.slice(first);
  kept.push(sample);
  return kept;
}

/**
 * Whether the finger had stopped by `upAt`: its samples over the `STOP_MS`
 * before it, with where it was as that window opened, its latest sample by
 * then, lie less than `STOP_PX` apart. A finger at rest sends no moves, or
 * only its touch's jitter, so it has stopped whether its samples go quiet
 * or only wander; one still moving has a sample in the window a whole
 * step on.
 */
export function stoppedBy(track: PointerTrack, upAt: number): boolean {
  const opens = upAt - STOP_MS;
  let first = 0;
  for (let i = 0; i < track.length; i++) {
    if (track[i]!.t <= opens) first = i;
  }
  for (let i = first; i < track.length; i++) {
    const a = track[i]!;
    if (a.t > upAt) break;
    for (let j = i + 1; j < track.length; j++) {
      const b = track[j]!;
      if (b.t > upAt) break;
      if (Math.hypot(b.x - a.x, b.y - a.y) >= STOP_PX) return false;
    }
  }
  return true;
}

/** Pixels a second, x and y. */
export type Velocity = { vx: number; vy: number };

const AT_REST: Velocity = { vx: 0, vy: 0 };

/**
 * The finger's velocity as it lifted at `upAt`, pixels a second: none for a
 * finger that had stopped (see `stoppedBy`), and for one still moving, its
 * change of place over the `VELOCITY_MS` up to its last sample, where it
 * was as the window opened read between the samples either side, or from
 * its first sample for a track younger than the window. Up to its last
 * sample rather than to the lift, as a moving finger lifts before its next
 * move is due. Moves a busy page was handed late, each with its own time,
 * read at the speed they went.
 */
export function liftVelocityOf(track: PointerTrack, upAt: number): Velocity {
  let lastAt = -1;
  for (let i = 0; i < track.length; i++) {
    if (track[i]!.t > upAt) break;
    lastAt = i;
  }
  if (lastAt < 1 || stoppedBy(track, upAt)) return AT_REST;
  const last = track[lastAt]!;
  const opens = last.t - VELOCITY_MS;
  let from: PointerSample = track[0]!;
  for (let i = lastAt; i > 0; i--) {
    const a = track[i - 1]!;
    if (a.t > opens) continue;
    const b = track[i]!;
    const share = b.t > a.t ? (opens - a.t) / (b.t - a.t) : 1;
    from = {
      t: opens,
      x: a.x + (b.x - a.x) * share,
      y: a.y + (b.y - a.y) * share,
    };
    break;
  }
  const ms = last.t - from.t;
  if (!(ms > 0)) return AT_REST;
  return {
    vx: ((last.x - from.x) / ms) * 1000,
    vy: ((last.y - from.y) / ms) * 1000,
  };
}
