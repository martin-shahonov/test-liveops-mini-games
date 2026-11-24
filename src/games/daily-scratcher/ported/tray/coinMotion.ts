/**
 * The coin in the hand, as the designer animated it (SPEC-scratch-animation
 * section 4) and the Coin Lean Lab turns it: pressed in as the finger goes
 * down, leaning into the stroke on a damped spring, trembling as it scrapes
 * fast, and lifted and faded as the finger comes up, with its contact
 * shadow on the card; the lean turns it through its sheet's frames and
 * tilts it about the point of its rim on the card. Plain numbers a worklet
 * keeps on the UI thread; what it hands the canvas is a `CoinFrame`.
 * Nothing here touches Skia, so it runs under node as it does on the UI
 * thread.
 *
 * Her numbers are px at 3 a point and frames at 60 a second: px a frame
 * times 20 is points a second. The press and the lift are timed on the
 * frames' own clock; the finger's speed and the spring are taken in her
 * 1/60 s steps on the tray's clock whatever the display's rate, as the Coin
 * Lean Lab takes them, the lean between two steps read in between them, so
 * a 120 Hz screen shows the same motion, only smoother.
 */

import type { PoseCanvas } from './coinSheet';

/**
 * The coin sprite as the motion reads it, in board points: drawn `width` x
 * `height`, the finger under its rim, the point that touches the card,
 * (`anchorX`, `anchorY`) from its top-left corner.
 */
export type CoinArt = {
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
};

/** A skin's coin in the hand, its `size` and `anchor` in board points, as the motion reads it. */
export function coinArtOf(coin: {
  size: readonly [number, number];
  anchor: readonly [number, number];
}): CoinArt {
  return {
    width: coin.size[0],
    height: coin.size[1],
    anchorX: coin.anchor[0],
    anchorY: coin.anchor[1],
  };
}

const FRAME_MS = 1000 / 60;

/**
 * How the coin moves, the lab's modes: 'turn' turns it through its sheet's
 * frames as it leans, 'tilt' tilts its resting frame about the rim, 'both'
 * does the two, and 'warp' shears and narrows the designer's tilted coin
 * instead, as the game did before the sheet (the lab's "Now: warp", which
 * its Copy settings write as 'now': see `coinModeOf`).
 */
export type CoinMode = 'warp' | 'turn' | 'both' | 'tilt';

/**
 * The mode `COIN_MOTION.mode` names, as the scratcher reads it: one of the
 * four as it is, the lab's 'now' as the 'warp' it is, so the lab's Copy
 * settings apply as they are, and anything else as the lab's default,
 * 'both', as the lab loads a value it cannot read.
 */
export function coinModeOf(mode: unknown): CoinMode {
  if (mode === 'now') return 'warp';
  return mode === 'warp' || mode === 'turn' || mode === 'tilt' ? mode : 'both';
}

/**
 * Which way a stroke turns the coin through its frames, from its resting
 * turn: 'rightUp' a stroke to the right up the frames' angles and one to
 * the left down them, 'rightDown' the other way about, 'bothUp' up and
 * 'bothDown' down whichever way it goes. The tilt follows the lean
 * whatever this says.
 */
export type CoinDirection = 'rightUp' | 'rightDown' | 'bothUp' | 'bothDown';

/**
 * The coin's motion, every number the studio may tune, building the game
 * from a checkout: a plain object, keyed as the Coin Lean Lab names its
 * settings, so its Copy settings' `motion` block applies to it as it is.
 * The lab's keys hold Rossen's saved settings (5 Nov 2026) but `preview`;
 * `restTilt` and `coinH`, which take the resting pose he set in the studio
 * that evening; and `dir`, so that from that pose the coin turns the way
 * the finger goes. The rest the designer's. Nothing reads it from a
 * worklet's closure: the tray hands the worklets its values as arguments
 * (see `Tune`), so a value set from outside reaches the UI thread.
 */
export const COIN_MOTION = {
  /** How it moves: see `CoinMode`, and `coinModeOf` for the lab's 'now'. Read as the scratcher opens. */
  mode: 'both' as CoinMode,
  /**
   * Which way a stroke turns it: see `CoinDirection`. On this coin, which
   * rests turned with its face to the left and its rim on the right, a
   * stroke to the right turns it back down its frames' angles, as far as
   * face-on, and one to the left turns it further, the rim coming round on
   * the right: it turns the way the finger goes. Rossen's saved settings
   * have 'rightUp', with the coin resting face-on, where a stroke turns it
   * one way only.
   */
  dir: 'rightDown' as CoinDirection,
  /** Two neighbouring frames drawn blended between them, or the nearer alone. */
  blend: true,
  /**
   * The coin shown at rest on YOUR SYMBOLS, in its resting pose, while the
   * card can be scratched and no finger is on either tray, as the lab shows
   * it while nothing scratches. Off: the coin shows only in a finger,
   * coming with the press as it lands and lifting and fading as it comes
   * up, never on the card before the first stroke or between strokes.
   * Rossen's settings have it on, which only keeps the lab's idle preview.
   * Read as the scratcher opens.
   */
  preview: false,
  /** Where it rests: shares of YOUR SYMBOLS' box across and down, the lab's spot. Read as the scratcher opens. */
  restAt: [0.5, 0.72] as readonly number[],
  /**
   * Its tilt at rest, degrees, its top leaning right above 0: the stroke's
   * tilt adds to it. Rossen's studio pose; his saved settings have 7.
   */
  restTilt: 22.5,
  /** Degrees it turns for each degree it leans: 41.25 at the most lean, 42.25 with the tremor. */
  turn: 1.25,
  /** How far a lean tilts it about the rim: atan(`tilt` x tan(lean)), 31.1 degrees at the most lean, 31.9 with the tremor. */
  tilt: 0.93,
  /**
   * The face-on coin's height, points: Rossen's studio pose; his saved
   * settings have 85. Read as the scratcher opens.
   */
  coinH: 75,
  /** A blend weight below this, or above 1 less it, draws the nearer frame alone, as the lab does. */
  blendEdge: 0.001,
  /** One of her frames, ms. */
  frameMs: FRAME_MS,
  /** The press-in, her frames 0 to 3: the scale about the rim, and the lift as a share of `rise`. */
  pressScale: [1.06, 1.015, 0.97, 1] as readonly number[],
  pressLift: [0.4, 0.4 * (2 / 3), 0.4 / 3, 0] as readonly number[],
  /** Her full lift, board points: 30 px. */
  rise: 10,
  /**
   * The lean's most, degrees, and the finger's speed across, board points a
   * second, that reads as most of it: the lean pulls towards `leanMax` x
   * tanh(vx / `leanSpeed`). The designer's were 20 and 416 (20.8 px a frame).
   */
  leanMax: 33,
  leanSpeed: 400,
  /** How a lean shears the designer's coin about its rim in 'warp', and how much narrower it draws a degree. */
  shearPerTan: 0.55,
  squashPerDegree: 1 / 200,
  /**
   * The lean's spring, stepped every 1/60 s: stiffness `k` a second squared
   * and damping ratio `zeta`. At 240 and 0.9 it shows no overshoot and
   * covers 90 % of a step in 233 ms; the designer's 300 and 0.6 overshot
   * once, by 6 %, and took 133 ms.
   */
  k: 240,
  zeta: 0.9,
  /**
   * How long the finger's sideways speed is smoothed over, ms: one 120 Hz
   * frame, so a touch screen's samples jitter less there while at 60 Hz the
   * lean reads her per-frame speed with barely a lag (30 ms put it a frame
   * behind her video's).
   */
  vxWindowMs: 1000 / 120,
  /**
   * The scrape's tremor: her up to 0.8 degrees either way, from white noise
   * smoothed by a Gaussian of 2.2 frames, felt from 6.7 px a frame and at
   * full from 16.7 (134 and 334 points a second). Read as a peak: the
   * smoothed noise at unit deviation is scaled so 0.8 is 2.5 deviations, and
   * held to it. The smoothing's sigma and taps are read as a tray is laid
   * out, the rest at every step.
   */
  tremorPeak: 0.8,
  tremorPeakDeviations: 2.5,
  tremorSigmaFrames: 2.2,
  tremorTaps: 13,
  tremorFrom: 134,
  tremorFull: 334,
  /** The release: her frames +0 to +5 lift it, +6 to +8 shrink and fade it. */
  liftFrames: 6,
  fadeFrames: 3,
  liftScale: 1.08,
  fadeScale: 0.85,
};

/** The coin's motion numbers, as `COIN_MOTION` holds them. */
export type CoinMotion = typeof COIN_MOTION;

/**
 * How the turning coin sits in its sheet, the Coin Lean Lab's `coin`
 * settings: its number of frames and the canvas each is cut from, px, as
 * a pair or as the lab writes it, `'275x275'`; the point of its rim on the
 * card, on the axis it turns about, px of that canvas; the face-on coin's
 * height, px, which `coinH` points draw; each frame's turn from face-on,
 * degrees, `null` leaving a frame out; and the frame it rests on.
 *
 * The coin's: the Coin Lean Lab's built-in coin, the sheet delivered on 3
 * Nov 2026 (13 frames of a 500 x 500 canvas), its pose the lab's, set by
 * hand from its frames: 12 face-on, 11 down to 3 turning with the rim
 * coming round on the right and the face to the left, 2 edge-on, 1 and 0
 * its back, 7 the same picture as 8, the turns estimated from the outlines
 * to about 5 degrees. It rests on frame 6, turned 40 degrees with its face
 * to the left, as Rossen rests it in the studio (5 Nov): the coin he sent
 * since, `coinScratch`, turns only the other way, its face to the right,
 * until he renders it turning left. Its sheet is the delivered one
 * repacked at 0.55 scale (275 x 275 frames, 195 px face-on, more than the
 * hand draws), so the pose is the 500 x 500 one times 0.55: the rim on the
 * card at (250, 427) px of every frame, the face-on ink 354 px tall.
 * Rossen's saved `coin` block is this pose before the repack but for the
 * frame it rests on, his saved face-on 12. A pose for the same shape of
 * canvas at another size, as the lab's Copy settings from before the
 * repack, is scaled to the sheet (see `poseScale`). A sheet with other
 * frames needs a pose of its own, set with it; one that does not fit is
 * drawn resting on its widest frame, or not at all when its frames are
 * untrimmed (see `safePose`). Read as the scratcher opens.
 */
export const COIN_POSE = {
  frames: 13,
  canvas: [275, 275] as PoseCanvas,
  contactPoint: [137.5, 234.85] as readonly number[],
  faceHeightPx: 194.7,
  angles: [115, 100, 90, 80, 65, 55, 40, null, 30, 23, 12, 5, 0] as readonly (
    | number
    | null
  )[],
  restFrame: 6,
};

/**
 * The contact shadow, the designer's: an ellipse on the card under the
 * coin, its size keyed to a coin `width` points wide at a `coinH` of 85, so
 * it keeps her size whatever canvas the frames are cut from, W = `width` x
 * `coinH` / 85. Its centre lies `offset` plus `offsetPerWidth` x W from the
 * contact point, its radii `radiusPerWidth` x W, turned `angle` degrees,
 * blurred by `sigma` points and black at `alpha`; on the lift it grows
 * `liftGrow` times, falls to `liftAlpha` and blurs to `liftSigma`. It
 * ignores the tilt and the turn, as the lab's does. Its size and place are
 * read as the scratcher opens, the rest at every frame.
 */
export const COIN_SHADOW = {
  width: 81.667,
  offset: [10 / 3, 13 / 3] as readonly number[],
  offsetPerWidth: [0.18, -0.05] as readonly number[],
  radiusPerWidth: [0.3, 0.09] as readonly number[],
  angle: -12,
  sigma: 1.1,
  alpha: 0.6,
  liftGrow: 1.4,
  liftAlpha: 0.3,
  liftSigma: 13 / 3,
};

/** The shadow's numbers, as `COIN_SHADOW` holds them. */
export type CoinShadow = typeof COIN_SHADOW;

/** The parts of the coin's tuning its worklets read: see `Tune` in `tuning.ts`. */
export type CoinTune = { coin: CoinMotion; shadow: CoinShadow };

/** How long the coin takes to lift and fade away once let go, ms: her frames +0 to +8. */
export function coinAwayMs(motion: CoinMotion): number {
  return (motion.liftFrames + motion.fadeFrames) * motion.frameMs;
}

/**
 * Where the contact shadow lies for a coin `coinH` points tall face-on: its
 * centre from the contact point and its radii, points, its turn, radians.
 * See `COIN_SHADOW`; at its numbers and a `coinH` of 85, her shadow,
 * centred (18.03, 0.25) pt from the finger, 24.5 by 7.35 pt.
 */
export function shadowPlace(
  shadow: CoinShadow,
  coinH: number,
): { dx: number; dy: number; rx: number; ry: number; angle: number } {
  'worklet';
  const w = (shadow.width * coinH) / 85;
  return {
    dx: shadow.offset[0]! + shadow.offsetPerWidth[0]! * w,
    dy: shadow.offset[1]! + shadow.offsetPerWidth[1]! * w,
    rx: shadow.radiusPerWidth[0]! * w,
    ry: shadow.radiusPerWidth[1]! * w,
    angle: (shadow.angle * Math.PI) / 180,
  };
}

/** What the canvas draws the coin by, a frame at a time. */
export type CoinFrame = {
  /** The rim's place under the finger, the tray's board points. */
  x: number;
  y: number;
  /** 0 draws nothing. */
  alpha: number;
  /** About the rim. */
  scale: number;
  /** Points the coin is lifted off the card. */
  rise: number;
  /** Its tilt about the rim, radians, clockwise. */
  rotation: number;
  /**
   * The sheet's frames it is drawn from: `frameA` at its alpha and `frameB`
   * over it at its alpha times `mix`, as the lab blends two; -1 for none,
   * as in 'warp', which draws the designer's coin.
   */
  frameA: number;
  frameB: number;
  mix: number;
  /** In 'warp': x moves by this much for every point up from the rim, the lean. */
  shear: number;
  /** In 'warp': how much narrower the lean draws it. */
  squash: number;
  shadowScale: number;
  shadowAlpha: number;
  shadowSigma: number;
  /** 1 for the coin at rest, which the hand hides while another tray's coin is in a finger. */
  rest: number;
  /**
   * 1 for no coin but a finger still on the tray, its coin let go of as a
   * stroke finished the box or the card was restored under it: the hand
   * keeps another tray's coin at rest away until it lifts.
   */
  held: number;
};

export const COIN_AWAY: CoinFrame = {
  x: 0,
  y: 0,
  alpha: 0,
  scale: 1,
  rise: 0,
  rotation: 0,
  frameA: -1,
  frameB: -1,
  mix: 0,
  shear: 0,
  squash: 1,
  shadowScale: 1,
  shadowAlpha: 0,
  shadowSigma: 1.1,
  rest: 0,
  held: 0,
};

/** No coin, a finger still on the tray: see `CoinFrame.held`. */
export const COIN_HELD: CoinFrame = { ...COIN_AWAY, held: 1 };

/**
 * Whether two frames draw the coin alike: within a two-hundredth of a
 * point, and of the scales a ten-thousandth, under a hundredth of a point
 * at the coin's height. A finger resting on the card leaves its coin's
 * spring settling by ever less, so every frame comes out a hair from the
 * last; those need not be drawn again.
 */
export function sameCoinFrame(a: CoinFrame, b: CoinFrame): boolean {
  'worklet';
  const near = (u: number, v: number, by: number) => Math.abs(u - v) < by;
  return (
    a === b ||
    (near(a.x, b.x, 0.005) &&
      near(a.y, b.y, 0.005) &&
      near(a.rise, b.rise, 0.005) &&
      near(a.alpha, b.alpha, 1e-3) &&
      near(a.scale, b.scale, 1e-4) &&
      near(a.rotation, b.rotation, 1e-4) &&
      a.frameA === b.frameA &&
      a.frameB === b.frameB &&
      near(a.mix, b.mix, 1e-3) &&
      near(a.shear, b.shear, 1e-4) &&
      near(a.squash, b.squash, 1e-4) &&
      near(a.shadowScale, b.shadowScale, 1e-4) &&
      near(a.shadowAlpha, b.shadowAlpha, 1e-3) &&
      near(a.shadowSigma, b.shadowSigma, 1e-3) &&
      a.rest === b.rest &&
      a.held === b.held)
  );
}

/** 0 nothing, 1 pressed to the card, 2 lifting away. */
export const COIN_OFF = 0;
export const COIN_DOWN = 1;
export const COIN_LIFTING = 2;

export type Coin = {
  phase: number;
  /** When the press began, and the lift. */
  downAt: number;
  liftAt: number;
  x: number;
  y: number;
  /** Where it was at the last step, for its speeds. */
  lastX: number;
  lastY: number;
  /** Its sideways speed, points a second, smoothed. */
  vx: number;
  /**
   * Its speed whichever way it goes, points a second, smoothed as `vx` is:
   * what the coin sweeps the lying flakes by (`sweepFlakes`).
   */
  speed: number;
  /** The lean, degrees, and its rate, at the last whole step and the one before. */
  lean: number;
  leanRate: number;
  leanBefore: number;
  /** The tremor at the last whole step and the one before, degrees. */
  tremor: number;
  tremorBefore: number;
  /** The tremor's white noise, a ring of `tremorTaps`, and where it writes next. */
  noise: number[];
  head: number;
  seed: number;
};

/** A coin put away, its tremor's ring as long as `motion` has it. */
export function makeCoin(seed: number, motion: CoinMotion): Coin {
  'worklet';
  const noise: number[] = [];
  for (let i = 0; i < motion.tremorTaps; i++) noise.push(0);
  return {
    phase: COIN_OFF,
    downAt: -1,
    liftAt: -1,
    x: 0,
    y: 0,
    lastX: 0,
    lastY: 0,
    vx: 0,
    speed: 0,
    lean: 0,
    leanRate: 0,
    leanBefore: 0,
    tremor: 0,
    tremorBefore: 0,
    noise,
    head: 0,
    seed: seed >>> 0,
  };
}

/** The coin put away at once, as a restored card wants it. */
export function coinAway(coin: Coin): void {
  'worklet';
  coin.phase = COIN_OFF;
  coin.downAt = -1;
  coin.liftAt = -1;
  coin.vx = 0;
  coin.speed = 0;
  coin.lean = 0;
  coin.leanRate = 0;
  coin.leanBefore = 0;
  coin.tremor = 0;
  coin.tremorBefore = 0;
  for (let i = 0; i < coin.noise.length; i++) coin.noise[i] = 0;
}

/**
 * The coin pressed to the card at (`x`, `y`) at `now`: upright, its press-in
 * from her frame 0. A touch during a lift presses it in again.
 */
export function coinDown(coin: Coin, now: number, x: number, y: number): void {
  'worklet';
  coinAway(coin);
  coin.phase = COIN_DOWN;
  coin.downAt = now;
  coin.x = x;
  coin.y = y;
  coin.lastX = x;
  coin.lastY = y;
}

/** The finger, and the coin's rim with it, at (`x`, `y`). */
export function coinMoved(coin: Coin, x: number, y: number): void {
  'worklet';
  coin.x = x;
  coin.y = y;
}

/** The finger up at `now`: the coin lifts and fades from her frame +0. */
export function coinLifted(coin: Coin, now: number): void {
  'worklet';
  if (coin.phase !== COIN_DOWN) return;
  coin.phase = COIN_LIFTING;
  coin.liftAt = now;
}

/**
 * The coin under a finger that goes on from one tray onto another without
 * lifting: all `to` draws from, carried over from `from`, its place moved
 * by (`dx`, `dy`), the one tray's board points to the other's, and `from`
 * put away. Nothing is pressed or lifted: the same phase, press time, lean
 * and tremor, so the hand draws one coin going on.
 */
export function coinHandedOver(
  from: Coin,
  to: Coin,
  dx: number,
  dy: number,
): void {
  'worklet';
  to.phase = from.phase;
  to.downAt = from.downAt;
  to.liftAt = from.liftAt;
  to.x = from.x + dx;
  to.y = from.y + dy;
  to.lastX = from.lastX + dx;
  to.lastY = from.lastY + dy;
  to.vx = from.vx;
  to.speed = from.speed;
  to.lean = from.lean;
  to.leanRate = from.leanRate;
  to.leanBefore = from.leanBefore;
  to.tremor = from.tremor;
  to.tremorBefore = from.tremorBefore;
  const n = Math.min(from.noise.length, to.noise.length);
  for (let i = 0; i < to.noise.length; i++) {
    to.noise[i] = i < n ? from.noise[i]! : 0;
  }
  to.head = to.noise.length > 0 ? from.head % to.noise.length : 0;
  to.seed = from.seed;
  coinAway(from);
}

/**
 * The frame the hand last drew a finger's coin by, `shown`, as the tray the
 * finger goes on onto draws it: the same coin, pressed, leant and turned
 * as it was, in the same place, its rim moved by (`dx`, `dy`), the one
 * tray's board points to the other's. Null where `shown` draws no coin in
 * a finger, so there is none to carry over.
 */
export function frameHandedOver(
  shown: CoinFrame,
  dx: number,
  dy: number,
): CoinFrame | null {
  'worklet';
  if (!(shown.alpha > 0) || shown.rest === 1) return null;
  return { ...shown, x: shown.x + dx, y: shown.y + dy };
}

/** Her press-in at `frames` into it, from the keyframes on frames 0 to 3. */
function keyframe(values: readonly number[], frames: number): number {
  'worklet';
  if (frames <= 0) return values[0]!;
  const last = values.length - 1;
  if (frames >= last) return values[last]!;
  const i = Math.floor(frames);
  const f = frames - i;
  return values[i]! + (values[i + 1]! - values[i]!) * f;
}

/** The lean the finger's sideways speed `vx`, points a second, pulls towards: degrees. */
export function leanTarget(vx: number, motion: CoinMotion): number {
  'worklet';
  return motion.leanMax * Math.tanh(vx / motion.leanSpeed);
}

/** How much of the tremor a finger at `speed` points a second gets, 0 to 1. */
export function tremorShare(speed: number, motion: CoinMotion): number {
  'worklet';
  const share =
    (speed - motion.tremorFrom) / (motion.tremorFull - motion.tremorFrom);
  return share <= 0 ? 0 : share >= 1 ? 1 : share;
}

/** The weights of the tremor's smoothing, newest first, scaled so unit white noise smooths to unit deviation. */
export function tremorWeights(motion: CoinMotion): number[] {
  'worklet';
  const taps = motion.tremorTaps;
  const middle = (taps - 1) / 2;
  const sigma = motion.tremorSigmaFrames;
  const weights: number[] = [];
  let squares = 0;
  for (let i = 0; i < taps; i++) {
    const w = Math.exp(-((i - middle) * (i - middle)) / (2 * sigma * sigma));
    weights.push(w);
    squares += w * w;
  }
  const norm = 1 / Math.sqrt(squares);
  for (let i = 0; i < taps; i++) weights[i] = weights[i]! * norm;
  return weights;
}

/** The coin's own random numbers, 0 up to 1: a run repeats under test. */
function nextRandom(coin: Coin): number {
  'worklet';
  coin.seed = (coin.seed + 0x6d2b79f5) >>> 0;
  let t = coin.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * One of her 1/60 s steps, as the Coin Lean Lab takes it: the finger's
 * sideways speed from where the coin was a step ago, and its speed
 * whichever way, both smoothed over `vxWindowMs` and none once the finger
 * is up; the spring towards the lean
 * that speed wants; and the tremor at `speed`. A frame that takes two steps
 * gives the first all its move and the second none, as the lab's does.
 */
export function coinStep(
  coin: Coin,
  motion: CoinMotion,
  weights: readonly number[],
  speed: number,
): void {
  'worklet';
  const h = motion.frameMs / 1000;
  const smoothing = 1 - Math.exp(-motion.frameMs / motion.vxWindowMs);
  const instant = (coin.x - coin.lastX) / h;
  coin.vx += (instant - coin.vx) * smoothing;
  const moved = Math.hypot(coin.x - coin.lastX, coin.y - coin.lastY) / h;
  coin.speed += (moved - coin.speed) * smoothing;
  if (coin.phase !== COIN_DOWN) {
    coin.vx = 0;
    coin.speed = 0;
  }
  coin.lastX = coin.x;
  coin.lastY = coin.y;
  const k = motion.k;
  const c = 2 * motion.zeta * Math.sqrt(k);
  coin.leanBefore = coin.lean;
  coin.tremorBefore = coin.tremor;
  // Semi-implicit Euler: the rate first, the lean from the new rate.
  const pull =
    -k * (coin.lean - leanTarget(coin.vx, motion)) - c * coin.leanRate;
  coin.leanRate += pull * h;
  coin.lean += coin.leanRate * h;
  // A unit normal by Box and Muller, into the ring, smoothed.
  const u = Math.max(nextRandom(coin), 1e-12);
  const v = nextRandom(coin);
  coin.noise[coin.head] =
    Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  coin.head = (coin.head + 1) % coin.noise.length;
  let smooth = 0;
  for (let i = 0; i < weights.length; i++) {
    const at = (coin.head - 1 - i + 2 * coin.noise.length) % coin.noise.length;
    smooth += weights[i]! * coin.noise[at]!;
  }
  const peak = motion.tremorPeak;
  let tremor = (smooth * peak) / motion.tremorPeakDeviations;
  if (tremor > peak) tremor = peak;
  else if (tremor < -peak) tremor = -peak;
  coin.tremor = tremor * tremorShare(speed, motion);
}

const smoothstep = (t: number) => {
  'worklet';
  const u = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return u * u * (3 - 2 * u);
};

/**
 * The lean the coin shows `share` of a step past its last, degrees: read
 * between its last two steps, the tremor with it.
 */
export function leanShown(coin: Coin, share: number): number {
  'worklet';
  return (
    coin.leanBefore +
    (coin.lean - coin.leanBefore) * share +
    coin.tremorBefore +
    (coin.tremor - coin.tremorBefore) * share
  );
}

/**
 * The frames a coin may turn through, as the lab's `turnTable` makes them
 * from a pose's `angles`: [degrees, frame] pairs, flat, the frames with an
 * angle sorted by it, then by frame, keeping only angles above the last
 * kept, so of two frames at one angle the lower wins. The built-in coin's
 * runs 0, 5, 12, 23, 30, 40, 55, 65, 80, 90, 100 and 115 degrees on frames
 * 12, 11, 10, 9, 8, 6, 5, 4, 3, 2, 1 and 0.
 */
export function turnTableOf(angles: readonly (number | null)[]): number[] {
  const used: { deg: number; frame: number }[] = [];
  angles.forEach((deg, frame) => {
    if (deg !== null && Number.isFinite(deg)) used.push({ deg, frame });
  });
  used.sort((a, b) => a.deg - b.deg || a.frame - b.frame);
  const table: number[] = [];
  for (const { deg, frame } of used) {
    if (table.length === 0 || deg > table[table.length - 2]!) {
      table.push(deg, frame);
    }
  }
  return table;
}

/** What a tray moves its coin by, read as the scratcher opens: see `coinOpenOf`. */
export type CoinPlan = {
  mode: CoinMode;
  /** The frames it turns through: see `turnTableOf`. Under two of them, it does not turn. */
  turns: readonly number[];
  /** The frame it rests on, and that frame's turn, degrees, or 0 for one left out. */
  restFrame: number;
  restDeg: number;
  /** The designer's coin, for 'warp'. */
  art: CoinArt;
  /** Whether this tray shows the coin at rest, YOUR SYMBOLS alone, and where: see `COIN_MOTION.preview`. */
  rests: boolean;
  restAt: readonly number[];
};

/**
 * The turn the coin shows at `lean` degrees, as the lab's `turnFor` works
 * it out: its resting turn moved by the lean times `turn`, that way or
 * another as `dir` says, held to the table's first and last angles.
 */
export function turnFor(
  lean: number,
  plan: CoinPlan,
  motion: CoinMotion,
): number {
  'worklet';
  let by = lean * motion.turn;
  if (motion.dir === 'rightDown') by = -by;
  else if (motion.dir === 'bothUp') by = Math.abs(by);
  else if (motion.dir === 'bothDown') by = -Math.abs(by);
  const turns = plan.turns;
  const first = turns[0]!;
  const last = turns[turns.length - 2]!;
  return Math.max(first, Math.min(last, plan.restDeg + by));
}

/**
 * The two frames of `turns` either side of `deg`, and how far it is from
 * the first to the second, 0 to 1, as the lab's `framesFor` picks them:
 * [a, b, t]. Past the last angle, the last frame twice.
 */
export function framesFor(
  deg: number,
  turns: readonly number[],
): [number, number, number] {
  'worklet';
  const n = turns.length / 2;
  for (let i = 0; i < n - 1; i++) {
    const from = turns[2 * i]!;
    const to = turns[2 * i + 2]!;
    if (deg <= to) {
      return [
        turns[2 * i + 1]!,
        turns[2 * i + 3]!,
        Math.max(0, (deg - from) / (to - from)),
      ];
    }
  }
  const last = turns[2 * n - 1]!;
  return [last, last, 0];
}

/**
 * How the coin is posed at `lean` degrees, as the lab draws it: the frames
 * it turns to and how far between them, and its tilt about the rim; or in
 * 'warp' the shear and narrowing of the designer's coin.
 */
export function poseAt(
  lean: number,
  plan: CoinPlan,
  motion: CoinMotion,
): Pick<
  CoinFrame,
  'rotation' | 'frameA' | 'frameB' | 'mix' | 'shear' | 'squash'
> {
  'worklet';
  const radians = (lean * Math.PI) / 180;
  if (plan.mode === 'warp') {
    return {
      rotation: 0,
      frameA: -1,
      frameB: -1,
      mix: 0,
      shear: Math.tan(radians) * motion.shearPerTan,
      squash: 1 - Math.abs(lean) * motion.squashPerDegree,
    };
  }
  const tilts = plan.mode === 'both' || plan.mode === 'tilt';
  const turns =
    (plan.mode === 'turn' || plan.mode === 'both') && plan.turns.length >= 4;
  const rotation =
    (motion.restTilt * Math.PI) / 180 +
    (tilts ? Math.atan(motion.tilt * Math.tan(radians)) : 0);
  let frameA = plan.restFrame;
  let frameB = -1;
  let mix = 0;
  if (turns) {
    const [a, b, t] = framesFor(turnFor(lean, plan, motion), plan.turns);
    const edge = motion.blendEdge;
    if (motion.blend && a !== b && t > edge && t < 1 - edge) {
      frameA = a;
      frameB = b;
      mix = t;
    } else {
      frameA = t < 0.5 ? a : b;
    }
  }
  return { rotation, frameA, frameB, mix, shear: 0, squash: 1 };
}

/**
 * The frame the canvas draws the coin by at `now`, `share` of a 1/60 s step
 * past the tray's last (see `coinStep`): its press-in, or its lift and
 * fade, on the frames' own clock, its shadow with it, and its lean read
 * between its last two steps; then, as the lab draws it, the frames it
 * turns to and how far between them, and its tilt about the rim, or in
 * 'warp' the shear and narrowing of the designer's coin. The fade's end
 * puts it away.
 */
export function coinFrameAt(
  coin: Coin,
  now: number,
  share: number,
  tune: CoinTune,
  plan: CoinPlan,
): CoinFrame {
  'worklet';
  if (coin.phase === COIN_OFF) return COIN_AWAY;
  const motion = tune.coin;
  const shadow = tune.shadow;
  const step = motion.frameMs;
  const lean = leanShown(coin, share);
  let scale = 1;
  let rise = 0;
  let alpha = 1;
  let shadowScale = 1;
  let shadowAlpha = shadow.alpha;
  let shadowSigma = shadow.sigma;
  // A hair over, so a frame that lands on one of her frames reads it.
  if (coin.phase === COIN_DOWN) {
    const frames = (now - coin.downAt) / step + 1e-6;
    scale = keyframe(motion.pressScale, frames);
    rise = keyframe(motion.pressLift, frames) * motion.rise;
  } else {
    const frames = (now - coin.liftAt) / step + 1e-6;
    const lift = smoothstep(frames / motion.liftFrames);
    const fadeAt = (frames - motion.liftFrames) / motion.fadeFrames;
    const fade = fadeAt <= 0 ? 0 : fadeAt >= 1 ? 1 : fadeAt;
    if (fade >= 1) {
      coin.phase = COIN_OFF;
      return COIN_AWAY;
    }
    scale =
      fade > 0
        ? motion.liftScale + (motion.fadeScale - motion.liftScale) * fade
        : 1 + (motion.liftScale - 1) * lift;
    rise = motion.rise * lift;
    alpha = 1 - fade;
    shadowScale = 1 + (shadow.liftGrow - 1) * lift;
    shadowAlpha =
      (shadow.alpha + (shadow.liftAlpha - shadow.alpha) * lift) * (1 - fade);
    shadowSigma = shadow.sigma + (shadow.liftSigma - shadow.sigma) * lift;
  }
  return {
    x: coin.x,
    y: coin.y,
    alpha,
    scale,
    rise,
    ...poseAt(lean, plan, motion),
    shadowScale,
    shadowAlpha,
    shadowSigma,
    rest: 0,
    held: 0,
  };
}

/**
 * The coin at rest on a tray `width` x `height` points, as the lab shows it
 * between strokes: in its resting pose, unleant and unlifted, at `restAt`
 * of the tray's box, its shadow under it.
 */
export function restingFrame(
  plan: CoinPlan,
  tune: CoinTune,
  width: number,
  height: number,
): CoinFrame {
  'worklet';
  return {
    x: plan.restAt[0]! * width,
    y: plan.restAt[1]! * height,
    alpha: 1,
    scale: 1,
    rise: 0,
    ...poseAt(0, plan, tune.coin),
    shadowScale: 1,
    shadowAlpha: tune.shadow.alpha,
    shadowSigma: tune.shadow.sigma,
    rest: 1,
    held: 0,
  };
}

/**
 * How opaque the hand draws a tray's coin from its `frame`, with the other
 * trays' `others`: as the frame says, but the coin at rest not while
 * another's is in a finger or lifting away, so two coins never show at
 * once, nor while a finger is still on another tray, as the lab rests its
 * coin only while nothing scratches.
 */
export function drawnAlpha(
  frame: CoinFrame,
  others: readonly CoinFrame[],
): number {
  'worklet';
  if (frame.rest !== 1) return frame.alpha;
  for (let i = 0; i < others.length; i++) {
    const other = others[i]!;
    if ((other.alpha > 0 && other.rest !== 1) || other.held === 1) return 0;
  }
  return frame.alpha;
}

/** Whether the coin still wants frames: pressed, or lifting away. */
export function coinBusy(coin: Coin): boolean {
  'worklet';
  return coin.phase !== COIN_OFF;
}

/** How far past the contact point the coin and its shadow can reach, board points, each way. */
export type CoinReach = {
  left: number;
  right: number;
  up: number;
  down: number;
};

/**
 * The coin's tuning as the scratcher opens, copied, for what it sizes, picks
 * or lays out once: the plan each tray moves its coin by, and what the
 * hand's canvas is sized and its shadow placed from. A value changed after
 * this shows at the next open: see `COIN_MOTION`.
 */
export type CoinOpen = {
  /** WINNING SYMBOLS' plan, and YOUR SYMBOLS', which shows the coin at rest when `preview` is on. */
  plan: CoinPlan;
  resting: CoinPlan;
  motion: CoinMotion;
  shadow: CoinShadow;
  pose: typeof COIN_POSE;
};

/** `value` again, every array in it a copy of its own. */
const copyOf = <T extends Record<string, unknown>>(value: T): T => {
  const copy: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    copy[key] = Array.isArray(item) ? [...(item as unknown[])] : item;
  }
  return copy as T;
};

/**
 * What the scratcher reads of the coin's tuning as it opens, for the
 * designer's coin `art`: `COIN_MOTION`'s mode (see `coinModeOf`),
 * `COIN_POSE`'s turns and resting frame, and a copy of the three for the
 * hand.
 */
export function coinOpenOf(art: CoinArt): CoinOpen {
  const pose = copyOf(COIN_POSE);
  const rest = pose.angles[pose.restFrame];
  const plan: CoinPlan = {
    mode: coinModeOf(COIN_MOTION.mode),
    turns: turnTableOf(pose.angles),
    restFrame: pose.restFrame,
    restDeg: typeof rest === 'number' && Number.isFinite(rest) ? rest : 0,
    art,
    rests: false,
    restAt: [...COIN_MOTION.restAt],
  };
  return {
    plan,
    resting: { ...plan, rests: COIN_MOTION.preview },
    motion: copyOf(COIN_MOTION),
    shadow: copyOf(COIN_SHADOW),
    pose,
  };
}

/** How far the shadow reaches past the contact point, grown, blurred and turned as on the lift: right and down. */
function shadowReach(
  shadow: CoinShadow,
  coinH: number,
): { right: number; down: number } {
  const place = shadowPlace(shadow, coinH);
  const blur = 3 * shadow.liftSigma;
  const spreadX = place.rx * shadow.liftGrow;
  const spreadY = Math.sqrt(
    (spreadX * Math.sin(place.angle)) ** 2 +
      (place.ry * shadow.liftGrow * Math.cos(place.angle)) ** 2,
  );
  return {
    right: place.dx + spreadX + blur,
    down: place.dy + spreadY + blur,
  };
}

/**
 * The most a stroke can lean the coin, degrees, held to `most`: as far as
 * its spring, stepped as `coinStep` steps it, can carry a lean that asks at
 * most `leanMax` either way, past it as it overshoots and further as a
 * scrape to and fro swings it, and the tremor on top. That is `leanMax`
 * times the whole swing of the spring after a lean asked for one step, the
 * sum of how far it leans at each step after: at the lab's default `k`
 * 300, 1.13 at its `zeta` 0.6, 1.60 at 0.4 and 3.16 at 0.2; 1.00, no
 * swing past the lean, at Rossen's 240 and 0.9. A spring damped too little
 * to settle reaches `most`.
 */
export function leanAtMost(motion: CoinMotion, most: number): number {
  const h = motion.frameMs / 1000;
  const k = motion.k;
  const c = 2 * motion.zeta * Math.sqrt(k);
  let lean = 0;
  let rate = 0;
  let swing = 0;
  for (let step = 0; step < 1e5; step++) {
    rate += (-k * (lean - (step === 0 ? 1 : 0)) - c * rate) * h;
    lean += rate * h;
    swing += Math.abs(lean);
    const at = motion.leanMax * swing + motion.tremorPeak;
    if (!(at < most)) return most;
    if (Math.abs(lean) + Math.abs(rate) < 1e-12) return at;
  }
  return most;
}

/**
 * The most the designer's coin leans in 'warp', degrees: as it was sized
 * before the sheet, the spring's overshoot at her damping of 0.6, 15 %,
 * and the tremor on top. Its shear has no bound as the lean nears 90
 * degrees, so no canvas holds a spring swinging it that far.
 */
const warpLeanAtMost = (motion: CoinMotion) =>
  motion.leanMax * 1.15 + motion.tremorPeak;

/** The most the coin is scaled about the rim: pressed in or lifted. */
const scaleAtMost = (motion: CoinMotion) =>
  Math.max(motion.liftScale, ...motion.pressScale);

/**
 * How far past the rim the designer's coin and its shadow can reach in
 * 'warp', board points, at its most: lifted, scaled up, sheared its
 * furthest, the shadow grown and blurred.
 */
export function warpReach(
  art: CoinArt,
  motion: CoinMotion,
  shadow: CoinShadow,
): CoinReach {
  const scale = scaleAtMost(motion);
  const shear =
    Math.tan((warpLeanAtMost(motion) * Math.PI) / 180) * motion.shearPerTan;
  const sway = shear * art.anchorY * scale;
  const cast = shadowReach(shadow, motion.coinH);
  return {
    left: art.anchorX * scale + sway,
    right: Math.max((art.width - art.anchorX) * scale + sway, cast.right),
    up: art.anchorY * scale + motion.rise,
    down: Math.max((art.height - art.anchorY) * scale, cast.down),
  };
}

/**
 * How far a point (`dx`, `dy`) reaches each way turned through every angle
 * from `from` to `to` radians: [left, right, up, down], the extremes at
 * either end or where it crosses an axis between them.
 */
function sweptExtent(
  dx: number,
  dy: number,
  from: number,
  to: number,
): [number, number, number, number] {
  const r = Math.hypot(dx, dy);
  const phi = Math.atan2(dy, dx);
  const angles = [from, to];
  // x = r cos(a + phi) is at its extremes at a + phi = k pi, y at k pi + pi / 2.
  for (const at of [0, Math.PI / 2]) {
    for (
      let a = at - phi + Math.ceil((from + phi - at) / Math.PI) * Math.PI;
      a <= to;
      a += Math.PI
    ) {
      angles.push(a);
    }
  }
  let left = Infinity;
  let right = -Infinity;
  let up = Infinity;
  let down = -Infinity;
  for (const a of angles) {
    const x = r * Math.cos(a + phi);
    const y = r * Math.sin(a + phi);
    left = Math.min(left, x);
    right = Math.max(right, x);
    up = Math.min(up, y);
    down = Math.max(down, y);
  }
  return [left, right, up, down];
}

/**
 * How far past the contact point the turning coin and its shadow can reach,
 * board points, at its most: every frame's ink, `ink`, px of the canvas,
 * left, top, right and bottom, about the pose's contact point, at its
 * height scaled up as it is pressed or lifted, tilted through every angle
 * its resting tilt and the most a lean tilts it give (see `leanAtMost`;
 * however far a spring swings, a tilt stays within 90 degrees), and
 * lifted; the shadow grown and blurred. The ink rather than the whole
 * canvas, which keeps the canvas the hand draws on small.
 */
export function sheetReach(
  ink: readonly [number, number, number, number],
  pose: { contactPoint: readonly number[]; faceHeightPx: number },
  mode: CoinMode,
  motion: CoinMotion,
  shadow: CoinShadow,
): CoinReach {
  const scale = (scaleAtMost(motion) * motion.coinH) / pose.faceHeightPx;
  const tilts = mode === 'both' || mode === 'tilt';
  const lean = leanAtMost(motion, 90);
  const most = tilts
    ? Math.abs(Math.atan(motion.tilt * Math.tan((lean * Math.PI) / 180)))
    : 0;
  const rest = (motion.restTilt * Math.PI) / 180;
  const [px, py] = pose.contactPoint as [number, number];
  let left = 0;
  let right = 0;
  let up = 0;
  let down = 0;
  for (const x of [ink[0], ink[2]]) {
    for (const y of [ink[1], ink[3]]) {
      const [l, r, u, d] = sweptExtent(
        (x - px) * scale,
        (y - py) * scale,
        rest - most,
        rest + most,
      );
      left = Math.max(left, -l);
      right = Math.max(right, r);
      up = Math.max(up, -u);
      down = Math.max(down, d);
    }
  }
  const cast = shadowReach(shadow, motion.coinH);
  return {
    left,
    right: Math.max(right, cast.right),
    up: up + motion.rise,
    down: Math.max(down, cast.down),
  };
}
