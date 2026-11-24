import { MASK_REACH, lowerTexel, type Mask } from './mask';

/**
 * The finger's brush: what a finger's stroke clears off a tray and counts
 * as scratched, and the ring it throws its flakes from. Quick Scratch's path
 * keeps the designer's round brush (`brush.ts`), so its shape and its ticks'
 * timing stay as they are.
 *
 * It stamps as the Coin Lean Lab stamps: a ragged disc, one of six outlines
 * drawn as the tray is made, turned at random, once on the press and then
 * along each segment of the stroke as many times as keep the stamps at most
 * 0.22 of the brush's radius apart. Each outline is the lab's, point for
 * point: 91 points round the disc, each drawn in from the radius by smooth
 * waves and a little noise. A stamp writes into the mask each texel's
 * distance from its outline, as the texel faces it from the stamp's centre:
 * the distance to the line of the outline's edge that the ray from the
 * centre crosses, exact on the outline and close to it, so the cut follows
 * the lab's outline and the reveal's shader softens it as the lab's blur
 * does (see `revealShader.ts`). No Skia here, so it runs under node as it
 * does on the UI thread.
 */

/**
 * How the lab turns its stamps: along the stroke for 'scraped', at random
 * for the others. A preset's own slider values apply only as it is chosen
 * in the lab, so the name carries nothing else. The lab's 'brush' stamps a
 * picture loaded into it, which the game has none of.
 */
export type FingerPreset = 'plain' | 'ragged' | 'spec' | 'scraped';

/**
 * The finger's brush, every number the studio may set, building the game
 * from a checkout: a plain object, keyed as the Coin Lean Lab names its
 * settings, so its Copy settings' `scratch` block applies to it as it is.
 * The worklets here take it as an argument rather than from their closure,
 * where a phone would keep the copy it took the first time the worklet ran.
 *
 * The rest of the lab's block is not read here: the cut's softness, shadow,
 * lip and depth are the reveal shader's (`REVEAL`); `sGrain`'s faint streaks
 * are partial erasures, which a mask of one distance a texel cannot hold;
 * and `brushImage`, `coating` and `reveals` only change the lab's own
 * picture.
 */
export const FINGER_BRUSH = {
  /** How a stamp is turned: see `FingerPreset`. */
  sPreset: 'ragged' as FingerPreset,
  /**
   * The stamp's nominal radius, board points, its ragged outline drawn in
   * from it, and the radius the lab throws and sweeps flakes by: see
   * `fingerFlakeRadius`. At 20.5 and `sRough` 0.85, a straight stroke
   * clears about 31 points for certain, 34.5 at least half the way along,
   * and its fringe out to 39.
   */
  brush: 20.5,
  /**
   * How far the outline's waves take it in from the nominal radius: its
   * points lie 1 - 0.22 x `sRough` x (1 + wobble) of the radius out, 0.64
   * to 0.99 of it at 0.85. At 0 a circle, 0.97 of the radius, as the lab
   * draws its round brush under its soft edge.
   */
  sRough: 0.85,
};

export type FingerBrush = typeof FINGER_BRUSH;

/** The outlines a tray's brush draws, as the lab draws six. */
export const FINGER_VARIANTS = 6;

/** The points round each outline, the first and the last both at angle 0, as the lab's 90 steps give 91. */
export const FINGER_POINTS = 91;

/** The edges a ray from the centre can cross: one from each point to the next. */
const EDGES = FINGER_POINTS - 1;

/** The outline's waves: how many times each goes round the disc. */
const WAVES = [3, 5, 7, 11, 17] as const;

/**
 * Buckets of the ray's direction, by its diamond angle, each pointing at
 * the first edge it can fall on: fine enough that no bucket holds two of
 * the outline's corners, which lie 4 degrees apart.
 */
const BUCKETS = 256;

/**
 * What the finger's brush keeps on a tray: made with the tray's store and
 * kept across its cards, as the lab keeps its six outlines until its
 * settings change. Every array is the state's own, made on the thread that
 * stamps with it.
 */
export type FingerState = {
  /** The random numbers' state as each card comes, the outlines drawn: see `resetFingerState`. */
  start: number;
  /**
   * The random numbers' state: mulberry32, as the flakes keep theirs, so a
   * run repeats under test. A stamp draws two, its outline and its turn, in
   * the lab's order, or one when stamps turn along the stroke.
   */
  random: number;
  /** The stroke's last direction, radians, which a 'scraped' stamp turns to: the lab's `strokeAngle`. */
  turn: number;
  /**
   * Each outline's points as drawn, `1 + wobble`, `FINGER_POINTS` an
   * outline: the point lies 1 - 0.22 x rough x this of the radius out.
   */
  wobble: Float64Array;
  /** The roughness `edges` and `reach` were laid out for; NaN before the first stamp. */
  rough: number;
  /**
   * Each outline's edges at a radius of 1, `EDGES` an outline and three
   * numbers an edge: its outward normal across and down, and the distance
   * of its line from the centre along it.
   */
  edges: Float64Array;
  /** How far each outline reaches from its centre, at a radius of 1. */
  reach: Float64Array;
  /** Each point's direction from the centre, across and down, two numbers a point. */
  directions: Float64Array;
  /**
   * Each point's direction from the centre as a diamond angle, 0 up to 4,
   * and past the last an infinity, which no ray reaches.
   */
  corners: Float64Array;
  /** For each bucket of diamond angles, the first edge a ray in it can cross. */
  buckets: Uint8Array;
};

/**
 * The state's next random number, 0 up to 1: mulberry32, as the lab's
 * traces draw theirs.
 */
function fingerRandom(state: FingerState): number {
  'worklet';
  state.random = (state.random + 0x6d2b79f5) >>> 0;
  let t = state.random;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A number from `least` up to `most`, as the lab's `rnd`. */
function between(state: FingerState, least: number, most: number): number {
  'worklet';
  return least + fingerRandom(state) * (most - least);
}

/**
 * The direction of (`x`, `y`) as a diamond angle: 0 along x, 1 along y, 2
 * and 3 the other ways round, rising with the angle as it does, up to 4. It
 * orders directions as their angles do, with no trigonometry.
 */
export function diamondAngle(x: number, y: number): number {
  'worklet';
  if (y >= 0) return x >= 0 ? y / (x + y) : 1 - x / (y - x);
  return x < 0 ? 2 - y / (-x - y) : 3 + x / (x - y);
}

/** Point `i`'s angle round an outline, radians, worked out as the lab works it out. */
function pointAngle(i: number): number {
  'worklet';
  return (i / EDGES) * Math.PI * 2;
}

/**
 * The brush's state on a tray, its six outlines drawn from `seed` as the
 * lab draws its six, each in its order: the five waves' phase and size,
 * then each point's noise. Then the stamps' numbers, which each card starts
 * again from.
 */
export function makeFingerState(seed: number): FingerState {
  'worklet';
  const state: FingerState = {
    start: 0,
    random: seed >>> 0,
    turn: 0,
    wobble: new Float64Array(FINGER_VARIANTS * FINGER_POINTS),
    rough: NaN,
    edges: new Float64Array(FINGER_VARIANTS * EDGES * 3),
    reach: new Float64Array(FINGER_VARIANTS),
    directions: new Float64Array(FINGER_POINTS * 2),
    corners: new Float64Array(FINGER_POINTS),
    buckets: new Uint8Array(BUCKETS + 1),
  };
  const phase = [0, 0, 0, 0, 0];
  const size = [0, 0, 0, 0, 0];
  for (let v = 0; v < FINGER_VARIANTS; v++) {
    for (let w = 0; w < WAVES.length; w++) {
      phase[w] = between(state, 0, Math.PI * 2);
      size[w] = between(state, 0.4, 1) / Math.sqrt(WAVES[w]!);
    }
    for (let i = 0; i < FINGER_POINTS; i++) {
      const t = pointAngle(i);
      let wob = 0;
      for (let w = 0; w < WAVES.length; w++) {
        wob += size[w]! * Math.sin(WAVES[w]! * t + phase[w]!);
      }
      wob = wob * 0.5 + between(state, -0.12, 0.12);
      state.wobble[v * FINGER_POINTS + i] = 1 + wob;
    }
  }
  state.start = state.random;
  for (let i = 0; i < FINGER_POINTS; i++) {
    const t = pointAngle(i);
    const x = Math.cos(t);
    const y = Math.sin(t);
    state.directions[2 * i] = x;
    state.directions[2 * i + 1] = y;
    state.corners[i] = i < EDGES ? diamondAngle(x, y) : Infinity;
  }
  let edge = 0;
  for (let b = 0; b <= BUCKETS; b++) {
    const from = (b * 4) / BUCKETS;
    while (edge < EDGES - 1 && state.corners[edge + 1]! <= from) edge++;
    state.buckets[b] = edge;
  }
  return state;
}

/**
 * The state as a new card comes, in place: the stamps' numbers from where
 * every card starts them, and no stroke's direction, so every card is
 * stamped alike; the outlines stay.
 */
export function resetFingerState(state: FingerState): void {
  'worklet';
  state.random = state.start;
  state.turn = 0;
}

/**
 * The outlines' edges for a roughness of `rough`, laid out once for each
 * roughness the brush stamps with: each point `1 - 0.22 x rough x wobble`
 * of the radius out at its angle, or at no roughness 0.97 of it, as the
 * lab's round brush, and each edge from a point to the next.
 */
export function fingerOutlines(state: FingerState, rough: number): void {
  'worklet';
  if (state.rough === rough) return;
  state.rough = rough;
  const k = 0.22 * rough;
  for (let v = 0; v < FINGER_VARIANTS; v++) {
    let reach = 0;
    let x0 = 0;
    let y0 = 0;
    for (let i = 0; i < FINGER_POINTS; i++) {
      // Kept out of the centre, which no roughness the lab offers reaches.
      const r =
        rough > 0
          ? Math.max(0.01, 1 - k * state.wobble[v * FINGER_POINTS + i]!)
          : 0.97;
      if (r > reach) reach = r;
      const x1 = r * state.directions[2 * i]!;
      const y1 = r * state.directions[2 * i + 1]!;
      if (i > 0) {
        const dx = x1 - x0;
        const dy = y1 - y0;
        const length = Math.sqrt(dx * dx + dy * dy);
        const nx = dy / length;
        const ny = -dx / length;
        const at = (v * EDGES + i - 1) * 3;
        state.edges[at] = nx;
        state.edges[at + 1] = ny;
        state.edges[at + 2] = nx * x0 + ny * y0;
      }
      x0 = x1;
      y0 = y1;
    }
    state.reach[v] = reach;
  }
}

/**
 * One stamp of outline `variant`, `radius` board points nominal, its centre
 * at (`x`, `y`) and turned `cos`, `sin` of its angle, into `mask` in place,
 * as the lab draws its brush there: each texel within reach takes the
 * smaller of its code and the stamp's, the cells' and the zones' counts
 * taking every texel it scratched for the first time. The outlines must be
 * laid out for the brush's roughness (`fingerOutlines`). Returns how many
 * texels' codes it lowered.
 */
export function stampOutline(
  mask: Mask,
  x: number,
  y: number,
  radius: number,
  state: FingerState,
  variant: number,
  cos: number,
  sin: number,
): number {
  'worklet';
  if (!(radius > 0)) return 0;
  const { width, height, codes } = mask;
  const edges = state.edges;
  const corners = state.corners;
  const buckets = state.buckets;
  const reach = radius * state.reach[variant]! + MASK_REACH;
  const reach2 = reach * reach;
  const j0 = Math.max(0, Math.floor(y - reach - 0.5));
  const j1 = Math.min(height - 1, Math.ceil(y + reach - 0.5));
  const scale = 127.5 / MASK_REACH;
  const perBucket = BUCKETS / 4;
  const first = variant * EDGES;
  const furthest = radius * state.reach[variant]!;
  let lowered = 0;
  for (let j = j0; j <= j1; j++) {
    const oy = j + 0.5 - y;
    const across = reach2 - oy * oy;
    if (across < 0) continue;
    const half = Math.sqrt(across);
    const i0 = Math.max(0, Math.ceil(x - half - 0.5));
    const i1 = Math.min(width - 1, Math.floor(x + half - 0.5));
    const row = j * width;
    const ay = Math.abs(oy);
    // The texel's offset from the centre, turned into the outline's own
    // frame, as the lab's canvas turns the brush onto the card.
    let ox = i0 + 0.5 - x;
    let u = ox * cos + oy * sin;
    let v = oy * cos - ox * sin;
    for (let i = i0; i <= i1; i++, ox += 1, u += cos, v -= sin) {
      const t = row + i;
      const old = codes[t]!;
      if (old === 0) continue;
      // The outline lies within its furthest point of the centre, so no
      // texel is nearer it than its own distance from the centre, at least
      // the octagon's round its two offsets, less that: where the texel is
      // already as near the scratch, the stamp lowers nothing.
      const ax = ox < 0 ? -ox : ox;
      const most = ax > ay ? ax : ay;
      const slant = (ax + ay) * Math.SQRT1_2;
      const least = (slant > most ? slant : most) - furthest;
      if (least >= MASK_REACH || old <= 127.5 + least * scale) continue;
      // The edge the ray from the centre through the texel crosses, by its
      // diamond angle (see `diamondAngle`, written out here: a call a texel
      // costs the UI thread more than the sum), and the distance to its
      // line, held to that least.
      let angle: number;
      if (v >= 0) angle = u >= 0 ? v / (u + v) : 1 - u / (v - u);
      else angle = u < 0 ? 2 - v / (-u - v) : 3 + u / (u - v);
      let edge = buckets[(angle * perBucket) | 0]!;
      if (angle >= corners[edge + 1]!) edge++;
      const at = (first + edge) * 3;
      let d = u * edges[at]! + v * edges[at + 1]! - radius * edges[at + 2]!;
      if (d < least) d = least;
      if (d >= MASK_REACH) continue;
      const raw = 127.5 + d * scale;
      const code = raw <= 0 ? 0 : (raw + 0.5) | 0;
      if (code >= old) continue;
      lowerTexel(mask, t, code);
      lowered++;
    }
  }
  return lowered;
}

/**
 * One stamp of `brush` at (`x`, `y`): an outline at random and, but for
 * 'scraped', which turns along the stroke, a turn at random, drawn in the
 * lab's order.
 */
function stampAt(
  mask: Mask,
  x: number,
  y: number,
  brush: FingerBrush,
  state: FingerState,
): number {
  'worklet';
  const variant = (fingerRandom(state) * FINGER_VARIANTS) | 0;
  const turn =
    brush.sPreset === 'scraped' ? state.turn : between(state, 0, Math.PI * 2);
  return stampOutline(
    mask,
    x,
    y,
    brush.brush,
    state,
    variant,
    Math.cos(turn),
    Math.sin(turn),
  );
}

/**
 * Stamps `brush` dragged from (`x0`, `y0`) to (`x1`, `y1`), a press where
 * the two ends are one point, into `mask` in place, as the lab's
 * `scratchTo` stamps a pointer's sample: a press once where it lands, a
 * move `ceil(length / gap)` times, evenly spaced, the last at its end, the
 * gap 0.22 of the radius and at least 0.4 points. The cells' and the
 * zones' counts take every texel it scratched for the first time. Returns
 * how many texels' codes it lowered, so a frame knows whether to upload the
 * mask again.
 */
export function stampFinger(
  mask: Mask,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  brush: FingerBrush,
  state: FingerState,
): number {
  'worklet';
  fingerOutlines(state, brush.sRough);
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (dx === 0 && dy === 0) return stampAt(mask, x1, y1, brush, state);
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length > 0.01) state.turn = Math.atan2(dy, dx);
  const gap = Math.max(0.4, brush.brush * 0.22);
  const n = Math.max(1, Math.ceil(length / gap));
  let lowered = 0;
  for (let i = 1; i <= n; i++) {
    lowered += stampAt(
      mask,
      x0 + (dx * i) / n,
      y0 + (dy * i) / n,
      brush,
      state,
    );
  }
  return lowered;
}

/**
 * The brush radius the finger's flakes are thrown and swept by, board
 * points, as `strokeFlakes` takes it: the stamp's nominal radius, as the
 * lab's are.
 */
export function fingerFlakeRadius(brush: FingerBrush): number {
  'worklet';
  return brush.brush;
}
