import type { LockupElement, TierMotion } from './types';

/**
 * Whether the lockup moves at the screen's rate, each of its values eased
 * between the export's frames, or steps at the export's 30 fps. The export
 * was rendered with motion blur, which smeared its fastest frames; the words
 * drawn sharp and stepped at 30 fps would strobe there instead.
 */
export const LOCKUP_SMOOTH = true;

/** The export's frames a second, which the lockup's timeline counts in. */
const LOCKUP_FPS = 30;

/**
 * An image's state at a moment of its lockup: its scale (1 at rest), how
 * far its centre has moved from where it rests (art px) and its opacity.
 */
export type LockupState = [number, number, number, number];

/**
 * The timeline frame `elapsedMs` after the win's own art came in, at the
 * export's rate: a whole one when stepping.
 */
export function timelineFrame(elapsedMs: number, smooth: boolean): number {
  'worklet';
  const t = (Math.max(0, elapsedMs) / 1000) * LOCKUP_FPS;
  return smooth ? t : Math.floor(t);
}

/**
 * The export frame on show `t` timeline frames in: the timeline holds the
 * settled frame `hold` frames longer than the export does.
 */
export function exportFrame(t: number, settled: number, hold: number): number {
  'worklet';
  if (t <= settled) return t;
  return t <= settled + hold ? settled : t - hold;
}

/**
 * The export frame a lockup of `motion` shows `elapsedMs` after the win's own
 * art came in, its settled frame held `hold` frames longer than the export
 * holds it: eased between whole frames unless `smooth` (LOCKUP_SMOOTH when not
 * given) is off, and its length, which shows nothing, once it is over.
 *
 * `smooth` takes no default in its parameter list: on a phone's UI thread a
 * default is worked out before the worklet unpacks the names it closes over,
 * so LOCKUP_SMOOTH named there is a global that does not exist, and the frame
 * callback's throw takes the app down.
 */
export function lockupFrame(
  motion: Pick<TierMotion, 'frames' | 'settled'>,
  elapsedMs: number,
  hold: number,
  smooth?: boolean,
): number {
  'worklet';
  const eased = smooth ?? LOCKUP_SMOOTH;
  return Math.min(
    motion.frames,
    exportFrame(timelineFrame(elapsedMs, eased), motion.settled, hold),
  );
}

/**
 * Value `k` of `element` (0 scale, 1 dx, 2 dy, 3 opacity) on whole export
 * frame `f`, held at the first and last of its lockup's `frames`.
 */
function valueAt(
  element: LockupElement,
  frames: number,
  f: number,
  k: number,
): number {
  'worklet';
  const at = Math.min(frames - 1, Math.max(0, f));
  const coming = at - element.in.from;
  if (coming >= 0 && coming * 4 < element.in.values.length) {
    return element.in.values[coming * 4 + k]!;
  }
  const going = element.out ? at - element.out.from : -1;
  if (element.out && going >= 0 && going * 4 < element.out.values.length) {
    return element.out.values[going * 4 + k]!;
  }
  if (k === 0) return 1;
  return k === 3 ? element.restOpacity : 0;
}

/**
 * `element` at export frame `e`: on a whole frame, its values there; between
 * two, a Catmull-Rom curve through those and the frames either side, the
 * curve its motion was fitted with, which meets every frame's values and
 * leaves none with a kink. The curve can overshoot, so its opacity is held
 * within 0 and 1 and its scale at 0 or more. Nothing shows from the end of
 * the last frame on.
 */
export function elementState(
  element: LockupElement,
  frames: number,
  e: number,
): LockupState {
  'worklet';
  if (!(e < frames)) return [1, 0, 0, 0];
  const f = Math.floor(e);
  const u = e - f;
  const state: LockupState = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const b = valueAt(element, frames, f, k);
    if (u === 0) {
      state[k] = b;
      continue;
    }
    const a = valueAt(element, frames, f - 1, k);
    const c = valueAt(element, frames, f + 1, k);
    const d = valueAt(element, frames, f + 2, k);
    state[k] =
      0.5 *
      (2 * b +
        (c - a) * u +
        (2 * a - 5 * b + 4 * c - d) * u * u +
        (3 * b - a - 3 * c + d) * u * u * u);
  }
  state[0] = Math.max(0, state[0]);
  state[3] = Math.min(1, Math.max(0, state[3]));
  return state;
}
