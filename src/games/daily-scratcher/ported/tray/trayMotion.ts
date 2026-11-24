/** Reanimated's `runOnJS`: the web's UI thread is its JS thread. */
const runOnJS = <F>(f: F): F => f;
/** Reanimated's shared value, as the ported worklets read and write it. */
type SharedValue<T> = { value: T };
import type { RevealRule } from '../rules/reveal';
import { BRUSH_RADIUS } from './brush';
import {
  COIN_AWAY,
  COIN_DOWN,
  COIN_HELD,
  coinAway,
  coinBusy,
  coinDown,
  coinFrameAt,
  coinHandedOver,
  coinLifted,
  frameHandedOver,
  coinMoved,
  coinStep,
  makeCoin,
  restingFrame,
  sameCoinFrame,
  tremorWeights,
  type Coin,
  type CoinFrame,
  type CoinPlan,
} from './coinMotion';
import {
  boxDoneAt,
  boxReadAt,
  cellReadAt,
  revealedAt,
  type CellBox,
  type CellZones,
} from './coverage';
import { BAND_OFF, diagonalOf, type Diagonal } from './diagonal';
import {
  cutOf,
  insideRounded,
  type RoundedBox,
  type ScratchField,
} from './field';
import {
  fingerFlakeRadius,
  makeFingerState,
  resetFingerState,
  stampFinger,
  type FingerBrush,
  type FingerState,
} from './fingerBrush';
import {
  SCRATCHED_BELOW,
  clearMask,
  codeAt,
  makeMask,
  maskShares,
  maskSharesAfterPress,
  maskZoneShares,
  rezoneMask,
  stampMask,
  type Mask,
} from './mask';
import {
  clearFlakes,
  flakesBusy,
  makeFlakes,
  packFlakes,
  stepFlakes,
  strokeFlakes,
  type ColourGrid,
  type FlakePlan,
  type FlakePool,
  type FlakeTuning,
} from './flakes';
import {
  QUICK_PATH,
  pathBows,
  pathLiftMs,
  pathPoint,
  pathSteps,
  pathStrokeMs,
} from './quickPath';
import {
  sweepCoin,
  sweepFront,
  sweepOrder,
  sweepProgress,
  sweepTokenRestore,
  type SweepStep,
} from './quickSweep';
import type { Tune } from './tuning';

/**
 * The tray on the UI thread: what the gesture's callbacks write as the
 * finger goes down, moves and lifts, and the frame loop that reads it,
 * stamps the mask, throws and steps the flakes, moves the coin in the hand,
 * runs the fades and Quick Scratch, and tells the JS thread what it needs
 * to hear, a frame at a time. The gesture that feeds it lives in
 * `useScratch`, the canvases that draw its values in `ScratchTray` and
 * `ScratchHand`; nothing here touches either, so it all runs under node as
 * it does on the UI thread.
 *
 * Everything is in the tray's own board points, from its top-left corner:
 * the canvas scales them once, so a change of fit moves nothing here.
 */

export const TRAY_TIMING = {
  /**
   * A cell's remaining coating, once Quick Scratch's path has revealed it:
   * eased out, quadratic. Nothing fades a cell under a finger.
   */
  revealFadeMs: 200,
  /** The rest of a box's coating, once the box is done. */
  boxFadeMs: 300,
  /** The coating coming back over a restored card. */
  restoreMs: 300,
  /**
   * How long a box read as far as its plan's idle shares ask waits
   * untouched before it clears the rest of its coating: a beat, so a player
   * who stopped just short of a digit's last edge is not left waiting on
   * it. Its dwell's beat too: met, the box clears this long after, the
   * finger on it or not.
   */
  idleCleanMs: 1000,
} as const;

/**
 * The scratch ticks: one every `points` the finger travels, the designer's
 * 20 to 24, and never two closer than `minGapMs`, so at most about 30 a
 * second. The gap is a little under 1000 / 30 so that every second frame
 * at 60 Hz, and every fourth at 120, clears it through the frames' jitter.
 */
export const SCRATCH_TICK = { points: 22, minGapMs: 30 } as const;

/**
 * The window the finger's speed is smoothed over, ms: the scratch sound
 * follows it, and a frame's worth of moves landing unevenly would make the
 * sound flutter.
 */
export const SPEED_WINDOW_MS = 60;

/** How often the JS thread hears the speed while the finger moves, ms. */
export const SPEED_REPORT_MS = 50;

/** How fast the finger goes, board points a second, to count as moving. */
export const MOVING_SPEED = 15;

/** Below this, with the finger up, the smoothed speed reads 0 and the loop may rest. */
export const STILL_SPEED = 1;

/**
 * The longest step the flakes and the coin take in one frame, ms: after a
 * stall they move on by a frame's worth rather than leaping; everything
 * timed, the fades and Quick Scratch, keeps to the clock.
 */
export const MAX_STEP_MS = 50;

/** The most of the tray's 1/60 s steps one frame takes, however long it was. */
const MOST_STEPS = 8;

/**
 * How far past the tray's box the coin follows a finger dragged off it,
 * board points: at least the gap between the two trays' boxes (20.424 on
 * the generic board, her 112 px), so a scratching finger's coin reaches
 * the next tray as the finger does.
 */
export const HAND_SLACK = 21;

/**
 * What the UI thread tells the JS thread, with a cell's index where it has
 * one, and a value: 'down' each touch, 1 on coating and 0 on ground already
 * cleared; 'up' each lift with the points the stroke travelled, and the end
 * of a touch the screen stopped before any frame told it, right after its
 * 'down'; 'enter' as a finger already scratching comes onto the tray from
 * another mid-stroke, its index the tray it left: no touch felt or heard,
 * and none of a lift on the tray it left; 'haptic' each scratch tick with
 * the finger's speed; 'warm' once the warm-up is over and the card drawn as
 * it was given.
 */
export type TrayReport =
  | 'stroke'
  | 'cell'
  | 'box'
  | 'haptic'
  | 'speed'
  | 'down'
  | 'up'
  | 'enter'
  | 'warm';
export type Tell = (report: TrayReport, index: number, value: number) => void;

/** The frame loop's token: which loop owns the frames, and whether one runs. */
export type TrayLoop = { owner: number; running: boolean };

/** What the tray is laid out as: its store is made again for a new one. */
export type TrayPlan = {
  /** Each cell's box in board points from the tray's top-left corner, in grid order. */
  cells: readonly CellBox[];
  /**
   * Where each cell is read, from the same corner, in grid order: see
   * `readingZones` and `cardZones`. A zone with texels is read by them, one
   * without by its box; a cell with none, or a tray given none, by its
   * whole box.
   */
  zones?: readonly CellZones[];
  /** The tray's size, board points: the coating's box, which the mask covers. */
  width: number;
  height: number;
  /** Where the coating clears. */
  field: ScratchField;
  /** Quick Scratch draws the designer's path here rather than the band. */
  path: boolean;
  /** How the coin moves and what it turns through, as the scratcher opened: see `coinOpenOf`. */
  coin: CoinPlan;
  /** The flakes' pool and atlas, as the scratcher opened: see `flakePlanOf`. */
  flakes: FlakePlan;
  /**
   * How the box is read, the rules' `WINNING_REVEAL` or `YOURS_REVEAL`
   * as the card opened: every share the reveal reads, its cap included,
   * taken from here on the UI thread.
   */
  reveal: RevealRule;
};

/**
 * The tray's state on the UI thread, made there and rewritten in place by
 * the gesture's callbacks and the frame loop, which run as separate
 * worklets and so share it here rather than in a closure. Times are the
 * frames' own, from `requestAnimationFrame`; a touch is stamped by the
 * frame that first sees it, so no clock is mixed with another.
 */
export type TrayStore = {
  plan: TrayPlan;
  cut: RoundedBox;
  diagonal: Diagonal;
  mask: Mask;
  /** The flakes, on the tray's clock: see `flakes.ts`. */
  flakes: FlakePool;
  coin: Coin;
  tremor: number[];
  /** What the finger's brush keeps from stroke to stroke: see `fingerBrush.ts`. */
  finger: FingerState;
  /**
   * Milliseconds of the frames' time banked towards the tray's next 1/60 s
   * step, the clock the coin's spring and the flakes are stepped on: one
   * clock for the tray, as the Coin Lean Lab has one, which a touch does
   * not start again.
   */
  banked: number;
  bows: number[];
  /** The cells in the order the band passes them. */
  order: readonly SweepStep[];
  /** Per cell: told to the JS thread as revealed. */
  reported: boolean[];
  /** Per cell: when its coating began to fade, or -1, over how long, and whether eased. */
  fadeFrom: number[];
  fadeMs: number[];
  fadeEased: boolean[];
  /** Per cell: the fade level last written, to write only a change. */
  fadeLevels: number[];
  /** The whole floor's coating, once the box is done: when it began to fade, or -1, and over how long. */
  floorFrom: number;
  floorMs: number;
  boxDone: boolean;
  /**
   * The plan's idle shares met, its area's included, or its cap passed, as
   * the mask was last counted: the box clears once left alone.
   */
  zonesRead: boolean;
  /**
   * The same met by the zones alone: the box clears once left alone with no
   * other box left to scratch, whatever its area.
   */
  zonesReadBare: boolean;
  /**
   * The frame since which the plan's dwell has been met, as the mask is
   * counted, or -1: the box clears `idleCleanMs` after, the finger on it or
   * not.
   */
  dwellFrom: number;
  /** The last frame a finger was on the tray, or -1 for none since the card came. */
  touchedAt: number;
  /** The first stroke has been told: the claim. */
  claimed: boolean;
  /** A finger is on the tray. */
  down: boolean;
  /**
   * A finger is on the tray, scratching or let go of, as a stroke that
   * finished the box or a restored card lets go of one: until it lifts,
   * whatever took the card from it.
   */
  held: boolean;
  /** A touch down no frame has seen yet, and whether it landed on coating. */
  pendingDown: boolean;
  downOnCoating: boolean;
  /** A lift no frame has told yet, and the points its stroke travelled. */
  pendingUp: boolean;
  upTravel: number;
  /** A lift a touch landed before any frame told it: told first on the next, with its stroke's points. */
  liftFirst: boolean;
  liftFirstTravel: number;
  /** A finger let go of between frames, its lift not to be told: the coin lifts on the next. */
  pendingLetGo: boolean;
  /**
   * A finger that came on from another tray mid-stroke, which no frame has
   * told yet, and the tray it came from: see `touchHandedOver`.
   */
  pendingEnter: boolean;
  enterFrom: number;
  /** The mask changed since a frame last read it. */
  dirty: boolean;
  /**
   * What the box was last read by besides its mask, the screen's `waived`
   * and `lastBox`: a change has it read again, its mask as it stands.
   */
  readWaived: readonly boolean[];
  readLast: boolean;
  /** The brush, where it last stamped. */
  lastX: number;
  lastY: number;
  /** Since the last frame: points the brush moved. */
  moved: number;
  /** This stroke's points, and those since the last tick. */
  travel: number;
  tickTravel: number;
  speed: number;
  moving: boolean;
  /** The coin's own speed, smoothed, for its tremor; where it was a frame ago. */
  coinSpeed: number;
  coinLastX: number;
  coinLastY: number;
  /** When a tick was last felt, and the speed last told. */
  feltAt: number;
  spokeAt: number;
  /** Quick Scratch: when it began, or -1; which `quick` token it was; its kind. */
  sweepFrom: number;
  sweepToken: number | null;
  sweepPath: boolean;
  sweepDone: boolean;
  /** The band: the cells told so far in `order`; the coin lifted at its far corner. */
  sweepTold: number;
  bandLifted: boolean;
  /** The path: how far it has drawn, ms, whether its strokes have ended, and whether the coin has lifted. */
  pathAt: number;
  pathEnded: boolean;
  pathLifted: boolean;
  /** Which `restore` token the card is on, and when its coating began to come back, or -1 for intact. */
  restoreToken: number;
  foilFrom: number;
  /** The warm-up's frames drawn so far, or -1 once it is over: see `warmTray`. */
  warmFrames: number;
  /**
   * The mask image the canvas last uploaded, for it to free as it uploads
   * the next: the canvas's own slot, carried over to a store made again.
   */
  maskImage: { dispose(): void } | null;
};

/**
 * The shared values the tray runs on. The first nine the JS thread writes
 * and the UI thread reads; `loop` and `store` are the UI thread's own; the
 * rest the UI thread writes for the canvases, and the screen, to read.
 */
export type TrayShared = {
  /** A finger may scratch now: the screen's `enabled`, as the UI thread reads it. */
  grabbable: SharedValue<boolean>;
  /**
   * No other tray is left to scratch: a box that ends under a finger lets
   * it go. Otherwise the finger keeps its coin over the finished box,
   * scratching nothing, until it reaches the other tray or lifts. The last
   * box clears by its zones alone, whatever its rule's area, under a finger
   * and left alone.
   */
  lastBox: SharedValue<boolean>;
  /**
   * Per cell, in grid order, whether the box no longer waits on its value,
   * as the screen decides from what the player can see (the rules'
   * `valueWaived`): its characters count as read. Empty for none.
   */
  waived: SharedValue<readonly boolean[]>;
  /** Reduce Motion: no flakes, no coin, and Quick Scratch is the band alone. */
  still: SharedValue<boolean>;
  /** A sweep's token, or null: a new token begins one. */
  quick: SharedValue<number | null>;
  /** A card's token: a new one brings the coating back intact. */
  restore: SharedValue<number>;
  /** The open's cover is up over the tray, drawn: the warm-up may run under it. */
  warm: SharedValue<boolean>;
  /** The tuning values, which every worklet here reads from it: see `currentTune`. */
  tune: SharedValue<Tune>;
  /** The coating's colours, one a point, once the JS thread has read them: see `coatingColours`. */
  colours: SharedValue<ColourGrid | null>;
  loop: SharedValue<TrayLoop>;
  store: SharedValue<TrayStore | null>;
  /** Bumped whenever the mask changes: the canvas uploads it again. */
  maskVersion: SharedValue<number>;
  /** Per cell, how far its coating has faded, 0 to 1. */
  fades: SharedValue<readonly number[]>;
  /** How far the whole floor's coating has faded, 0 to 1. */
  floor: SharedValue<number>;
  /** How far the coating is in, 0 to 1: under 1 only as a restored card's comes back. */
  foilIn: SharedValue<number>;
  /** The finger's speed, board points a second, smoothed over `SPEED_WINDOW_MS`. */
  speed: SharedValue<number>;
  /** The finger is down and going `MOVING_SPEED` or faster. */
  moving: SharedValue<boolean>;
  /** The band's centre along the diagonal, or `BAND_OFF` before one. */
  sweep: SharedValue<number>;
  /** The flakes, packed for the hand's canvas whenever they change: see `packFlakes`. */
  flakeFrame: SharedValue<Float32Array>;
  /** The coin in the hand, for the hand's canvas. */
  hand: SharedValue<CoinFrame>;
};

// A worklet takes the functions it calls as it is defined, so each helper is
// declared above the worklets that call it.

/**
 * The speed smoothed over `SPEED_WINDOW_MS`: `previous` moved towards the
 * frame's own reading `instant` by the share of the window the frame's
 * `dtMs` covers, so a reading reaches two thirds of a step in a window and
 * the same step reads the same at 60 and 120 Hz.
 */
export function smoothedSpeed(
  previous: number,
  instant: number,
  dtMs: number,
): number {
  'worklet';
  if (!(dtMs > 0)) return previous;
  const share = 1 - Math.exp(-dtMs / SPEED_WINDOW_MS);
  return previous + (instant - previous) * share;
}

/** How far a fade begun at `from` over `ms` has got by `now`, 0 to 1; 0 for one not begun. */
export function fadeLevel(from: number, ms: number, now: number): number {
  'worklet';
  if (from < 0) return 0;
  if (!(ms > 0)) return 1;
  return Math.min(1, Math.max(0, (now - from) / ms));
}

/** A fade's level eased out, quadratic: quick to start, settling at the end. */
export function easedOut(level: number): number {
  'worklet';
  const back = 1 - level;
  return 1 - back * back;
}

/**
 * Whether a tick is due: `travel` points since the last one, which was felt
 * at `feltAt`, at `now`.
 */
export function tickDue(travel: number, feltAt: number, now: number): boolean {
  'worklet';
  return travel >= SCRATCH_TICK.points && now - feltAt >= SCRATCH_TICK.minGapMs;
}

function filled(count: number, value: number): number[] {
  'worklet';
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(value);
  return out;
}

/** The flakes' numbers on every tray: a run repeats under test. */
const FLAKE_SEED = 0x2545f491;

/** The finger's brush's numbers on every tray, the same way. */
const FINGER_SEED = 0x85ebca6b;

/** The store for a tray laid out as `plan`, the card intact, its coin tuned as `tune` has it. */
export function makeStore(plan: TrayPlan, tune: Tune): TrayStore {
  'worklet';
  const diagonal = diagonalOf(plan.width, plan.height);
  const n = plan.cells.length;
  const flags: boolean[] = [];
  const eased: boolean[] = [];
  for (let i = 0; i < n; i++) {
    flags.push(false);
    eased.push(false);
  }
  return {
    plan,
    cut: cutOf(plan.field),
    diagonal,
    mask: makeMask(plan.width, plan.height, plan.cells, plan.zones),
    flakes: makeFlakes(plan.flakes.slots, FLAKE_SEED),
    coin: makeCoin(0x9e3779b9, tune.coin),
    tremor: tremorWeights(tune.coin),
    finger: makeFingerState(FINGER_SEED),
    banked: 0,
    bows: pathBows(QUICK_PATH.seed),
    order: sweepOrder(plan.cells, diagonal),
    reported: flags,
    fadeFrom: filled(n, -1),
    fadeMs: filled(n, 0),
    fadeEased: eased,
    fadeLevels: filled(n, 0),
    floorFrom: -1,
    floorMs: 0,
    boxDone: false,
    zonesRead: false,
    zonesReadBare: false,
    dwellFrom: -1,
    touchedAt: -1,
    claimed: false,
    down: false,
    held: false,
    pendingDown: false,
    downOnCoating: false,
    pendingUp: false,
    upTravel: 0,
    liftFirst: false,
    liftFirstTravel: 0,
    pendingLetGo: false,
    pendingEnter: false,
    enterFrom: -1,
    dirty: false,
    readWaived: [],
    readLast: true,
    lastX: 0,
    lastY: 0,
    moved: 0,
    travel: 0,
    tickTravel: 0,
    speed: 0,
    moving: false,
    coinSpeed: 0,
    coinLastX: 0,
    coinLastY: 0,
    feltAt: -Infinity,
    spokeAt: -Infinity,
    sweepFrom: -1,
    sweepToken: null,
    sweepPath: false,
    sweepDone: false,
    sweepTold: 0,
    bandLifted: false,
    pathAt: 0,
    pathEnded: false,
    pathLifted: false,
    restoreToken: 0,
    foilFrom: -1,
    warmFrames: 0,
    maskImage: null,
  };
}

/** The card as it was given, in the store and in what the canvases read: nothing scratched, no fades, no coin and no flakes, the coating in. */
function resetTray(s: TrayShared, store: TrayStore): void {
  'worklet';
  const n = store.plan.cells.length;
  clearMask(store.mask);
  clearFlakes(store.flakes);
  coinAway(store.coin);
  resetFingerState(store.finger);
  for (let i = 0; i < n; i++) {
    store.reported[i] = false;
    store.fadeFrom[i] = -1;
    store.fadeMs[i] = 0;
    store.fadeEased[i] = false;
    store.fadeLevels[i] = 0;
  }
  store.floorFrom = -1;
  store.floorMs = 0;
  store.boxDone = false;
  store.zonesRead = false;
  store.zonesReadBare = false;
  store.dwellFrom = -1;
  store.touchedAt = -1;
  store.claimed = false;
  store.down = false;
  store.pendingDown = false;
  store.pendingUp = false;
  store.liftFirst = false;
  store.pendingLetGo = false;
  store.pendingEnter = false;
  store.enterFrom = -1;
  store.dirty = false;
  store.moved = 0;
  store.travel = 0;
  store.tickTravel = 0;
  store.speed = 0;
  store.moving = false;
  store.coinSpeed = 0;
  store.sweepFrom = -1;
  store.sweepPath = false;
  store.sweepDone = false;
  store.sweepTold = 0;
  store.bandLifted = false;
  store.pathAt = 0;
  store.pathEnded = false;
  store.pathLifted = false;
  store.foilFrom = -1;
  s.maskVersion.value = s.maskVersion.value + 1;
  s.fades.value = filled(n, 0);
  s.floor.value = 0;
  s.foilIn.value = 1;
  s.speed.value = 0;
  s.moving.value = false;
  s.sweep.value = BAND_OFF;
  s.flakeFrame.value = new Float32Array(0);
  s.hand.value = COIN_AWAY;
}

/**
 * Makes the tray's store on the UI thread, where it is rewritten, for a
 * tray laid out as `plan`, and starts the canvases' values from a card
 * intact. Run again for a new plan. The restore and the sweep the screen
 * last asked for are taken as done with: a store made while the card is up
 * neither brings the coating back again nor sweeps it again, and is read
 * by the screen's waivers and last box as they stand from its first stroke.
 */
export function initTray(s: TrayShared, plan: TrayPlan): void {
  'worklet';
  const store = makeStore(plan, s.tune.value);
  store.restoreToken = s.restore.value;
  store.sweepToken = s.quick.value;
  store.readWaived = s.waived.value;
  store.readLast = s.lastBox.value;
  store.maskImage = s.store.value?.maskImage ?? null;
  s.store.value = store;
  resetTray(s, store);
}

/**
 * The tray read by `zones` from now on, the card's own, in place: what is
 * scratched stays and is read again on the next frame, so a new card's
 * symbols and values are read where they print without the coating coming
 * back.
 */
export function zoneTray(
  s: TrayShared,
  zones: readonly CellZones[] | undefined,
): void {
  'worklet';
  const store = s.store.value;
  if (store === null || store.plan.zones === zones) return;
  store.plan = { ...store.plan, zones };
  rezoneMask(store.mask, store.plan.cells, zones);
  store.dirty = true;
}

/** Ends every loop, as the tray goes away: a frame already queued reads nothing. */
export function endTray(s: TrayShared): void {
  'worklet';
  s.loop.value = { owner: s.loop.value.owner + 1, running: false };
}

/** The coin's rim at the brush, kept within reach of the tray's box. */
function coinTo(store: TrayStore, x: number, y: number): void {
  'worklet';
  const { width, height } = store.plan;
  const cx = Math.min(width + HAND_SLACK, Math.max(-HAND_SLACK, x));
  const cy = Math.min(height + HAND_SLACK, Math.max(-HAND_SLACK, y));
  coinMoved(store.coin, cx, cy);
}

/**
 * The segment from (`x0`, `y0`) to (`x1`, `y1`) stamped into the tray's
 * mask, a press where the two ends are one point, by `finger`, the
 * finger's brush, or with none by Quick Scratch's path, which keeps the
 * designer's round one: whether it scratched anything new.
 */
function stamped(
  store: TrayStore,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  finger: FingerBrush | null,
): boolean {
  'worklet';
  const lowered =
    finger === null
      ? stampMask(store.mask, x0, y0, x1, y1, BRUSH_RADIUS)
      : stampFinger(store.mask, x0, y0, x1, y1, finger, store.finger);
  return lowered > 0;
}

/**
 * The brush from where it last stamped to (`x`, `y`): stamped, the
 * finger's or, with no `finger`, Quick Scratch's path's, its move added up,
 * and, motion allowing, the segment's flakes thrown from that brush's ring,
 * the coin sweeping what lies in its way first as hard as the finger moved
 * at the last step, as the Coin Lean Lab does for every sample of a stroke
 * after its first. A finger over a finished box glides: its move counts,
 * and nothing is cut or thrown.
 */
function strokeTo(
  s: TrayShared,
  store: TrayStore,
  x: number,
  y: number,
  finger: FingerBrush | null,
): void {
  'worklet';
  const dx = x - store.lastX;
  const dy = y - store.lastY;
  const moved = Math.sqrt(dx * dx + dy * dy);
  if (moved === 0) return;
  const glide = finger !== null && store.boxDone;
  if (!glide && stamped(store, store.lastX, store.lastY, x, y, finger)) {
    store.dirty = true;
  }
  if (!glide && !s.still.value) {
    const plan = store.plan;
    strokeFlakes(
      store.flakes,
      store.lastX,
      store.lastY,
      x,
      y,
      s.tune.value.flakes,
      finger === null ? BRUSH_RADIUS : fingerFlakeRadius(finger),
      plan.width,
      plan.height,
      s.colours.value,
      plan.flakes.cap,
      store.coin.speed,
    );
  }
  store.moved += moved;
  store.lastX = x;
  store.lastY = y;
}

/** A stroke begun at (`x`, `y`): its press stamped, the finger's or, with no `finger`, the path's, its counts from 0. */
function strokeFrom(
  store: TrayStore,
  x: number,
  y: number,
  finger: FingerBrush | null,
): void {
  'worklet';
  store.lastX = x;
  store.lastY = y;
  store.moved = 0;
  store.travel = 0;
  store.tickTravel = 0;
  if (stamped(store, x, y, x, y, finger)) store.dirty = true;
}

/**
 * A finger comes onto the tray, by a touch or from the other tray: it is
 * down and held there. A lift no frame has told yet, of a stroke whose
 * touch one has, is told on the next frame before this finger, so every
 * stroke is heard ending; a touch and its lift both between two frames are
 * taken as one with this.
 */
function fingerArrives(store: TrayStore): void {
  'worklet';
  store.down = true;
  store.held = true;
  if (store.pendingUp && !store.pendingDown) {
    store.liftFirst = true;
    store.liftFirstTravel = store.upTravel;
  }
  store.pendingUp = false;
}

/**
 * The finger down at (`x`, `y`): a stroke begins there and the brush's disc
 * is stamped at once, so a tap that lifts before the next frame still
 * counts. False, and nothing touched, while the screen lets no finger
 * scratch, or once Quick Scratch or the box's end has taken the card.
 */
export function touchDown(s: TrayShared, x: number, y: number): boolean {
  'worklet';
  const store = s.store.value;
  if (
    store === null ||
    !s.grabbable.value ||
    store.sweepFrom >= 0 ||
    store.boxDone
  ) {
    return false;
  }
  // On coating: inside the field's cut, where the brush has not been.
  store.downOnCoating =
    insideRounded(store.cut, x, y, 0) &&
    codeAt(store.mask, x, y) >= SCRATCHED_BELOW;
  fingerArrives(store);
  store.pendingDown = true;
  strokeFrom(store, x, y, s.tune.value.brush);
  coinTo(store, x, y);
  return true;
}

/**
 * The finger moved to (`x`, `y`): the brush stamps the segment from where it
 * last was, and the coin follows. A finger the screen has stopped letting
 * scratch is let go here, and no lift is told for it, unless no frame has
 * told its touch yet: see `stepTray`.
 */
export function touchMoved(s: TrayShared, x: number, y: number): void {
  'worklet';
  const store = s.store.value;
  if (store === null || !store.down) return;
  if (!s.grabbable.value) {
    store.down = false;
    store.pendingLetGo = true;
    return;
  }
  const before = store.moved;
  strokeTo(s, store, x, y, s.tune.value.brush);
  store.travel += store.moved - before;
  // A finger gliding over a finished box ticks no more.
  if (!store.boxDone) store.tickTravel += store.moved - before;
  coinTo(store, x, y);
}

/**
 * The finger lifted, or the gesture cancelled: the next frame tells the
 * lift. A finger let go of before it lifted is off the tray now too, but
 * has no lift to tell.
 */
export function touchLifted(s: TrayShared): void {
  'worklet';
  const store = s.store.value;
  if (store === null) return;
  store.held = false;
  if (!store.down) return;
  store.down = false;
  store.pendingUp = true;
  store.upTravel = store.travel;
}

/**
 * Whether a finger coming onto the tray from elsewhere may scratch it: the
 * screen lets fingers scratch, no Quick Scratch has taken it and no other
 * finger is on it. A finished box takes one still, to glide over.
 */
export function takesFinger(s: TrayShared): boolean {
  'worklet';
  const store = s.store.value;
  return (
    store !== null && s.grabbable.value && store.sweepFrom < 0 && !store.held
  );
}

/** Whether a touch landing on the tray may scratch it: as `touchDown` asks, and no other finger on it. */
export function takesTouch(s: TrayShared): boolean {
  'worklet';
  const store = s.store.value;
  return store !== null && takesFinger(s) && !store.boxDone;
}

/**
 * A finger that touched down beside the tray, in the gap or round the
 * trays, reaching it at (`x`, `y`) from (`x0`, `y0`): a touch there, as
 * `touchDown` takes one, its stroke cut from where the finger was so a
 * fast entry still clears the field from its edge. False, and nothing
 * touched, as `touchDown` refuses.
 */
export function touchEntered(
  s: TrayShared,
  x0: number,
  y0: number,
  x: number,
  y: number,
): boolean {
  'worklet';
  if (!touchDown(s, x, y)) return false;
  const store = s.store.value!;
  store.lastX = x0;
  store.lastY = y0;
  strokeTo(s, store, x, y, s.tune.value.brush);
  // The entry is the press: its cut counts towards no tick and no speed.
  store.moved = 0;
  return true;
}

/**
 * A finger scratching tray `from` goes on onto tray `to` without lifting:
 * no lift on the one, no touch on the other. Its point is (`fx`, `fy`) in
 * `from`'s board points, and was (`tx0`, `ty0`) and is (`tx`, `ty`) in
 * `to`'s. The crossing is cut into both trays, each clipping it to its own
 * coating; the stroke's travel, ticks and speed, a touch no frame has told
 * yet and the coin in the hand go on with the finger, the coin moved into
 * `to`'s points with nothing pressed or lifted; `from` is left as a lift
 * leaves it, with no lift told. `to` tells 'enter' on its next frame with
 * the tray the stroke came from, `fromIndex`, unless the finger has come
 * back to where a frame last saw it. False, and nothing changed, if either
 * tray has no store, no finger is down on `from` or `to` takes none; false
 * too if the crossing let the finger go, the screen having stopped it.
 */
export function touchHandedOver(
  from: TrayShared,
  to: TrayShared,
  fx: number,
  fy: number,
  tx0: number,
  ty0: number,
  tx: number,
  ty: number,
  fromIndex: number,
  toIndex: number,
): boolean {
  'worklet';
  const a = from.store.value;
  const b = to.store.value;
  if (a === null || b === null || !a.down || !takesFinger(to)) return false;
  // The crossing on the tray it leaves.
  touchMoved(from, fx, fy);
  if (!a.down) return false;
  fingerArrives(b);
  // The crossing on the tray it reaches, from its edge.
  b.lastX = tx0;
  b.lastY = ty0;
  strokeTo(to, b, tx, ty, to.tune.value.brush);
  // The stroke, as it was: the crossing counted once.
  b.moved = a.moved;
  a.moved = 0;
  b.travel = a.travel;
  b.tickTravel = a.tickTravel;
  b.feltAt = a.feltAt;
  b.spokeAt = a.spokeAt;
  b.speed = a.speed;
  to.speed.value = a.speed;
  b.moving = a.moving;
  to.moving.value = a.moving;
  b.banked = a.banked;
  b.finger.turn = a.finger.turn;
  if (a.pendingDown) {
    // Its touch, not yet told, is told where the finger is now.
    b.pendingDown = true;
    b.downOnCoating = a.downOnCoating;
    a.pendingDown = false;
  } else {
    // Crossed twice between frames: told once, from where a frame saw it.
    let origin = fromIndex;
    if (a.pendingEnter) {
      origin = a.enterFrom;
      a.pendingEnter = false;
    }
    b.pendingEnter = origin !== toIndex;
    b.enterFrom = b.pendingEnter ? origin : -1;
  }
  const dx = tx - fx;
  const dy = ty - fy;
  if (a.coin.phase === COIN_DOWN) {
    coinHandedOver(a.coin, b.coin, dx, dy);
    b.coinSpeed = a.coinSpeed;
    b.coinLastX = a.coinLastX + dx;
    b.coinLastY = a.coinLastY + dy;
    // The coin the hand draws goes over here too, both frames at once, so
    // whatever reads them sees the one coin where it was: left to the
    // trays' own loops, one tray's frame would put its coin away before the
    // other's drew it, and a mapper run between the two, as Reanimated runs
    // them on a frame of their own, would show the coin on neither tray, or
    // on both, for a frame. `to`'s next frame takes it on from there.
    const shown = frameHandedOver(from.hand.value, dx, dy);
    if (shown !== null) to.hand.value = shown;
    from.hand.value = COIN_AWAY;
  }
  coinTo(b, tx, ty);
  // The tray it left: as a lift leaves it, with nothing told.
  a.down = false;
  a.held = false;
  a.moving = false;
  from.moving.value = false;
  a.speed = 0;
  from.speed.value = 0;
  return true;
}

/** Tells the JS thread the cells not yet told, as revealed, in grid order, each fading over `ms`. */
function tellRest(store: TrayStore, now: number, ms: number, tell: Tell): void {
  'worklet';
  for (let i = 0; i < store.plan.cells.length; i++) {
    if (store.reported[i]) continue;
    store.reported[i] = true;
    if (ms > 0) {
      store.fadeFrom[i] = now;
      store.fadeMs[i] = ms;
      store.fadeEased[i] = false;
    }
    runOnJS(tell)('cell', i, 0);
  }
}

/** The box done at `now`: every cell left told, the floor fading over `ms`, then the box told. */
function finishBox(
  store: TrayStore,
  now: number,
  ms: number,
  tell: Tell,
): void {
  'worklet';
  store.boxDone = true;
  tellRest(store, now, ms, tell);
  store.floorFrom = now;
  store.floorMs = ms;
  runOnJS(tell)('box', -1, 0);
}

/** The finger let go of without a lift told: a sweep took the card, or the box ended, or the screen stopped it. */
function letGo(store: TrayStore, now: number): void {
  'worklet';
  store.down = false;
  store.pendingUp = false;
  coinLifted(store.coin, now);
}

/**
 * Quick Scratch takes the card from the finger at `now`: a finger on it is
 * let go of, and a touch or a lift no frame has told yet is never told.
 */
function takeFromFinger(store: TrayStore, now: number): void {
  'worklet';
  if (store.down) letGo(store, now);
  store.pendingDown = false;
  store.pendingUp = false;
  store.liftFirst = false;
}

/**
 * Whether Quick Scratch's path over the box as it stands would end it on
 * its first frame: the path's rule met with her press at the first
 * waypoint counted, as it is over a box the finger left read all but a
 * value. Read ahead, nothing stamped. Only the path is asked: the band
 * ends a box at its own end.
 */
function pathEndsAtOnce(store: TrayStore, still: boolean): boolean {
  'worklet';
  if (!store.plan.path || still) return false;
  const start = pathPoint(0, store.plan.field, store.bows);
  return boxDoneAt(
    maskSharesAfterPress(store.mask, start.x, start.y, BRUSH_RADIUS),
  );
}

/**
 * Quick Scratch's path stopped at `now`, its rule having done the box
 * before her strokes have ended: nothing more is drawn, and the coin lifts
 * and fades from where it is, as a finger's lift takes it, rather than
 * carrying on over the finished box. Nothing for the band, or a path
 * already over.
 */
function stopPath(store: TrayStore, now: number): void {
  'worklet';
  if (!store.sweepPath || store.sweepDone) return;
  store.pathEnded = true;
  store.pathLifted = true;
  store.sweepDone = true;
  coinLifted(store.coin, now);
}

/**
 * Quick Scratch's path, a frame on at `now`: the brush drawn along it in
 * steps no longer than `QUICK_PATH.stepPoints`, so the trail follows its
 * bow and each step throws its flakes; the box finished as its strokes
 * end; the coin lifted after its rest.
 */
function stepPath(
  s: TrayShared,
  store: TrayStore,
  now: number,
  tell: Tell,
): void {
  'worklet';
  const elapsed = now - store.sweepFrom;
  const field = store.plan.field;
  const strokeMs = pathStrokeMs();
  if (!store.pathEnded) {
    const ended = elapsed >= strokeMs - QUICK_PATH.slackMs;
    const until = ended ? strokeMs : elapsed;
    if (until > store.pathAt) {
      const steps = pathSteps(
        store.pathAt,
        until,
        field,
        store.bows,
        store.lastX,
        store.lastY,
      );
      for (let i = 0; i < steps.length; i += 2) {
        strokeTo(s, store, steps[i]!, steps[i + 1]!, null);
      }
      store.pathAt = until;
      coinTo(store, store.lastX, store.lastY);
    }
    if (ended) {
      store.pathEnded = true;
      if (!store.boxDone) finishBox(store, now, TRAY_TIMING.boxFadeMs, tell);
    }
  }
  if (!store.pathLifted && elapsed >= pathLiftMs() - QUICK_PATH.slackMs) {
    store.pathLifted = true;
    store.sweepDone = true;
    coinLifted(store.coin, now);
  }
}

/**
 * Quick Scratch begun at `now` over a box not yet done: the finger let go
 * of, and the coin pressed in at the path's first point, or riding the
 * band's front, unless motion is `still`.
 */
function beginSweep(store: TrayStore, now: number, still: boolean): void {
  'worklet';
  const d = store.diagonal;
  store.sweepFrom = now;
  store.sweepTold = 0;
  store.sweepDone = false;
  store.bandLifted = false;
  store.pathAt = 0;
  store.pathEnded = false;
  store.pathLifted = false;
  takeFromFinger(store, now);
  store.sweepPath = store.plan.path && !still;
  if (store.sweepPath) {
    const start = pathPoint(0, store.plan.field, store.bows);
    strokeFrom(store, start.x, start.y, null);
    coinDown(store.coin, now, start.x, start.y);
    coinTo(store, start.x, start.y);
  } else if (!still) {
    const coin = sweepCoin(sweepFront(0, d), d);
    coinDown(store.coin, now, coin.x, coin.y);
  }
  store.coinLastX = store.coin.x;
  store.coinLastY = store.coin.y;
}

/** How far in the warm-up draws what it fades or brings back: any level but none. */
const WARM_LEVEL = 0.5;

/**
 * How many frames the warm-up draws: the coin pressed, half lifted, lifted
 * and fading, each blur and blend its first stroke draws.
 */
export const WARM_FRAMES = 4;

/**
 * The lean the warm-up draws the coin at, degrees: a stroke's, so that the
 * hand draws it tilted and, as a stroke to the right turns it, blended
 * between two frames.
 */
const WARM_LEAN = 8;

/** The warm-up's flakes' own numbers. */
const WARM_SEED = 0x9e3779b1;

/** How many of the lab's steps the warm-up's flakes are moved on: the grains and crumbs lying, the chips mostly still tumbling. */
const WARM_STEPS = 12;

/**
 * How many flakes the warm-up throws, of which kinds, and how they fly,
 * whatever the card's tuning says: the Coin Lean Lab's defaults, which
 * throw enough of every kind, and leave chips still tumbling after
 * `WARM_STEPS`, for its one stroke to draw each sprite the first stroke
 * may. Fewer or slower flakes, as a tuning may set, could leave a kind out,
 * and its sprite to compile in the first stroke. Flakes turned off stay
 * off.
 */
const WARM_FLAKES = {
  pAmount: 1,
  pDust: 35,
  pCrumb: 30,
  pSize: 1,
  pSpeed: 1,
  pSpread: 70,
  pStay: 35,
  pStayTime: 6,
  pSweep: 0.6,
  pMax: 400,
};

/**
 * Flakes of every kind thrown across the field's middle, some lying and
 * some in the air, packed for the hand's canvas: each sprite the first
 * stroke draws, every shadow, a crumb's lit top and a chip's squashes. Its
 * one stroke throws them from the finger's ring, on `WARM_FLAKES` over the
 * rest of `flakes`.
 */
function warmFlakes(
  store: TrayStore,
  flakes: FlakeTuning,
  brush: FingerBrush,
  stepSeconds: number,
): Float32Array {
  'worklet';
  const plan = store.plan;
  const field = plan.field;
  const pool = makeFlakes(plan.flakes.slots, WARM_SEED);
  const warm = { ...flakes, ...WARM_FLAKES };
  const y = field.top + field.height / 2;
  strokeFlakes(
    pool,
    field.left,
    y,
    field.left + field.width,
    y,
    warm,
    fingerFlakeRadius(brush),
    plan.width,
    plan.height,
    null,
    plan.flakes.cap,
    0,
  );
  for (let i = 0; i < WARM_STEPS; i++) stepFlakes(pool, stepSeconds, warm);
  return packFlakes(pool, warm, plan.flakes.layout);
}

/**
 * Frame `k` of the warm-up, drawn under the open's cover before the tray
 * says it is ready: a frame of everything the first touch and the first
 * reveal would draw for the first time, so each
 * canvas compiles what drawing it takes now, where a stroke would wait on
 * it: on the web every canvas has a GPU context of its own, which on a
 * browser's first visit took half a second for the coin's first frame.
 * Flakes of every kind, lying and tumbling, with their shadows, a cell's
 * fade, the floor's, the coating coming back, and the coin in the
 * hand pressed, lifting and fading; under Reduce Motion, no flakes and no
 * coin, as ever.
 */
function warmTray(
  s: TrayShared,
  store: TrayStore,
  k: number,
  still: boolean,
): void {
  'worklet';
  const n = store.plan.cells.length;
  const tune = s.tune.value;
  const motion = tune.coin;
  const frame = motion.frameMs;
  if (k === 0) {
    s.foilIn.value = WARM_LEVEL;
    s.floor.value = WARM_LEVEL;
    if (n > 0) {
      const levels = filled(n, 0);
      levels[0] = WARM_LEVEL;
      s.fades.value = levels;
    }
    if (!still) {
      s.flakeFrame.value = warmFlakes(
        store,
        tune.flakes,
        tune.brush,
        frame / 1000,
      );
      const field = store.plan.field;
      coinDown(
        store.coin,
        0,
        field.left + field.width / 2,
        field.top + field.height / 2,
      );
      store.coin.lean = WARM_LEAN;
      store.coin.leanBefore = WARM_LEAN;
    }
  }
  if (still) return;
  // Her press-in over, then her lift halfway, whole, and fading.
  const lift = motion.pressScale.length * frame;
  if (k === 1) coinLifted(store.coin, lift);
  const at = [
    lift,
    lift + (motion.liftFrames / 2) * frame,
    lift + motion.liftFrames * frame,
    lift + (motion.liftFrames + motion.fadeFrames / 2) * frame,
  ];
  s.hand.value = coinFrameAt(
    store.coin,
    at[k] ?? lift,
    0,
    tune,
    store.plan.coin,
  );
}

/**
 * One frame of the tray at `now`, `dt` ms after the last, on the UI thread:
 * see `runTray`. Returns whether another frame is wanted, which is false
 * only with the finger up and nothing moving or fading.
 */
export function stepTray(
  s: TrayShared,
  now: number,
  dt: number,
  tell: Tell,
): boolean {
  'worklet';
  const store = s.store.value;
  if (store === null) return false;
  const d = store.diagonal;
  const still = s.still.value;
  const n = store.plan.cells.length;
  let busy = false;

  // The warm-up, once a store, while the open's cover is up: a few frames
  // of what the card has yet to draw, then the card as it was given,
  // told. Stopped where it is as the cover comes off.
  if (store.warmFrames >= 0) {
    const wanted = s.warm.value && !s.grabbable.value;
    if (wanted && store.warmFrames < WARM_FRAMES) {
      warmTray(s, store, store.warmFrames, still);
      store.warmFrames++;
      return true;
    }
    if (wanted || store.warmFrames > 0) {
      store.warmFrames = -1;
      resetTray(s, store);
      runOnJS(tell)('warm', -1, 0);
      return true;
    }
  }

  // A restored card: everything as it was given, the coating coming back. A
  // sweep asked for before the restore is spent with it; one asked for
  // since, which can reach the tray in the same frame, plays. A finger
  // moving on the card is let go with the rest, and told as stopped here:
  // the reset stills it, so the speed below never sees it stop.
  const restore = s.restore.value;
  if (restore !== store.restoreToken) {
    const stopped = store.moving;
    resetTray(s, store);
    store.restoreToken = restore;
    if (stopped) {
      store.spokeAt = -Infinity;
      runOnJS(tell)('speed', -1, 0);
    }
    const asked = s.quick.value;
    if (asked !== null && sweepTokenRestore(asked) < restore) {
      store.sweepToken = asked;
    }
    store.foilFrom = now;
    s.foilIn.value = 0;
  }

  // Quick Scratch: it begins and takes the card from the finger. The yours
  // tray draws the designer's path, unless motion is reduced; the band
  // otherwise, which the coin rides. Over a box already done, which the
  // screen may not have heard of yet, the token is spent and nothing runs:
  // no coin and no flakes over a box the finger has revealed. Nor does the
  // path run over a box its rule would end on its first frame, as it would
  // one the finger left read all but a value: that box ends there and then,
  // as it would under a finger.
  const quick = s.quick.value;
  if (quick !== null && quick !== store.sweepToken) {
    store.sweepToken = quick;
    if (!store.boxDone) {
      if (pathEndsAtOnce(store, still)) {
        takeFromFinger(store, now);
        finishBox(store, now, TRAY_TIMING.boxFadeMs, tell);
      } else {
        beginSweep(store, now, still);
      }
    }
  }
  const sweeping = store.sweepFrom >= 0 && !store.sweepDone;

  // A stroke's lift that no frame told before the next touch landed, told
  // first: see `touchDown`.
  if (store.liftFirst) {
    store.liftFirst = false;
    runOnJS(tell)('up', -1, store.liftFirstTravel);
  }
  // The finger: its touch told, with the claim on the card's first, and
  // then let go once the screen stops letting it scratch, so the coin
  // pressed for a touch the screen stopped before its first frame lifts.
  // That touch's lift is told with it: the screen let every finger go as
  // it stopped, before it heard of this one, so no other word that it is
  // off the card would follow. A finger let go after a frame told its
  // touch is told no lift, as ever.
  const touched = store.pendingDown;
  if (store.pendingDown) {
    store.pendingDown = false;
    if (!store.claimed) {
      store.claimed = true;
      runOnJS(tell)('stroke', -1, 0);
    }
    runOnJS(tell)('down', -1, store.downOnCoating ? 1 : 0);
    if (!still) {
      coinDown(store.coin, now, store.lastX, store.lastY);
      coinTo(store, store.lastX, store.lastY);
      store.coinLastX = store.coin.x;
      store.coinLastY = store.coin.y;
    }
  }
  // A finger that came on from the other tray: heard as nothing but the
  // tray it is scratching now.
  if (store.pendingEnter) {
    store.pendingEnter = false;
    runOnJS(tell)('enter', store.enterFrom, 0);
  }
  if (store.down && !s.grabbable.value) letGo(store, now);
  if (store.pendingLetGo) {
    store.pendingLetGo = false;
    coinLifted(store.coin, now);
  }
  if (touched && !store.down && !store.pendingUp) {
    runOnJS(tell)('up', -1, store.travel);
  }
  if (store.down || touched) store.touchedAt = now;

  if (sweeping && store.sweepPath) stepPath(s, store, now, tell);

  // What the brush stamped since the last frame: the canvas uploads the
  // mask again, and the box is read again, by the plan's rule. Under a
  // finger a cell is told once its symbol's zone is read, and nothing
  // clears on its own: the box clears the rest of its coating the moment
  // every symbol and value in it is read and its area, where the rule
  // asks for one and the box is not the last, is scratched, or the moment
  // its area passes the rule's cap, read or not, fading the floor and told
  // after its cells, so the screen hears every cell before the box. A value
  // the screen has waived counts as read. Quick Scratch's path keeps the
  // designer's timing instead: each cell past its threshold fades out, and
  // the box is done at its share or as her strokes end; done at its share,
  // her strokes stop there. The flakes lying there stay, as the lab's do.
  // The box is read again the same way, its mask as it stands, on the
  // frame the screen's waivers or its last box change, the finger on the
  // other tray or on none, so it clears the moment the screen says it may;
  // while the card cannot be scratched, as it can again.
  const waived = s.waived.value;
  const last = s.lastBox.value;
  const ruled =
    s.grabbable.value &&
    (waived !== store.readWaived || last !== store.readLast);
  if (store.dirty || ruled) {
    if (store.dirty) s.maskVersion.value = s.maskVersion.value + 1;
    store.dirty = false;
    store.readWaived = waived;
    store.readLast = last;
    if (store.sweepFrom >= 0) {
      const shares = maskShares(store.mask);
      for (let i = 0; i < n; i++) {
        if (store.reported[i] || !revealedAt(shares[i]!)) continue;
        store.reported[i] = true;
        store.fadeFrom[i] = now;
        store.fadeMs[i] = TRAY_TIMING.revealFadeMs;
        store.fadeEased[i] = true;
        runOnJS(tell)('cell', i, 0);
      }
      if (!store.boxDone && boxDoneAt(shares)) {
        if (store.down) letGo(store, now);
        finishBox(store, now, TRAY_TIMING.boxFadeMs, tell);
        stopPath(store, now);
      }
    } else {
      const rule = store.plan.reveal;
      const zones = maskZoneShares(store.mask);
      const symbolZone = store.mask.symbolZone;
      for (let i = 0; i < n; i++) {
        const symbol = zones[symbolZone[i]!] ?? 1;
        if (store.reported[i] || !cellReadAt(symbol, rule.symbol)) continue;
        store.reported[i] = true;
        runOnJS(tell)('cell', i, 0);
      }
      // A cell off the tray has nothing of it left to scratch.
      const cells = maskShares(store.mask, 1);
      store.zonesRead = boxReadAt(
        zones,
        symbolZone,
        cells,
        rule.idleSymbol,
        rule.idleGlyph,
        rule.idleArea,
        rule.areaCap,
        waived,
      );
      store.zonesReadBare = boxReadAt(
        zones,
        symbolZone,
        cells,
        rule.idleSymbol,
        rule.idleGlyph,
        0,
        rule.areaCap,
        waived,
      );
      // The dwell runs from the frame it is first met; shares only grow and
      // waivers only come, so it holds until the card comes back or is read
      // by other zones.
      const dwelt = boxReadAt(
        zones,
        symbolZone,
        cells,
        rule.dwellSymbol,
        rule.dwellGlyph,
        rule.area,
        rule.areaCap,
        waived,
      );
      if (!dwelt) store.dwellFrom = -1;
      else if (store.dwellFrom < 0) store.dwellFrom = now;
      if (
        !store.boxDone &&
        boxReadAt(
          zones,
          symbolZone,
          cells,
          rule.symbol,
          rule.glyph,
          last ? 0 : rule.area,
          rule.areaCap,
          waived,
        )
      ) {
        // The last box lets its finger go; any other keeps it, gliding
        // over the box to the tray still to scratch.
        if (store.down && last) letGo(store, now);
        finishBox(store, now, TRAY_TIMING.boxFadeMs, tell);
      }
    }
  }

  // A box whose every symbol and value the finger has nearly read, then
  // left alone for `idleCleanMs` while the card can be scratched, clears
  // the rest of its coating as it would have under the finger: the frames
  // run until then. A finger that went on into the other tray left it. The
  // last box left to scratch waits on its zones alone, its area lifted, so
  // the outcome never waits on blank coating round symbols already read.
  if (
    (s.lastBox.value ? store.zonesReadBare : store.zonesRead) &&
    !store.boxDone &&
    store.sweepFrom < 0 &&
    store.touchedAt >= 0 &&
    !store.down &&
    s.grabbable.value
  ) {
    if (now - store.touchedAt >= TRAY_TIMING.idleCleanMs) {
      finishBox(store, now, TRAY_TIMING.boxFadeMs, tell);
    } else {
      busy = true;
    }
  }
  // A box whose dwell has held for `idleCleanMs` clears, the finger on it or
  // not, the last box letting that finger go as a box read under it does.
  // Not under Quick Scratch, which ends the box its own way.
  if (
    store.dwellFrom >= 0 &&
    !store.boxDone &&
    store.sweepFrom < 0 &&
    s.grabbable.value
  ) {
    if (now - store.dwellFrom >= TRAY_TIMING.idleCleanMs) {
      if (store.down && s.lastBox.value) letGo(store, now);
      finishBox(store, now, TRAY_TIMING.boxFadeMs, tell);
    } else {
      busy = true;
    }
  }

  // The finger's speed, for the scratch sound, and its ticks as it moves.
  // Quick Scratch's path moves the brush too, but no finger: it is heard
  // and felt only as the screen schedules it.
  const step = Math.min(Math.max(0, dt), MAX_STEP_MS);
  const moved = store.moved;
  store.moved = 0;
  const pathing = sweeping && store.sweepPath && !store.pathEnded;
  const instant = dt > 0 && !pathing ? moved / (dt / 1000) : 0;
  let speed = smoothedSpeed(store.speed, instant, dt);
  if (!store.down && speed < STILL_SPEED) speed = 0;
  store.speed = speed;
  if (speed !== s.speed.value) s.speed.value = speed;
  // Over a finished box the finger scratches nothing, so is never heard.
  const scratching = store.down && !store.boxDone;
  const moving = scratching && speed >= MOVING_SPEED;
  if (moving !== store.moving) {
    store.moving = moving;
    s.moving.value = moving;
    if (!moving) {
      store.spokeAt = -Infinity;
      runOnJS(tell)('speed', -1, 0);
    }
  }
  if (moving && now - store.spokeAt >= SPEED_REPORT_MS) {
    store.spokeAt = now;
    runOnJS(tell)('speed', -1, speed);
  }
  if (scratching && tickDue(store.tickTravel, store.feltAt, now)) {
    store.feltAt = now;
    store.tickTravel = Math.min(
      store.tickTravel - SCRATCH_TICK.points,
      SCRATCH_TICK.points,
    );
    runOnJS(tell)('haptic', -1, speed);
  }
  if (store.down || speed > 0) busy = true;

  // The lift: told with the stroke's length, the coin lifting.
  if (store.pendingUp) {
    store.pendingUp = false;
    runOnJS(tell)('up', -1, store.upTravel);
    coinLifted(store.coin, now);
  }

  // The band: it moves on, the coin rides ahead of it to the far corner and
  // lifts there, and each cell is told as the band's centre passes its own.
  // The band clears the coating itself, so no cell fades under it; at the
  // end the whole floor is clear.
  if (sweeping && !store.sweepPath) {
    const progress = sweepProgress(now - store.sweepFrom);
    const front = sweepFront(progress, d);
    s.sweep.value = front;
    if (!still && !store.bandLifted) {
      const coin = sweepCoin(front, d);
      const along = coin.x * d.ux + coin.y * d.uy;
      if (along >= d.length) {
        store.bandLifted = true;
        coinMoved(store.coin, d.ux * d.length, d.uy * d.length);
        coinLifted(store.coin, now);
      } else {
        coinMoved(store.coin, coin.x, coin.y);
      }
    }
    while (store.sweepTold < store.order.length) {
      const next = store.order[store.sweepTold]!;
      if (next.front > front) break;
      store.sweepTold++;
      if (store.reported[next.index]) continue;
      store.reported[next.index] = true;
      runOnJS(tell)('cell', next.index, 0);
    }
    if (progress >= 1) {
      store.sweepDone = true;
      if (!store.bandLifted) {
        store.bandLifted = true;
        coinLifted(store.coin, now);
      }
      if (!store.boxDone) finishBox(store, now, 0, tell);
      store.floorFrom = now;
      store.floorMs = 0;
    }
    busy = true;
  }

  // The coin in the hand, a frame on, for the hand's canvas: its own speed
  // for its tremor, its spring stepped in the tray's whole 1/60 s steps,
  // and its frame read between the last two. The flakes step after it in
  // each, as the lab steps them, and are packed for the hand only as they
  // change.
  const tune = s.tune.value;
  const motion = tune.coin;
  const coinOn = !still && coinBusy(store.coin);
  // A restored card's coating coming back, 0 to 1, which the coin at rest
  // waits for, so it never lands on a coating still fading in.
  const foilIn =
    store.foilFrom < 0
      ? 1
      : fadeLevel(store.foilFrom, TRAY_TIMING.restoreMs, now);
  if (coinOn) {
    const cx = store.coin.x - store.coinLastX;
    const cy = store.coin.y - store.coinLastY;
    store.coinLastX = store.coin.x;
    store.coinLastY = store.coin.y;
    store.coinSpeed = smoothedSpeed(
      store.coinSpeed,
      dt > 0 ? Math.sqrt(cx * cx + cy * cy) / (dt / 1000) : 0,
      dt,
    );
  }
  const stepMs = motion.frameMs;
  store.banked += step;
  let steps = 0;
  while (store.banked >= stepMs && steps < MOST_STEPS) {
    store.banked -= stepMs;
    steps++;
    if (coinOn) {
      // Gliding over a finished box, it no longer trembles.
      const pressed = store.coin.phase === COIN_DOWN && !store.boxDone;
      coinStep(store.coin, motion, store.tremor, pressed ? store.coinSpeed : 0);
    }
    stepFlakes(store.flakes, stepMs / 1000, tune.flakes);
  }
  if (store.banked >= stepMs) store.banked = 0;
  if (store.flakes.changed) {
    store.flakes.changed = false;
    s.flakeFrame.value = packFlakes(
      store.flakes,
      tune.flakes,
      store.plan.flakes.layout,
    );
  }
  if (flakesBusy(store.flakes)) busy = true;
  if (coinOn) {
    const faded = coinFrameAt(
      store.coin,
      now,
      store.banked / stepMs,
      tune,
      store.plan.coin,
    );
    // The fade's end puts the coin away, which under a finger still on the
    // tray is held from this frame, not the next: see below.
    const frame = store.held && !coinBusy(store.coin) ? COIN_HELD : faded;
    // Written only as it moves: a frame alike to the last is not drawn again.
    if (!sameCoinFrame(frame, s.hand.value)) s.hand.value = frame;
    busy = true;
  } else if (
    store.plan.coin.rests &&
    !still &&
    s.grabbable.value &&
    !store.boxDone &&
    !store.held &&
    foilIn === 1
  ) {
    // No finger on the tray, the card there to scratch, its coating all
    // there: the coin at rest, a still frame, which the next touch takes up.
    const rest = restingFrame(
      store.plan.coin,
      tune,
      store.plan.width,
      store.plan.height,
    );
    if (!sameCoinFrame(rest, s.hand.value)) s.hand.value = rest;
  } else {
    // No coin; a finger still on the tray, its coin let go of, keeps the
    // coin at rest away until it lifts: see `drawnAlpha`.
    const away = store.held ? COIN_HELD : COIN_AWAY;
    if (s.hand.value.alpha !== 0 || s.hand.value.held !== away.held) {
      s.hand.value = away;
    }
  }

  // The fades: each cell's, eased out where a finger revealed it, the
  // floor's, and a restored card's coating coming back. A fade wants
  // frames from the one it begins on, at level 0, which can be the frame
  // that ends everything else.
  let fadesMoved = false;
  let fading = false;
  for (let i = 0; i < n; i++) {
    const linear = fadeLevel(store.fadeFrom[i]!, store.fadeMs[i]!, now);
    const level = store.fadeEased[i] ? easedOut(linear) : linear;
    if (level !== store.fadeLevels[i]) {
      store.fadeLevels[i] = level;
      fadesMoved = true;
    }
    if (store.fadeFrom[i]! >= 0 && linear < 1) fading = true;
  }
  if (fadesMoved) s.fades.value = store.fadeLevels.slice();
  const floor = fadeLevel(store.floorFrom, store.floorMs, now);
  if (floor !== s.floor.value) s.floor.value = floor;
  if (store.floorFrom >= 0 && floor < 1) fading = true;
  if (foilIn !== s.foilIn.value) s.foilIn.value = foilIn;
  if (foilIn < 1) fading = true;
  if (fading) busy = true;

  return busy;
}

/**
 * Runs the tray's frames on the UI thread until nothing wants another, one
 * loop at a time: a call while one runs leaves it to pick the new work up
 * on its next frame. Called as a finger goes down, and from the JS thread
 * as a sweep or a restore asks for frames. A frame longer than
 * `MAX_STEP_MS` steps the flakes and the coin by that much.
 */
export function runTray(s: TrayShared, tell: Tell): void {
  'worklet';
  if (s.loop.value.running) return;
  const mine = s.loop.value.owner + 1;
  s.loop.value = { owner: mine, running: true };
  let last = -1;
  const frame = (timestamp: number) => {
    if (s.loop.value.owner !== mine) return;
    const dt = last < 0 ? 0 : timestamp - last;
    last = timestamp;
    if (stepTray(s, timestamp, dt, tell)) {
      requestAnimationFrame(frame);
      return;
    }
    s.loop.value = { owner: mine, running: false };
  };
  requestAnimationFrame(frame);
}
