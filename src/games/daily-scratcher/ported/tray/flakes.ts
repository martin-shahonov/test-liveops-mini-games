import type { FlakeLayout, FlakeShape } from './flakeAtlas';

/**
 * The coating's flakes, as the Coin Lean Lab throws them: along every
 * segment of a stroke the coin scrapes off dust, rolled crumbs and flat
 * chips, coloured by the coating under them, which fly up and out with a
 * height of their own, fall, bounce, tumble and land; some lie there for a
 * while, the rest vanish soon after landing, and the coin sweeps the lying
 * ones ahead and aside as it passes. A pool of plain numbers a worklet
 * steps on the UI thread, in the lab's 1/60 s steps, and packs for the hand's
 * canvas, which draws them as atlas sprites. No Skia here, so it runs under
 * node as it does on the UI thread.
 *
 * Everything is in the tray's own board points from its top-left corner,
 * seconds and degrees, the lab's units, so the lab's numbers paste as they
 * are. The random numbers are drawn in the lab's order, every one of them,
 * the outline's included: a pool's stream set where the lab's stood plays
 * the lab's flakes back exactly.
 */

/**
 * The flakes' tuning, every number the studio may set, building the game
 * from a checkout: a plain object, keyed at the top as the Coin Lean Lab
 * names its settings, so its Copy settings' `flakes` block applies to it as
 * it is; the numbers the lab keeps in its code sit in the groups below. The
 * lab's keys hold Rossen's saved settings (5 Nov 2026, `FLAKES_ROSSEN`),
 * sparse, slow flakes, mostly dust, but for two the owner asked the same
 * day to change, so that the flakes left on the card go soon after they
 * land and never crowd it or make it look pixelated: `pStayTime`, 1.4
 * against his 20, so each that stays begins to fade within 2 s of landing
 * and is gone within 3 s, where his lay 12 to 28 s; and `pMax`, 150
 * against his 600, with a pool to match. How many are thrown, of which
 * kinds, and how they fly are as he set them. Nothing reads it from a
 * worklet's closure: the tray hands the worklets its values as arguments
 * (see `Tune`), so a value set from outside reaches the UI thread. Read at
 * each use, a segment, a step or a landing, but for `pMax`'s pool and the
 * groups marked as read as the scratcher opens.
 */
export const FLAKES = {
  /** Flakes at all. */
  pOn: true,
  /** How many: times `spawn.perPoint` a point of stroke, 0.055 a point, 33 a second at 600 points a second. */
  pAmount: 0.1,
  /** The share that is dust, percent. */
  pDust: 61,
  /** The share of the rest that are rolled crumbs, percent (3.9 % of all); the others are flat chips (35.1 %). */
  pCrumb: 10,
  /** Their size, and the speed they leave at, as factors: dust 0.25 to 0.63 pt, chips 6 to 26 pt a second across. */
  pSize: 1.15,
  pSpeed: 0.2,
  /** How far either side of the stroke they fly, degrees. */
  pSpread: 60,
  /** The share that stay where they land a while, percent; half of it for dust. */
  pStay: 63,
  /**
   * How long those stay, seconds, times `physics.stayFor`: 0.84 to 1.96 s,
   * then a 0.8 s fade, so each is gone within 2.8 s of landing. Rossen's 20
   * kept them 12 to 28 s.
   */
  pStayTime: 1.4,
  /** How hard the coin sweeps the lying ones. */
  pSweep: 0.4,
  /**
   * The most on the card: past it, each segment fades as many of the
   * oldest lying ones as there are too many not already fading, so the
   * rest stay; and past `cap.hard` times it, those fading counted, the
   * oldest go at once. The pool is sized from it as the scratcher opens:
   * 225 slots a tray on a device of the middle class. With flakes gone
   * within 3 s of landing, a zigzag at 900 points a second keeps under 100
   * on a tray at once and one at 1,500 under 150, so it holds back only a
   * faster scribble; Rossen's 600 took a pool of 900 slots.
   */
  pMax: 150,
  /** How a segment throws them (`spawnFlakes`). */
  spawn: {
    /** Flakes a point of stroke, at `pAmount` 1. */
    perPoint: 0.55,
    /** How far from the stroke they start, as a share of the brush's radius, either way. */
    ring: [0.5, 1] as readonly number[],
    /** The share kicked back behind the coin, and their speed's share. */
    backShare: 0.22,
    backSpeed: 0.5,
    /** The spread's power: above 0 leans them towards its edge. */
    spreadPower: 0.8,
    /** Their speed across the card, points a second, at `pSpeed` 1, times `heavy`. */
    speed: [30, 130] as readonly number[],
    heavy: { dust: 0.75, crumb: 0.7, chip: 1 },
    /** How high each kind hops: times `z` and `vz`. */
    hop: { dust: 0.3, crumb: 0.55, chip: 1 },
    /** Their height as they start, points, and their speed up, points a second, at least `vzFloor` of it whatever `pSpeed`. */
    z: [0.3, 1.5] as readonly number[],
    vz: [25, 85] as readonly number[],
    vzFloor: 0.2,
    /** A crumb rolls across the stroke, give or take this, radians. */
    crumbRoll: 0.6,
    /** Their spin at most either way, radians a second. */
    spin: { crumb: 6, other: 18 },
    /** A chip's tumble at most either way, radians a second. */
    flipRate: 25,
    /** Their size, points, at `pSize` 1: a dust grain's radius, a crumb's and a chip's scale. */
    size: {
      dust: [0.22, 0.55] as readonly number[],
      crumb: [0.8, 1.9] as readonly number[],
      chip: [0.6, 2.2] as readonly number[],
    },
    /** The share of chips that come small, and how much smaller. */
    chipSmall: { share: 0.25, scale: 0.55 },
    /** A crumb's outline: so many longer than wide, its points and their radii. */
    crumbAspect: [2.2, 3.3] as readonly number[],
    crumbPoints: 9,
    crumbRadius: [0.85, 1.1] as readonly number[],
    /** A chip's outline: its corners, each turned by up to `chipJitter` radians, at a radius, flattened. */
    chipSides: [4, 6] as readonly number[],
    chipJitter: 0.35,
    chipRadius: [0.55, 1.15] as readonly number[],
    chipFlat: [0.55, 1] as readonly number[],
    /** Each kind's colour, as a share of the coating's under it: dust ground fine, a crumb's darker inside. */
    colour: { dust: 0.82, crumb: 0.9, chip: 1 },
    /** Each one's shade, and a dust grain's opacity. */
    shade: [0.82, 1.12] as readonly number[],
    dustBase: [0.45, 0.8] as readonly number[],
    /** Dust stays at this share of `pStay`. */
    dustStay: 0.5,
    /** The colour before the coating's are read. */
    fallback: [214, 150, 120] as readonly number[],
  },
  /** How they move, in the lab's 1/60 s steps (`stepFlakes`). */
  physics: {
    /** Towards the card, points a second squared. */
    gravity: 650,
    /** Falling faster than this, points a second, one bounces, keeping `bounceKeep` of it up, and the shares of its slide, spin and tumble. */
    bounceBelow: 45,
    bounceKeep: 0.32,
    bounceSlide: 0.55,
    bounceSpin: 0.5,
    bounceFlip: 0.4,
    /** Lying, its slide and spin die away at this rate, a second. */
    friction: 9,
    /** Fading out, seconds: one that stayed, and one that did not. */
    stayFade: 0.8,
    goFade: 0.35,
    /** One that does not stay goes this long after landing, seconds. */
    goAfter: [0.08, 0.45] as readonly number[],
    /** One that stays, `pStayTime` times this. */
    stayFor: [0.6, 1.4] as readonly number[],
    /**
     * The game's own: a lying flake slower than this, points a second, stops
     * dead, so a still card is not drawn again every frame of a stay. The
     * lab's slide never quite ends; 0 slides as it does.
     */
    restSpeed: 0.01,
  },
  /** How the coin sweeps the lying ones (`sweepFlakes`). */
  sweep: {
    /** How far from the stroke, as a share of the brush's radius. */
    reach: 1.05,
    /**
     * Its push, points a second: the finger's speed, points a second,
     * times `perSpeed`, held to `push`, times `pSweep`. 1.5 is the push a
     * 60 Hz pointer gave when it was the gap between two samples times 90,
     * now the same on every phone and pointer, as the lab's since the veto.
     */
    perSpeed: 1.5,
    push: [40, 320] as readonly number[],
    /** Each one's share of the push, and the share of that it goes aside, ahead at `ahead`. */
    speed: [0.4, 1.1] as readonly number[],
    out: [0.3, 0.8] as readonly number[],
    ahead: 0.8,
    /** Its hop, points a second, times `pSweep`, a dust grain's at `dustVz` of it, from `z` points up. */
    vz: [4, 18] as readonly number[],
    dustVz: 0.5,
    z: 0.2,
  },
  /**
   * The most a device keeps, read as the scratcher opens: `pMax` times
   * `hard` at most at once, and `pMax` no more than its class's: estimates
   * from the lab's model of what each draws in time, not measurements.
   */
  cap: { hard: 1.5, devices: { low: 40, mid: 1370 } },
  /**
   * How they are drawn (`packFlakes`): each crumb's and chip's shadow on the
   * card, black, fainter and further off the higher it flies; each body
   * lifted by its height; a crumb's lit top; a chip's glint and squash as it
   * tumbles. The shapes, the shadows' radii and the highlight's place and
   * radii, are drawn into the atlas as the scratcher opens; the rest is read
   * every frame.
   */
  draw: {
    shadowAlpha: 0.32,
    shadowFade: 25,
    shadowFloor: 0.35,
    shadowOffset: [0.35, 0.5] as readonly number[],
    shadowLift: [0.35, 0.55] as readonly number[],
    crumbShadow: [0.95, 0.38] as readonly number[],
    chipShadow: [0.75, 0.5] as readonly number[],
    lift: 0.45,
    crumbBody: 0.72,
    highlight: {
      at: -0.12,
      radii: [0.75, 0.11] as readonly number[],
      alpha: 0.85,
      gain: [1.18, 1.15, 1.12] as readonly number[],
    },
    glint: [0.78, 0.42] as readonly number[],
    tumble: [0.35, 0.65] as readonly number[],
  },
  /**
   * The sprites they are drawn from, made as the scratcher opens: so many
   * crumb outlines over `spawn.crumbAspect`, so many chip outlines for each
   * of `spawn.chipSides`, each at so many squashes over `draw.tumble`, in
   * cells `cellPx` square at `unitPx` an outline unit, from `seed`.
   */
  atlas: {
    crumbs: 6,
    chipsPerSides: 2,
    squashLevels: 8,
    cellPx: 32,
    unitPx: 10,
    seed: 0x2545f491,
  },
};

/**
 * Rossen's saved Coin Lean Lab settings (5 Nov 2026), their `flakes` block
 * word for word as his lab's Copy settings writes it: the game's own but
 * for `pStayTime` and `pMax`, which the owner asked to change (see
 * `FLAKES`). Applied over `FLAKES` they play his flakes again, as his
 * settings loaded in the lab do; the lab plays the game's with those two
 * set to 1.4 and 150.
 */
export const FLAKES_ROSSEN = {
  pOn: true,
  pAmount: 0.1,
  pDust: 61,
  pCrumb: 10,
  pSize: 1.15,
  pSpeed: 0.2,
  pSpread: 60,
  pStay: 63,
  pStayTime: 20,
  pSweep: 0.4,
  pMax: 600,
};

/** The flakes' tuning, as `FLAKES` holds it. */
export type FlakeTuning = typeof FLAKES;

/** A flake's kind. */
export const DUST = 0;
export const CRUMB = 1;
export const CHIP = 2;

/**
 * The flakes on one tray, kept in the order they were born, the oldest
 * first, as the lab keeps its array: a ring of `slots`, from `start`, so the
 * oldest go at once when it is full. One array a field, made once, so a
 * step allocates nothing.
 */
export type FlakePool = {
  slots: number;
  start: number;
  count: number;
  /** The pool's clock, seconds, which its steps move on. */
  clock: number;
  /** Its random numbers' state: see `flakeRandom`. */
  seed: number;
  /** How many were ever born, each one's number its `id`. */
  born: number;
  /**
   * The oldest a full pool let go of since the last trim, how many of
   * them were not yet fading, and how many of those were lying, which the
   * trim counts as the lab's would, still holding them.
   */
  dropped: number;
  droppedHeld: number;
  droppedLying: number;
  /** Something moved, faded, came or went since the last pack. */
  changed: boolean;
  id: Float64Array;
  kind: Float64Array;
  x: Float64Array;
  y: Float64Array;
  /** Height above the card, points, and the speeds, points a second. */
  z: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  vz: Float64Array;
  /** Its turn on the card and its spin, radians; a chip's tumble and its rate. */
  rot: Float64Array;
  spin: Float64Array;
  flip: Float64Array;
  flipRate: Float64Array;
  size: Float64Array;
  /** A chip's corners, and the draw that picks its outline: a crumb's aspect's, a chip's first corner's. */
  sides: Float64Array;
  pick: Float64Array;
  /** Its colour, 0 to 255 a channel, its shade, and a dust grain's opacity. */
  r: Float64Array;
  g: Float64Array;
  b: Float64Array;
  shade: Float64Array;
  base: Float64Array;
  /** 1 for one that stays a while once landed. */
  stays: Float64Array;
  /** 1 once it lies on the card. */
  landed: Float64Array;
  /** When it begins to fade, on the pool's clock, Infinity until it lands. */
  fadeAt: Float64Array;
  alpha: Float64Array;
};

/** The coating's colours, one a point of the tray, row by row, three bytes each. */
export type ColourGrid = {
  width: number;
  height: number;
  rgb: Uint8Array;
};

/**
 * The flakes as the scratcher opened: the pool's slots, the most the device
 * keeps, and the atlas they are drawn from, its cells and their shapes.
 * See `flakePlanOf`.
 */
export type FlakePlan = {
  slots: number;
  cap: number;
  layout: FlakeLayout;
  shapes: FlakeShape[];
};

/** The device classes `FLAKES.cap.devices` holds a most for. */
export type FlakeDevice = keyof FlakeTuning['cap']['devices'];

/** A pool of `slots`, empty, its numbers drawn from `seed`. */
export function makeFlakes(slots: number, seed: number): FlakePool {
  'worklet';
  const n = Math.max(1, Math.floor(slots));
  return {
    slots: n,
    start: 0,
    count: 0,
    clock: 0,
    seed: seed >>> 0,
    born: 0,
    dropped: 0,
    droppedHeld: 0,
    droppedLying: 0,
    changed: false,
    id: new Float64Array(n),
    kind: new Float64Array(n),
    x: new Float64Array(n),
    y: new Float64Array(n),
    z: new Float64Array(n),
    vx: new Float64Array(n),
    vy: new Float64Array(n),
    vz: new Float64Array(n),
    rot: new Float64Array(n),
    spin: new Float64Array(n),
    flip: new Float64Array(n),
    flipRate: new Float64Array(n),
    size: new Float64Array(n),
    sides: new Float64Array(n),
    pick: new Float64Array(n),
    r: new Float64Array(n),
    g: new Float64Array(n),
    b: new Float64Array(n),
    shade: new Float64Array(n),
    base: new Float64Array(n),
    stays: new Float64Array(n),
    landed: new Float64Array(n),
    fadeAt: new Float64Array(n),
    alpha: new Float64Array(n),
  };
}

/**
 * The pool's slots for the tuning as it stands, as the scratcher opens:
 * `cap.hard` times the most there may be, `pMax` or the device's `cap`,
 * whichever is fewer.
 */
export function flakeSlots(flakes: FlakeTuning, cap: number): number {
  return Math.max(
    1,
    Math.round(flakes.cap.hard * Math.max(0, Math.min(flakes.pMax, cap))),
  );
}

/**
 * The pool's own random numbers, 0 up to 1: mulberry32, as the lab's traces
 * draw theirs, so a stream set to the count a trace drew plays it back.
 */
export function flakeRandom(pool: FlakePool): number {
  'worklet';
  pool.seed = (pool.seed + 0x6d2b79f5) >>> 0;
  let t = pool.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A number from `least` up to `most`, as the lab's `rnd`. */
function between(pool: FlakePool, least: number, most: number): number {
  'worklet';
  return least + flakeRandom(pool) * (most - least);
}

/** Where the pool's `i`th flake, from its oldest, is kept. */
function slotOf(pool: FlakePool, i: number): number {
  'worklet';
  return (pool.start + i) % pool.slots;
}

/** Every number of the flake kept at `from`, kept at `to`. */
function moveFlake(pool: FlakePool, from: number, to: number): void {
  'worklet';
  pool.id[to] = pool.id[from]!;
  pool.kind[to] = pool.kind[from]!;
  pool.x[to] = pool.x[from]!;
  pool.y[to] = pool.y[from]!;
  pool.z[to] = pool.z[from]!;
  pool.vx[to] = pool.vx[from]!;
  pool.vy[to] = pool.vy[from]!;
  pool.vz[to] = pool.vz[from]!;
  pool.rot[to] = pool.rot[from]!;
  pool.spin[to] = pool.spin[from]!;
  pool.flip[to] = pool.flip[from]!;
  pool.flipRate[to] = pool.flipRate[from]!;
  pool.size[to] = pool.size[from]!;
  pool.sides[to] = pool.sides[from]!;
  pool.pick[to] = pool.pick[from]!;
  pool.r[to] = pool.r[from]!;
  pool.g[to] = pool.g[from]!;
  pool.b[to] = pool.b[from]!;
  pool.shade[to] = pool.shade[from]!;
  pool.base[to] = pool.base[from]!;
  pool.stays[to] = pool.stays[from]!;
  pool.landed[to] = pool.landed[from]!;
  pool.fadeAt[to] = pool.fadeAt[from]!;
  pool.alpha[to] = pool.alpha[from]!;
}

/** Every flake gone at once, as a new card comes; the clock and the numbers run on. */
export function clearFlakes(pool: FlakePool): void {
  'worklet';
  if (pool.count > 0) pool.changed = true;
  pool.start = 0;
  pool.count = 0;
  pool.dropped = 0;
  pool.droppedHeld = 0;
  pool.droppedLying = 0;
}

/** Whether the pool still wants frames: any flake left. */
export function flakesBusy(pool: FlakePool): boolean {
  'worklet';
  return pool.count > 0;
}

/** The most there may be on the card now: `pMax`, or the device's `cap`, whichever is fewer. */
function mostOf(flakes: FlakeTuning, cap: number): number {
  'worklet';
  return Math.min(flakes.pMax, cap);
}

/**
 * The lab's cap, after every segment's flakes: those already fading are on
 * their way out, so while the rest are more than `pMax`, as many of the
 * oldest lying ones as there are too many start fading now, those a full
 * pool let go of first, as the lab still holds them then, and the others
 * stay; past `cap.hard` times it, the fading counted, the oldest go at once.
 */
export function trimFlakes(
  pool: FlakePool,
  flakes: FlakeTuning,
  cap: number,
): void {
  'worklet';
  const most = mostOf(flakes, cap);
  let held = pool.droppedHeld;
  for (let i = 0; i < pool.count; i++) {
    if (pool.fadeAt[slotOf(pool, i)]! > pool.clock) held++;
  }
  const over = held - most;
  if (over > 0) {
    let left = over - Math.min(over, pool.droppedLying);
    for (let i = 0; i < pool.count && left > 0; i++) {
      const at = slotOf(pool, i);
      if (pool.landed[at] === 1 && pool.fadeAt[at]! > pool.clock) {
        pool.fadeAt[at] = pool.clock;
        left--;
      }
    }
  }
  if (pool.count + pool.dropped > most * flakes.cap.hard) {
    const keep = Math.round(most * flakes.cap.hard);
    if (pool.count > keep) {
      pool.start = slotOf(pool, pool.count - keep);
      pool.count = keep;
      pool.changed = true;
    }
  }
  pool.dropped = 0;
  pool.droppedHeld = 0;
  pool.droppedLying = 0;
}

/**
 * The coin passing from (`ax`, `ay`) to (`bx`, `by`), the brush `brush`
 * points round, the finger moving at `speed` points a second, sweeps what
 * lies within reach of that segment ahead and away from its line: each
 * flies again, its push the finger's speed times `sweep.perSpeed` held to
 * `sweep.push`, so it lands again later. As the lab's, before each
 * segment's flakes are thrown.
 */
export function sweepFlakes(
  pool: FlakePool,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  flakes: FlakeTuning,
  brush: number,
  speed: number,
): void {
  'worklet';
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (!flakes.pOn || flakes.pSweep <= 0 || dist <= 0.01 || pool.count === 0) {
    return;
  }
  const sw = flakes.sweep;
  const len2 = dx * dx + dy * dy;
  const len = Math.sqrt(len2);
  const ux = dx / len;
  const uy = dy / len;
  const reach = brush * sw.reach;
  const push =
    Math.min(sw.push[1]!, Math.max(sw.push[0]!, speed * sw.perSpeed)) *
    flakes.pSweep;
  for (let i = 0; i < pool.count; i++) {
    const at = slotOf(pool, i);
    if (pool.landed[at] !== 1 || pool.fadeAt[at]! <= pool.clock) continue;
    const x = pool.x[at]!;
    const y = pool.y[at]!;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    const ex = x - (ax + dx * t);
    const ey = y - (ay + dy * t);
    if (ex * ex + ey * ey > reach * reach) continue;
    const side =
      Math.sign(-ex * uy + ey * ux) || (flakeRandom(pool) < 0.5 ? -1 : 1);
    const v = push * between(pool, sw.speed[0]!, sw.speed[1]!);
    const out = v * between(pool, sw.out[0]!, sw.out[1]!);
    pool.vx[at] = ux * v * sw.ahead - uy * side * out;
    pool.vy[at] = uy * v * sw.ahead + ux * side * out;
    pool.vz[at] =
      between(pool, sw.vz[0]!, sw.vz[1]!) *
      flakes.pSweep *
      (pool.kind[at] === DUST ? sw.dustVz : 1);
    pool.z[at] = sw.z;
    pool.landed[at] = 0;
    pool.fadeAt[at] = Infinity;
    pool.changed = true;
  }
}

/**
 * The flakes a segment of a stroke throws, from (`ax`, `ay`) to (`bx`,
 * `by`), the brush `brush` points round, as the lab's: `spawn.perPoint`
 * times `pAmount` a point of it, each from a point along it out round the
 * brush, none outside the tray's `width` by `height`, coloured by `grid`,
 * the coating's, where it starts; then the lab's cap, the device's `cap`
 * at most. Every number the lab draws for one is drawn, in its order, its
 * outline's among them, which pick the outline the atlas draws it with.
 */
export function spawnFlakes(
  pool: FlakePool,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  flakes: FlakeTuning,
  brush: number,
  width: number,
  height: number,
  grid: ColourGrid | null,
  cap: number,
): void {
  'worklet';
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (!flakes.pOn || flakes.pAmount <= 0 || dist <= 0) return;
  const sp = flakes.spawn;
  const count = dist * sp.perPoint * flakes.pAmount;
  let n = Math.floor(count);
  if (flakeRandom(pool) < count - n) n++;
  const dir = Math.atan2(by - ay, bx - ax);
  const spread = (flakes.pSpread * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const t = flakeRandom(pool);
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    // From round the scratch's edge, mostly ahead and to the sides.
    const edge = between(pool, 0, Math.PI * 2);
    const px =
      x + Math.cos(edge) * brush * between(pool, sp.ring[0]!, sp.ring[1]!);
    const py =
      y + Math.sin(edge) * brush * between(pool, sp.ring[0]!, sp.ring[1]!);
    if (px < 0 || px > width || py < 0 || py > height) continue;
    const kind =
      flakeRandom(pool) * 100 < flakes.pDust
        ? DUST
        : flakeRandom(pool) * 100 < flakes.pCrumb
          ? CRUMB
          : CHIP;
    // A few kick back behind the coin, the rest fan out ahead.
    const back = flakeRandom(pool) < sp.backShare;
    const ang =
      (back ? dir + Math.PI : dir) +
      (flakeRandom(pool) < 0.5 ? -1 : 1) *
        spread *
        Math.pow(flakeRandom(pool), sp.spreadPower);
    const heavy =
      kind === CRUMB
        ? sp.heavy.crumb
        : kind === DUST
          ? sp.heavy.dust
          : sp.heavy.chip;
    const speed =
      between(pool, sp.speed[0]!, sp.speed[1]!) *
      flakes.pSpeed *
      (back ? sp.backSpeed : 1) *
      heavy;
    const size =
      kind === DUST
        ? between(pool, sp.size.dust[0]!, sp.size.dust[1]!) * flakes.pSize
        : kind === CRUMB
          ? between(pool, sp.size.crumb[0]!, sp.size.crumb[1]!) * flakes.pSize
          : between(pool, sp.size.chip[0]!, sp.size.chip[1]!) *
            flakes.pSize *
            (flakeRandom(pool) < sp.chipSmall.share ? sp.chipSmall.scale : 1);
    const hop =
      kind === DUST ? sp.hop.dust : kind === CRUMB ? sp.hop.crumb : sp.hop.chip;
    const z = between(pool, sp.z[0]!, sp.z[1]!) * hop;
    const vz =
      between(pool, sp.vz[0]!, sp.vz[1]!) *
      Math.max(sp.vzFloor, flakes.pSpeed) *
      hop;
    // A crumb rolls across the stroke; the others turn any way.
    const rot =
      kind === CRUMB
        ? dir + Math.PI / 2 + between(pool, -sp.crumbRoll, sp.crumbRoll)
        : between(pool, 0, Math.PI * 2);
    const spin =
      kind === CRUMB
        ? between(pool, -sp.spin.crumb, sp.spin.crumb)
        : between(pool, -sp.spin.other, sp.spin.other);
    const flip = between(pool, 0, Math.PI * 2);
    const flipRate =
      kind === CHIP ? between(pool, -sp.flipRate, sp.flipRate) : 0;
    // The outline, as the lab draws one: its aspect and radii for a crumb,
    // its corners for a chip. The atlas has a few of each, so the draws pick
    // one: a crumb's by its aspect, a chip's by its corners and its first.
    let sides = 0;
    let pick = 0;
    if (kind === CRUMB) {
      pick = flakeRandom(pool);
      for (let k = 0; k < sp.crumbPoints; k++) flakeRandom(pool);
    } else if (kind === CHIP) {
      const least = sp.chipSides[0]!;
      sides =
        least + Math.floor(flakeRandom(pool) * (sp.chipSides[1]! - least + 1));
      for (let k = 0; k < sides; k++) {
        const jitter = flakeRandom(pool);
        if (k === 0) pick = jitter;
        flakeRandom(pool);
        flakeRandom(pool);
      }
    }
    const shade = between(pool, sp.shade[0]!, sp.shade[1]!);
    const base =
      kind === DUST ? between(pool, sp.dustBase[0]!, sp.dustBase[1]!) : 1;
    const stays =
      flakeRandom(pool) * 100 <
      (kind === DUST ? flakes.pStay * sp.dustStay : flakes.pStay);

    // The coating's colour where it starts, one a point, as the lab reads it.
    const share =
      kind === DUST
        ? sp.colour.dust
        : kind === CRUMB
          ? sp.colour.crumb
          : sp.colour.chip;
    let red = sp.fallback[0]!;
    let green = sp.fallback[1]!;
    let blue = sp.fallback[2]!;
    if (grid !== null && grid.width > 0 && grid.height > 0) {
      const cx = Math.max(0, Math.min(grid.width - 1, Math.round(px)));
      const cy = Math.max(0, Math.min(grid.height - 1, Math.round(py)));
      const c = (cy * grid.width + cx) * 3;
      red = grid.rgb[c]!;
      green = grid.rgb[c + 1]!;
      blue = grid.rgb[c + 2]!;
    }

    // Born last, the newest; a full pool lets its oldest go for it.
    let at: number;
    if (pool.count < pool.slots) {
      at = slotOf(pool, pool.count);
      pool.count++;
    } else {
      at = pool.start;
      pool.dropped++;
      if (pool.fadeAt[at]! > pool.clock) {
        pool.droppedHeld++;
        if (pool.landed[at] === 1) pool.droppedLying++;
      }
      pool.start = (pool.start + 1) % pool.slots;
    }
    pool.id[at] = pool.born;
    pool.born++;
    pool.kind[at] = kind;
    pool.x[at] = px;
    pool.y[at] = py;
    pool.z[at] = z;
    pool.vx[at] = Math.cos(ang) * speed;
    pool.vy[at] = Math.sin(ang) * speed;
    pool.vz[at] = vz;
    pool.rot[at] = rot;
    pool.spin[at] = spin;
    pool.flip[at] = flip;
    pool.flipRate[at] = flipRate;
    pool.size[at] = size;
    pool.sides[at] = sides;
    pool.pick[at] = pick;
    pool.r[at] = red * share;
    pool.g[at] = green * share;
    pool.b[at] = blue * share;
    pool.shade[at] = shade;
    pool.base[at] = base;
    pool.stays[at] = stays ? 1 : 0;
    pool.landed[at] = 0;
    pool.fadeAt[at] = Infinity;
    pool.alpha[at] = 1;
    pool.changed = true;
  }
  trimFlakes(pool, flakes, cap);
}

/**
 * One segment of a stroke, from (`ax`, `ay`) to (`bx`, `by`), the finger
 * moving at `speed` points a second, in the lab's order: the coin sweeps
 * what lies in its way, then throws the segment's flakes, then the cap.
 * See `sweepFlakes` and `spawnFlakes`.
 */
export function strokeFlakes(
  pool: FlakePool,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  flakes: FlakeTuning,
  brush: number,
  width: number,
  height: number,
  grid: ColourGrid | null,
  cap: number,
  speed: number,
): void {
  'worklet';
  sweepFlakes(pool, ax, ay, bx, by, flakes, brush, speed);
  spawnFlakes(pool, ax, ay, bx, by, flakes, brush, width, height, grid, cap);
}

/**
 * One of the lab's steps, `dt` seconds on, the newest flake first, as the
 * lab steps its array: in the air each falls, flies, spins and tumbles,
 * and as it reaches the card bounces or lands, a landing drawing when it
 * begins to fade; lying, it slides and spins to a stop; past its time it
 * fades, and goes once faded.
 */
export function stepFlakes(
  pool: FlakePool,
  dt: number,
  flakes: FlakeTuning,
): void {
  'worklet';
  pool.clock += dt;
  if (pool.count === 0) return;
  const clock = pool.clock;
  const ph = flakes.physics;
  const fall = ph.gravity * dt;
  const friction = Math.exp(-ph.friction * dt);
  const still = ph.restSpeed * ph.restSpeed;
  let gone = 0;
  let moved = false;
  for (let i = pool.count - 1; i >= 0; i--) {
    const at = slotOf(pool, i);
    if (pool.landed[at] === 0) {
      moved = true;
      pool.vz[at] = pool.vz[at]! - fall;
      pool.z[at] = pool.z[at]! + pool.vz[at] * dt;
      pool.x[at] = pool.x[at]! + pool.vx[at]! * dt;
      pool.y[at] = pool.y[at]! + pool.vy[at]! * dt;
      pool.rot[at] = pool.rot[at]! + pool.spin[at]! * dt;
      pool.flip[at] = pool.flip[at]! + pool.flipRate[at]! * dt;
      if (pool.z[at] <= 0) {
        pool.z[at] = 0;
        if (pool.vz[at] < -ph.bounceBelow) {
          // A bounce: it loses most of its speed.
          pool.vz[at] = -pool.vz[at] * ph.bounceKeep;
          pool.vx[at] = pool.vx[at]! * ph.bounceSlide;
          pool.vy[at] = pool.vy[at]! * ph.bounceSlide;
          pool.spin[at] = pool.spin[at]! * ph.bounceSpin;
          pool.flipRate[at] = pool.flipRate[at]! * ph.bounceFlip;
        } else {
          pool.landed[at] = 1;
          pool.vz[at] = 0;
          pool.fadeAt[at] =
            pool.stays[at] === 1
              ? clock +
                flakes.pStayTime * between(pool, ph.stayFor[0]!, ph.stayFor[1]!)
              : clock + between(pool, ph.goAfter[0]!, ph.goAfter[1]!);
        }
      }
    } else if (pool.vx[at] !== 0 || pool.vy[at] !== 0 || pool.spin[at] !== 0) {
      moved = true;
      pool.vx[at] = pool.vx[at]! * friction;
      pool.vy[at] = pool.vy[at]! * friction;
      pool.spin[at] = pool.spin[at]! * friction;
      pool.x[at] = pool.x[at]! + pool.vx[at] * dt;
      pool.y[at] = pool.y[at]! + pool.vy[at] * dt;
      pool.rot[at] = pool.rot[at]! + pool.spin[at] * dt;
      const vx = pool.vx[at];
      const vy = pool.vy[at];
      if (vx * vx + vy * vy < still) {
        pool.vx[at] = 0;
        pool.vy[at] = 0;
        pool.spin[at] = 0;
      }
    }
    if (clock >= pool.fadeAt[at]!) {
      moved = true;
      pool.alpha[at] =
        1 -
        (clock - pool.fadeAt[at]!) /
          (pool.stays[at] === 1 ? ph.stayFade : ph.goFade);
      if (pool.alpha[at] <= 0) gone++;
    }
  }
  // The faded go, the rest kept in the order they were born.
  if (gone > 0) {
    let kept = 0;
    for (let i = 0; i < pool.count; i++) {
      const from = slotOf(pool, i);
      if (pool.alpha[from]! <= 0) continue;
      if (kept !== i) moveFlake(pool, from, slotOf(pool, kept));
      kept++;
    }
    pool.count = kept;
  }
  if (moved) pool.changed = true;
}

/** Floats a sprite in a packed frame: its RSXform's four, its atlas cell, then its r, g, b and a, 0 to 1. */
export const FLAKE_STRIDE = 9;

/** The sprites a flake of `kind` draws: a grain; a crumb's shadow, body and lit top; a chip's shadow and body. */
function spritesOf(kind: number): number {
  'worklet';
  return kind === DUST ? 1 : kind === CRUMB ? 3 : 2;
}

/**
 * One sprite at `s` into `frame`: atlas cell `cell` of `layout`, its middle
 * at (`x`, `y`), `scale` points an outline unit, turned `turn` radians, in
 * `r`, `g`, `b` of 255 at `alpha`.
 */
function putSprite(
  frame: Float32Array,
  s: number,
  layout: FlakeLayout,
  cell: number,
  x: number,
  y: number,
  scale: number,
  turn: number,
  r: number,
  g: number,
  b: number,
  alpha: number,
): void {
  'worklet';
  // Points a texel, and the cell's middle, texels from its corner.
  const k = scale / layout.unitPx;
  const half = layout.cellPx / 2;
  const scos = k * Math.cos(turn);
  const ssin = k * Math.sin(turn);
  const f = s * FLAKE_STRIDE;
  frame[f] = scos;
  frame[f + 1] = ssin;
  frame[f + 2] = x - (scos * half - ssin * half);
  frame[f + 3] = y - (ssin * half + scos * half);
  frame[f + 4] = cell;
  frame[f + 5] = r / 255;
  frame[f + 6] = g / 255;
  frame[f + 7] = b / 255;
  frame[f + 8] = alpha;
}

/** A channel as the lab's canvas takes it: truncated, 255 at most. */
function channel(value: number): number {
  'worklet';
  return Math.floor(Math.min(255, value));
}

/**
 * The live flakes as the hand's atlas draws them, a new buffer whenever
 * they change: `FLAKE_STRIDE` floats a sprite, in the lab's order, every
 * shadow first, then every body, each in the order the flakes were born.
 * A shadow lies on the card, the further off and the fainter the higher
 * its flake flies, a crumb's turned with it; a body is lifted by its
 * height; a crumb is its darker body and its lit top; a chip tumbling in
 * the air squashes and glints as it turns.
 */
export function packFlakes(
  pool: FlakePool,
  flakes: FlakeTuning,
  layout: FlakeLayout,
): Float32Array {
  'worklet';
  const d = flakes.draw;
  let sprites = 0;
  for (let i = 0; i < pool.count; i++) {
    sprites += spritesOf(pool.kind[slotOf(pool, i)]!);
  }
  const frame = new Float32Array(sprites * FLAKE_STRIDE);
  let s = 0;
  for (let i = 0; i < pool.count; i++) {
    const at = slotOf(pool, i);
    const kind = pool.kind[at]!;
    if (kind === DUST) continue;
    const z = pool.z[at]!;
    const alpha =
      d.shadowAlpha *
      pool.alpha[at]! *
      Math.max(d.shadowFloor, 1 - z / d.shadowFade);
    putSprite(
      frame,
      s,
      layout,
      kind === CRUMB ? layout.crumbShadow : layout.chipShadow,
      pool.x[at]! + d.shadowOffset[0]! + z * d.shadowLift[0]!,
      pool.y[at]! + d.shadowOffset[1]! + z * d.shadowLift[1]!,
      pool.size[at]!,
      kind === CRUMB ? pool.rot[at]! : 0,
      0,
      0,
      0,
      alpha,
    );
    s++;
  }
  const levels = layout.squashLevels;
  for (let i = 0; i < pool.count; i++) {
    const at = slotOf(pool, i);
    const kind = pool.kind[at]!;
    const x = pool.x[at]!;
    const y = pool.y[at]! - pool.z[at]! * d.lift;
    const size = pool.size[at]!;
    const alpha = pool.alpha[at]!;
    const r = pool.r[at]!;
    const g = pool.g[at]!;
    const b = pool.b[at]!;
    if (kind === DUST) {
      putSprite(
        frame,
        s++,
        layout,
        layout.dust,
        x,
        y,
        size,
        0,
        channel(r),
        channel(g),
        channel(b),
        alpha * pool.base[at]!,
      );
      continue;
    }
    const rot = pool.rot[at]!;
    const shade = pool.shade[at]!;
    if (kind === CRUMB) {
      const outline =
        layout.crumb +
        Math.min(layout.crumbs - 1, Math.floor(pool.pick[at]! * layout.crumbs));
      putSprite(
        frame,
        s++,
        layout,
        outline,
        x,
        y,
        size,
        rot,
        channel(r * d.crumbBody * shade),
        channel(g * d.crumbBody * shade),
        channel(b * d.crumbBody * shade),
        alpha,
      );
      const gain = d.highlight.gain;
      putSprite(
        frame,
        s++,
        layout,
        layout.highlight,
        x,
        y,
        size,
        rot,
        channel(r * gain[0]!),
        channel(g * gain[1]!),
        channel(b * gain[2]!),
        alpha * d.highlight.alpha,
      );
      continue;
    }
    // A chip in the air tumbles, catching the light as it turns; one lying is still.
    const tumbling = pool.landed[at] === 0;
    const turned = Math.abs(Math.cos(pool.flip[at]!));
    const glint = tumbling
      ? shade * (d.glint[0]! + d.glint[1]! * turned)
      : shade;
    const squash = tumbling ? d.tumble[0]! + d.tumble[1]! * turned : 1;
    const span = layout.squashTo - layout.squashFrom;
    const level =
      levels <= 1 || !(span > 0)
        ? levels - 1
        : Math.max(
            0,
            Math.min(
              levels - 1,
              Math.round(((squash - layout.squashFrom) / span) * (levels - 1)),
            ),
          );
    const sideCount = layout.sidesTo - layout.sidesFrom + 1;
    const side = Math.max(
      0,
      Math.min(sideCount - 1, pool.sides[at]! - layout.sidesFrom),
    );
    const sub = Math.min(
      layout.chipsPerSides - 1,
      Math.floor(pool.pick[at]! * layout.chipsPerSides),
    );
    putSprite(
      frame,
      s++,
      layout,
      layout.chip + ((side * layout.chipsPerSides + sub) * levels + level),
      x,
      y,
      size,
      rot,
      channel(r * glint),
      channel(g * glint),
      channel(b * glint),
      alpha,
    );
  }
  return frame;
}
