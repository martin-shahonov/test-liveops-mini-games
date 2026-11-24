import {
  liftVelocityOf,
  trackWith,
  type PointerSample,
  type PointerTrack,
  type Velocity,
} from './pointerVelocity';
import type { MoveTrace } from './wheelDrag';

/**
 * The pointers the page is following, and the velocity of the one that
 * lifted last, until another goes down. One record for the page, as one
 * finger at a time takes the wheel.
 */
const pointers = {
  tracks: new Map<number, PointerTrack>(),
  lifted: null as Velocity | null,
  watchers: 0,
};

/** Every move an event carries, each at the time it came in: a coalesced pointermove's own list, or the event itself. */
function samplesOf(event: PointerEvent): PointerSample[] {
  const list =
    typeof event.getCoalescedEvents === 'function'
      ? event.getCoalescedEvents()
      : [];
  return (list.length > 0 ? list : [event]).map((e) => ({
    t: e.timeStamp,
    x: e.clientX,
    y: e.clientY,
  }));
}

function onDown(event: PointerEvent): void {
  pointers.lifted = null;
  let track: PointerTrack = [];
  for (const sample of samplesOf(event)) track = trackWith(track, sample);
  pointers.tracks.set(event.pointerId, track);
}

function onMove(event: PointerEvent): void {
  let track = pointers.tracks.get(event.pointerId);
  if (track === undefined) return;
  for (const sample of samplesOf(event)) track = trackWith(track, sample);
  pointers.tracks.set(event.pointerId, track);
}

function onUp(event: PointerEvent): void {
  const track = pointers.tracks.get(event.pointerId);
  pointers.tracks.delete(event.pointerId);
  // The up itself says where the finger last was, which its moves already
  // have, and when it lifted, which the reading is judged at.
  pointers.lifted =
    track === undefined ? null : liftVelocityOf(track, event.timeStamp);
}

function onCancel(event: PointerEvent): void {
  pointers.tracks.delete(event.pointerId);
  pointers.lifted = null;
}

const LISTENERS = [
  ['pointerdown', onDown],
  ['pointermove', onMove],
  ['pointerup', onUp],
  ['pointercancel', onCancel],
] as const;

/**
 * Follows every pointer on the page from the window, ahead of the
 * gesture's own listeners on the disc's view, so a release has the
 * finger's velocity read by the time the gesture ends; the function
 * returned stops, once every caller has called it.
 */
export function followPointers(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (pointers.watchers++ === 0) {
    for (const [type, listener] of LISTENERS) {
      window.addEventListener(type, listener, true);
    }
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    if (--pointers.watchers > 0) return;
    for (const [type, listener] of LISTENERS) {
      window.removeEventListener(type, listener, true);
    }
    pointers.tracks.clear();
    pointers.lifted = null;
  };
}

/**
 * The finger's velocity as it lifts, CSS pixels a second, read off the
 * page's pointer events (see `pointerVelocity`) rather than the gesture's
 * `velocityX` and `velocityY`, which on the web keep the speed of a
 * finger's last move however long it then held still. It runs as the
 * gesture ends, in the pointerup the window's listener has just read; a
 * gesture that ends without one, a cancel, has nothing to throw with.
 */
export function liftVelocity(_vx: number, _vy: number): Velocity {
  return pointers.lifted ?? { vx: 0, vy: 0 };
}

/**
 * Whether the finger was still moving as it lifted, as far as the moves the
 * UI thread heard can say: on the web always, as the page's own reading
 * already reads a stop from its samples' own times (see `stoppedBy`), so
 * the velocity it hands over is never the stale one a device's can be, and
 * when the thread heard the moves is left out of it.
 */
export function movingAtLift(
  _trace: MoveTrace,
  _at: number,
  _out: number,
): boolean {
  return true;
}
