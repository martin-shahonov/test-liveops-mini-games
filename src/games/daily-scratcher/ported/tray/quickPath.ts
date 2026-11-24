import type { RoundedBox } from './field';

/**
 * Quick Scratch over YOUR SYMBOLS as the designer's reference plays it
 * (SPEC-scratch-animation section 6): the coin pressed down at her first
 * waypoint and drawn through six strokes, each eased so it speeds up and
 * slows without stopping and bowed a little sideways, then resting, lifting
 * and fading. Everything here is a function of the time since the path
 * began, from a fixed seed, so the UI thread draws the same path the screen
 * times its ticks by. No Skia here, so it runs under node as it does on the
 * UI thread.
 */

const FRAME_MS = 1000 / 60;

export const QUICK_PATH = {
  /** Her waypoints, as shares of the field: (0, 0) its top-left, (1, 1) its bottom-right. */
  waypoints: [
    [0.14, 0.55],
    [0.86, 0.44],
    [0.16, 0.4],
    [0.82, 0.52],
    [0.22, 0.62],
    [0.9, 0.71],
    [0.3, 0.8],
  ] as readonly (readonly [number, number])[],
  /** Each stroke's length, in her 60 fps frames: 129 in all, 2.15 s. */
  strokeFrames: [25, 22, 21, 24, 19, 18] as readonly number[],
  frameMs: FRAME_MS,
  /** The sideways bow's deviation, board points: her N(0, 18 px). */
  bow: 6,
  /** The bows' fixed seed, so every card's path is the same. */
  seed: 0x51c4a7e5,
  /**
   * After the last stroke, her frames: frame 129 brings the coin to the
   * last waypoint, it rests there on 130 to 133, lifts on 134 to 139 and
   * fades on 140 to 142, and the card holds on 143 to 148.
   */
  restFrames: 4,
  liftFrames: 6,
  fadeFrames: 3,
  holdFrames: 6,
  /**
   * The longest step the brush takes between two of the path's points,
   * board points: her bows curve over hundreds of points, so a chord this
   * long is off the curve by a few hundredths of a point, and her strokes
   * slow into each waypoint, where the steps are short anyway.
   */
  stepPoints: 12,
  /**
   * How close to a moment the frames' clock must come to have reached it,
   * ms: a sum of frame times lands a hair either side of a whole number of
   * frames, and the UI thread and the screen's schedule must agree on the
   * frame the path's strokes end on.
   */
  slackMs: 0.001,
} as const;

/** Milliseconds the path's strokes take. */
export function pathStrokeMs(): number {
  'worklet';
  let frames = 0;
  for (let i = 0; i < QUICK_PATH.strokeFrames.length; i++) {
    frames += QUICK_PATH.strokeFrames[i]!;
  }
  return frames * QUICK_PATH.frameMs;
}

/** Milliseconds from the path's start to the coin's lift: her frame 134, after the last stroke's frame and the rest. */
export function pathLiftMs(): number {
  'worklet';
  return pathStrokeMs() + (1 + QUICK_PATH.restFrames) * QUICK_PATH.frameMs;
}

/** Milliseconds her whole reference takes, the coin gone and the card held: 149 frames, 2.48 s. */
export function pathMs(): number {
  'worklet';
  return (
    pathLiftMs() +
    (QUICK_PATH.liftFrames + QUICK_PATH.fadeFrames + QUICK_PATH.holdFrames) *
      QUICK_PATH.frameMs
  );
}

/** Her easing: `0.65 smoothstep(t) + 0.35 t`, which never stops dead. */
export function pathEase(t: number): number {
  'worklet';
  const u = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return 0.65 * u * u * (3 - 2 * u) + 0.35 * u;
}

/** Each stroke's sideways bow, board points: her N(0, 18 px), drawn from `seed`. */
export function pathBows(seed: number): number[] {
  'worklet';
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const bows: number[] = [];
  for (let i = 0; i < QUICK_PATH.strokeFrames.length; i++) {
    const u = Math.max(random(), 1e-12);
    const v = random();
    const normal = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    bows.push(normal * QUICK_PATH.bow);
  }
  return bows;
}

/** Where the path is: the point, and the stroke it is on, or -1 once the strokes are done. */
export type PathPoint = { x: number; y: number; stroke: number };

/**
 * The path's point `ms` after it began, laid over `field` (its waypoints
 * are shares of it), each stroke bowed by `bows[stroke]`: from the first
 * waypoint before it begins to the last once its strokes are done.
 */
export function pathPoint(
  ms: number,
  field: RoundedBox,
  bows: readonly number[],
): PathPoint {
  'worklet';
  const points = QUICK_PATH.waypoints;
  const at = (i: number) => {
    const p = points[i]!;
    return {
      x: field.left + p[0] * field.width,
      y: field.top + p[1] * field.height,
    };
  };
  let frames = Math.max(0, ms) / QUICK_PATH.frameMs;
  for (let s = 0; s < QUICK_PATH.strokeFrames.length; s++) {
    const length = QUICK_PATH.strokeFrames[s]!;
    if (frames >= length) {
      frames -= length;
      continue;
    }
    const t = frames / length;
    const a = at(s);
    const b = at(s + 1);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const span = Math.sqrt(dx * dx + dy * dy);
    const e = pathEase(t);
    const bow = span > 0 ? (bows[s] ?? 0) * Math.sin(Math.PI * t) : 0;
    return {
      x: a.x + dx * e + (span > 0 ? (-dy / span) * bow : 0),
      y: a.y + dy * e + (span > 0 ? (dx / span) * bow : 0),
      stroke: s,
    };
  }
  const last = at(points.length - 1);
  return { x: last.x, y: last.y, stroke: -1 };
}

/**
 * The points the brush steps through as the path is drawn from `fromMs` to
 * `untilMs`, the brush last at (`x`, `y`): each stroke's part of the span
 * on its own, so a long frame that crosses a waypoint still reaches it, as
 * her 60 Hz frames do, rather than cutting the turn; and each part in as
 * many steps as keep each under `QUICK_PATH.stepPoints`, at even times, so
 * the trail follows the bow. As x, y pairs. The UI thread stamps these, and
 * the screen times its ticks from the same.
 */
export function pathSteps(
  fromMs: number,
  untilMs: number,
  field: RoundedBox,
  bows: readonly number[],
  x: number,
  y: number,
): number[] {
  'worklet';
  const out: number[] = [];
  if (!(untilMs > fromMs)) return out;
  const strokes = QUICK_PATH.strokeFrames;
  let from = fromMs;
  let lastX = x;
  let lastY = y;
  let edge = 0;
  for (let s = 0; s <= strokes.length && from < untilMs; s++) {
    // Where stroke `s` ends, or, past the last, the path itself.
    edge =
      s < strokes.length ? edge + strokes[s]! * QUICK_PATH.frameMs : Infinity;
    if (edge <= from + QUICK_PATH.slackMs) continue;
    const to = edge < untilMs - QUICK_PATH.slackMs ? edge : untilMs;
    const end = pathPoint(to, field, bows);
    const dx = end.x - lastX;
    const dy = end.y - lastY;
    const steps = Math.max(
      1,
      Math.ceil(Math.sqrt(dx * dx + dy * dy) / QUICK_PATH.stepPoints),
    );
    for (let k = 1; k <= steps; k++) {
      const p = pathPoint(from + ((to - from) * k) / steps, field, bows);
      out.push(p.x, p.y);
    }
    lastX = end.x;
    lastY = end.y;
    from = to;
  }
  return out;
}
