/**
 * A winning symbol's pop and its light, as the owner set them in the
 * Symbol Light Lab (13 Nov 2026) over the reference clip Scratcher3.mp4,
 * which was measured a frame at a time at its 30 fps.
 *
 * At its match a winning symbol pops: it dips to 91 %, grows to 121 %,
 * holds, comes back with a small bounce to 95.5 % and rests at its own
 * size 1.6 s in, on the clip's curve. Its light is a copy of the symbol
 * added onto itself, in its own colours: half of it comes in over 0.33 s
 * from the match and stays while the tile glows, and each pop adds up to
 * the other half on the clip's own light envelope, so the symbol is lit
 * in full at a pop's peak. Once the whole card is revealed every winning
 * symbol pops again, together. `useSymbolPops` keeps each symbol's clocks;
 * the cells draw from them (see `CardCells`).
 *
 * Every function here is a worklet, read on the UI thread a frame at a
 * time, and takes everything it needs as an argument or from this module's
 * constants: none has a parameter default.
 */

/** A curve's keyframes: `[seconds, value]`, in time order. */
export type PopKeys = readonly (readonly [number, number])[];

/** The clip's pop: the symbol's scale, seconds from its match. */
export const POP: PopKeys = [
  [0, 1],
  [0.1, 0.94],
  [0.17, 0.925],
  [0.23, 0.91],
  [0.27, 0.92],
  [0.3, 1],
  [0.33, 1.07],
  [0.37, 1.12],
  [0.4, 1.15],
  [0.47, 1.185],
  [0.53, 1.2],
  [0.63, 1.21],
  [0.73, 1.205],
  [0.83, 1.2],
  [0.9, 1.18],
  [1, 1.15],
  [1.1, 1.09],
  [1.2, 1.02],
  [1.23, 1],
  [1.3, 0.96],
  [1.37, 0.955],
  [1.47, 0.97],
  [1.53, 0.985],
  [1.6, 1],
];

/** The clip's light on the symbol during its pop, 0 to 1, seconds from its match. */
export const POP_LIGHT: PopKeys = [
  [0, 0],
  [0.13, 0.05],
  [0.2, 0.35],
  [0.27, 0.8],
  [0.33, 1],
  [0.87, 1],
  [1, 0.85],
  [1.1, 0.6],
  [1.23, 0.3],
  [1.33, 0.12],
  [1.4, 0],
];

/**
 * The clip's own numbers, which `popScale` stretches to the owner's: its
 * length, its peak, its first dip and where that dip ends, and its bounce.
 */
const CLIP = {
  lengthS: 1.6,
  peakOver: 0.21,
  dipUnder: 0.09,
  dipEndsS: 0.3,
  bounceUnder: 0.045,
  lightEndsS: 1.4,
} as const;

/** The owner's light, as locked in the lab. */
export const SYMBOL_LIGHT = {
  /** Of the symbol's own colours, added while its tile glows. */
  stays: 0.5,
  /** Of the symbol's own colours, added at a pop's peak on `POP_LIGHT`. */
  extraDuringPop: 0.5,
  /** How long the light that stays takes to come in from the match, s (smoothstep). */
  comesInS: 0.33,
} as const;

/**
 * The owner's pop, as locked in the lab: the clip's own curve. A pop still
 * running as the card's pop at its full reveal begins hands over to it in
 * `handoverS`, the new pop's first dip, so the symbol never jumps.
 */
export const SYMBOL_POP = {
  growsTo: 1.21,
  dipsTo: 0.91,
  bounceTo: 0.955,
  lengthS: 1.6,
  handoverS: 0.3,
} as const;

/** `x` clamped to 0..1 and eased in and out: 3x^2 - 2x^3. */
export function smoothstep(x: number): number {
  'worklet';
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

/**
 * `keys` at `t`: a Catmull-Rom spline through every keyframe, held at the
 * first before it and at the last after it, as the lab draws it.
 */
export function popCurve(keys: PopKeys, t: number): number {
  'worklet';
  if (t <= keys[0]![0]) return keys[0]![1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i]![0]) {
      const a = keys[i - 1]!;
      const b = keys[i]!;
      const u = (t - a[0]) / (b[0] - a[0]);
      const p0 = keys[Math.max(0, i - 2)]![1];
      const p3 = keys[Math.min(keys.length - 1, i + 1)]![1];
      const u2 = u * u;
      const u3 = u2 * u;
      return (
        0.5 *
        (2 * a[1] +
          (-p0 + b[1]) * u +
          (2 * p0 - 5 * a[1] + 4 * b[1] - p3) * u2 +
          (-p0 + 3 * a[1] - 3 * b[1] + p3) * u3)
      );
    }
  }
  return keys[keys.length - 1]![1];
}

/**
 * A symbol's scale `tau` seconds into a pop: the clip's curve stretched to
 * the owner's length, peak, dip and bounce (which are the clip's own), 1
 * before the pop and after it.
 */
export function popScale(tau: number): number {
  'worklet';
  if (tau < 0) return 1;
  const tv = (tau * CLIP.lengthS) / SYMBOL_POP.lengthS;
  if (tv >= CLIP.lengthS) return 1;
  const v = popCurve(POP, tv);
  if (v >= 1) return 1 + ((v - 1) * (SYMBOL_POP.growsTo - 1)) / CLIP.peakOver;
  if (tv < CLIP.dipEndsS) {
    return 1 - ((1 - v) * (1 - SYMBOL_POP.dipsTo)) / CLIP.dipUnder;
  }
  return 1 - ((1 - v) * (1 - SYMBOL_POP.bounceTo)) / CLIP.bounceUnder;
}

/** The clip's light on the symbol `tau` seconds into a pop, 0 to 1: none before it and after it. */
export function popLight(tau: number): number {
  'worklet';
  if (tau < 0) return 0;
  const tv = (tau * CLIP.lengthS) / SYMBOL_POP.lengthS;
  return tv >= CLIP.lightEndsS ? 0 : Math.max(0, popCurve(POP_LIGHT, tv));
}

/**
 * A winning symbol's scale: its pop at its match, `since` seconds ago, until
 * the card's pop at its full reveal, `again` seconds ago (negative before
 * it), takes over. A first pop still running then (`handover` 1) eases into
 * the new one over its first dip, so every symbol pops together from then
 * without a jump; one already over gives way at once, as in the lab.
 */
export function symbolPopScale(
  since: number,
  again: number,
  handover: number,
): number {
  'worklet';
  if (again < 0) return popScale(since);
  const next = popScale(again);
  if (handover <= 0) return next;
  const w = 1 - smoothstep(again / SYMBOL_POP.handoverS);
  return w * popScale(since) + (1 - w) * next;
}

/**
 * How much of a winning symbol's own colours its light adds, 0 to 1: the
 * light that stays, come in over `comesInS` from its match `since` seconds
 * ago, and with `popping` 1 the light of whichever of its pops is brighter
 * (`again` as for `symbolPopScale`), the whole times `on`, which follows the
 * card's win glows in and out.
 */
export function symbolLightLevel(
  since: number,
  again: number,
  on: number,
  popping: number,
): number {
  'worklet';
  const stays = SYMBOL_LIGHT.stays * smoothstep(since / SYMBOL_LIGHT.comesInS);
  const extra =
    popping > 0
      ? SYMBOL_LIGHT.extraDuringPop * Math.max(popLight(since), popLight(again))
      : 0;
  return on * (stays + extra);
}
