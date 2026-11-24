import type { CellBox, CellZones, ReadingZone } from './coverage';

/**
 * What the finger has scratched off a tray, as one byte a board point: a
 * signed distance field the UI thread stamps and the canvas uploads as an
 * alpha image for the reveal shader to read, and the counts it keeps as it
 * goes, per cell and per reading zone, which are how far each is scratched.
 * Nothing here touches Skia, so it all runs under node as it does on the UI
 * thread.
 *
 * A texel holds the distance from its centre to the nearest point the brush
 * has covered, `d`, negative inside, coded as `127.5 + d * 127.5 / REACH`
 * and clamped to a byte: 255 is untouched, below 128 is scratched, 0 is deep
 * inside a stroke. A stamp writes the smaller of the code there and its own,
 * which is the exact distance to the union of everything stamped, so a
 * stamp costs what its own patch of texels costs, however long the card has
 * been scratched.
 */

/** How far either side of the edge the code spans, board points: the shader's `D`. */
export const MASK_REACH = 8;

/** A code below this is scratched: the brush has been over the texel's centre. */
export const SCRATCHED_BELOW = 128;

/** An untouched texel's code. */
export const UNTOUCHED = 255;

export type Mask = {
  /** Texels across and down, one a board point, from the tray's top-left corner. */
  width: number;
  height: number;
  /**
   * Each texel's code, row by row: its own buffer, never a view of a larger
   * one, since native Skia copies the whole buffer a typed array sits on.
   */
  codes: Uint8Array;
  /** Each texel's cell, by index, or -1 for a texel in no cell. */
  cellOf: Int8Array;
  /** The texels each cell holds. */
  texels: number[];
  /** The texels of each cell scratched so far. */
  scratched: number[];
  /**
   * Each texel's reading zone, by index, or -1 for a texel in none: each
   * cell's zones in grid order, its symbol's and then its value's, one for
   * each character it prints. See `CellZones`.
   */
  zoneOf: Int8Array;
  /** Each cell's symbol zone, by index. */
  symbolZone: number[];
  /** The texels each zone holds: none for a zone off the tray, or past the last index a texel holds. */
  zoneTexels: number[];
  /** The texels of each zone scratched so far. */
  zoneScratched: number[];
};

/** The code for a distance `d` from the scratched area, board points. */
export function encodeDistance(d: number): number {
  'worklet';
  const code = 127.5 + (d * 127.5) / MASK_REACH;
  if (code <= 0) return 0;
  if (code >= 255) return 255;
  return Math.floor(code + 0.5);
}

/** The distance a `code` stands for, board points: what the shader reads back. */
export function decodeCode(code: number): number {
  'worklet';
  return ((code - 127.5) * MASK_REACH) / 127.5;
}

/**
 * Marks `index` in `of`, a `w` by `h` texel grid, at every texel whose
 * centre lies inside `box`, and returns how many it marked.
 */
function markBox(
  of: Int8Array,
  w: number,
  h: number,
  box: CellBox,
  index: number,
): number {
  'worklet';
  const i0 = Math.max(0, Math.ceil(box.left - 0.5));
  const i1 = Math.min(w - 1, Math.ceil(box.left + box.width - 0.5) - 1);
  const j0 = Math.max(0, Math.ceil(box.top - 0.5));
  const j1 = Math.min(h - 1, Math.ceil(box.top + box.height - 0.5) - 1);
  let count = 0;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      of[j * w + i] = index;
      count++;
    }
  }
  return count;
}

/**
 * Marks `index` in `of`, a `w` by `h` texel grid, at every texel of `runs`,
 * [row, first, last, ...] of whole texels, each run held to the grid, and
 * returns how many it marked.
 */
function markRuns(
  of: Int8Array,
  w: number,
  h: number,
  runs: readonly number[],
  index: number,
): number {
  'worklet';
  let count = 0;
  for (let r = 0; r + 2 < runs.length; r += 3) {
    const j = runs[r]!;
    if (j < 0 || j >= h) continue;
    const i0 = Math.max(0, runs[r + 1]!);
    const i1 = Math.min(w - 1, runs[r + 2]!);
    for (let i = i0; i <= i1; i++) {
      of[j * w + i] = index;
      count++;
    }
  }
  return count;
}

/** Marks `index` in `of`, a `w` by `h` texel grid, where `zone` lies: its texels where it has them, else its box. */
function markZone(
  of: Int8Array,
  w: number,
  h: number,
  zone: ReadingZone,
  index: number,
): number {
  'worklet';
  const texels = zone.texels;
  if (texels !== undefined && texels.length > 0) {
    return markRuns(of, w, h, texels, index);
  }
  return markBox(of, w, h, zone, index);
}

/**
 * Lays the reading zones of `mask`'s cells, from `zones` in grid order,
 * over what it holds, and counts them again, what is scratched in each
 * included: each cell's symbol zone, or its whole box with none given,
 * then one zone for each of its value's characters. A zone with texels is
 * laid on them, one without on its box (see `ReadingZone`). Zones are
 * taken not to overlap; where two do, the texel is the later's. Indices
 * run to 126: a zone past them has no texels, and reads as read (see
 * `maskZoneShares`).
 */
function layZones(
  mask: Mask,
  cells: readonly CellBox[],
  zones: readonly CellZones[] | undefined,
): void {
  'worklet';
  const { width: w, height: h, zoneOf, codes } = mask;
  zoneOf.fill(-1);
  const symbolZone: number[] = [];
  let z = 0;
  for (let c = 0; c < mask.texels.length; c++) {
    const zone = zones !== undefined ? zones[c] : undefined;
    symbolZone.push(z);
    if (z < 127) {
      markZone(zoneOf, w, h, zone !== undefined ? zone.symbol : cells[c]!, z);
    }
    z++;
    const value = zone !== undefined ? zone.value : undefined;
    if (value === undefined) continue;
    for (let g = 0; g < value.length; g++) {
      if (z < 127) markZone(zoneOf, w, h, value[g]!, z);
      z++;
    }
  }
  const zoneTexels: number[] = [];
  const zoneScratched: number[] = [];
  for (let i = 0; i < z; i++) {
    zoneTexels.push(0);
    zoneScratched.push(0);
  }
  // Counted once every zone is laid, so a texel is counted for the zone it
  // ended up in.
  for (let t = 0; t < zoneOf.length; t++) {
    const at = zoneOf[t]!;
    if (at < 0) continue;
    zoneTexels[at] = zoneTexels[at]! + 1;
    if (codes[t]! < SCRATCHED_BELOW) zoneScratched[at] = zoneScratched[at]! + 1;
  }
  mask.symbolZone = symbolZone;
  mask.zoneTexels = zoneTexels;
  mask.zoneScratched = zoneScratched;
}

/**
 * The mask over a tray `width` by `height` points with `cells`, nothing
 * scratched: a texel a point, the last row and column covering what is left
 * of a fractional size. A texel is a cell's when its centre lies inside it,
 * and a reading zone's the same way: see `layZones`. A cell past the 127th
 * has no texels.
 */
export function makeMask(
  width: number,
  height: number,
  cells: readonly CellBox[],
  zones?: readonly CellZones[],
): Mask {
  'worklet';
  const w = Math.max(1, Math.ceil(width - 1e-6));
  const h = Math.max(1, Math.ceil(height - 1e-6));
  const codes = new Uint8Array(w * h);
  codes.fill(UNTOUCHED);
  const cellOf = new Int8Array(w * h);
  cellOf.fill(-1);
  const texels: number[] = [];
  const scratched: number[] = [];
  for (let c = 0; c < cells.length && c < 127; c++) {
    texels.push(markBox(cellOf, w, h, cells[c]!, c));
    scratched.push(0);
  }
  const mask: Mask = {
    width: w,
    height: h,
    codes,
    cellOf,
    texels,
    scratched,
    zoneOf: new Int8Array(w * h),
    symbolZone: [],
    zoneTexels: [],
    zoneScratched: [],
  };
  layZones(mask, cells, zones);
  return mask;
}

/**
 * The reading zones of a mask made for `cells` laid again from `zones`, in
 * place: what is scratched stays, and is counted for the new zones. For a
 * new card, whose symbols and values are read where they print.
 */
export function rezoneMask(
  mask: Mask,
  cells: readonly CellBox[],
  zones: readonly CellZones[] | undefined,
): void {
  'worklet';
  layZones(mask, cells, zones);
}

/** Nothing scratched again, in place. */
export function clearMask(mask: Mask): void {
  'worklet';
  mask.codes.fill(UNTOUCHED);
  for (let c = 0; c < mask.scratched.length; c++) mask.scratched[c] = 0;
  for (let z = 0; z < mask.zoneScratched.length; z++) {
    mask.zoneScratched[z] = 0;
  }
}

/**
 * Texel `t`'s code lowered to `code`, in place, unless it is that low
 * already: the one place a code is lowered, so the texel's cell and its zone
 * each count it as scratched once, as it first drops below
 * `SCRATCHED_BELOW`. Returns whether it lowered the code.
 */
export function lowerTexel(mask: Mask, t: number, code: number): boolean {
  'worklet';
  const old = mask.codes[t]!;
  if (code >= old) return false;
  mask.codes[t] = code;
  if (old >= SCRATCHED_BELOW && code < SCRATCHED_BELOW) {
    const c = mask.cellOf[t]!;
    if (c >= 0) mask.scratched[c] = mask.scratched[c]! + 1;
    const z = mask.zoneOf[t]!;
    if (z >= 0) mask.zoneScratched[z] = mask.zoneScratched[z]! + 1;
  }
  return true;
}

/**
 * Stamps the brush of `radius` dragged from (`x0`, `y0`) to (`x1`, `y1`), a
 * capsule, or a disc where the two ends are one point, in place. Returns how
 * many texels' codes it lowered, so a frame knows whether to upload the mask
 * again; the cells' and the zones' counts take every texel it scratched for
 * the first time.
 */
export function stampMask(
  mask: Mask,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
): number {
  'worklet';
  const { width, height, codes } = mask;
  const grow = radius + MASK_REACH;
  const i0 = Math.max(0, Math.floor(Math.min(x0, x1) - grow - 0.5));
  const i1 = Math.min(width - 1, Math.ceil(Math.max(x0, x1) + grow - 0.5));
  const j0 = Math.max(0, Math.floor(Math.min(y0, y1) - grow - 0.5));
  const j1 = Math.min(height - 1, Math.ceil(Math.max(y0, y1) + grow - 0.5));
  if (i0 > i1 || j0 > j1) return 0;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length2 = dx * dx + dy * dy;
  const scale = 127.5 / MASK_REACH;
  let lowered = 0;
  for (let j = j0; j <= j1; j++) {
    const py = j + 0.5;
    const row = j * width;
    for (let i = i0; i <= i1; i++) {
      const t = row + i;
      const old = codes[t]!;
      if (old === 0) continue;
      const px = i + 0.5;
      // The nearest point of the segment, by the texel's projection on it.
      let u = length2 > 0 ? ((px - x0) * dx + (py - y0) * dy) / length2 : 0;
      if (u < 0) u = 0;
      else if (u > 1) u = 1;
      const ex = x0 + u * dx - px;
      const ey = y0 + u * dy - py;
      const d = Math.sqrt(ex * ex + ey * ey) - radius;
      if (d >= MASK_REACH) continue;
      const raw = 127.5 + d * scale;
      const code = raw <= 0 ? 0 : Math.floor(raw + 0.5);
      if (code >= old) continue;
      lowerTexel(mask, t, code);
      lowered++;
    }
  }
  return lowered;
}

/** The code of the texel under (`x`, `y`); untouched outside the mask. */
export function codeAt(mask: Mask, x: number, y: number): number {
  'worklet';
  const i = Math.floor(x);
  const j = Math.floor(y);
  if (i < 0 || j < 0 || i >= mask.width || j >= mask.height) return UNTOUCHED;
  return mask.codes[j * mask.width + i]!;
}

/** Whether the brush has been over (`x`, `y`). */
export function scratchedAt(mask: Mask, x: number, y: number): boolean {
  'worklet';
  return codeAt(mask, x, y) < SCRATCHED_BELOW;
}

/**
 * The share of each cell scratched, 0 to 1, in grid order: of a mask's, or a
 * coverage's. A cell with no texels, off the tray, reads `empty`: 0, as
 * Quick Scratch's path has always read it, or 1, there being nothing of it
 * to scratch, as the finger's clean-up reads it.
 */
export function maskShares(
  mask: Pick<Mask, 'texels' | 'scratched'>,
  empty = 0,
): number[] {
  'worklet';
  const shares: number[] = [];
  for (let c = 0; c < mask.texels.length; c++) {
    const texels = mask.texels[c]!;
    shares.push(texels > 0 ? mask.scratched[c]! / texels : empty);
  }
  return shares;
}

/**
 * The share of each cell scratched, as `maskShares` reads it, with a press
 * of the brush of `radius` at (`x`, `y`) counted: every texel `stampMask`
 * would scratch there for the first time, by its own test, and the mask
 * itself left as it is. Quick Scratch's path reads its first frame by it
 * before it presses anything.
 */
export function maskSharesAfterPress(
  mask: Mask,
  x: number,
  y: number,
  radius: number,
): number[] {
  'worklet';
  const { width, height, codes, cellOf } = mask;
  const scratched = mask.scratched.slice();
  const i0 = Math.max(0, Math.floor(x - radius - 0.5));
  const i1 = Math.min(width - 1, Math.ceil(x + radius - 0.5));
  const j0 = Math.max(0, Math.floor(y - radius - 0.5));
  const j1 = Math.min(height - 1, Math.ceil(y + radius - 0.5));
  const scale = 127.5 / MASK_REACH;
  for (let j = j0; j <= j1; j++) {
    const py = j + 0.5;
    for (let i = i0; i <= i1; i++) {
      const t = j * width + i;
      const c = cellOf[t]!;
      if (c < 0 || codes[t]! < SCRATCHED_BELOW) continue;
      const ex = x - (i + 0.5);
      const ey = y - py;
      const d = Math.sqrt(ex * ex + ey * ey) - radius;
      const raw = 127.5 + d * scale;
      if ((raw <= 0 ? 0 : Math.floor(raw + 0.5)) >= SCRATCHED_BELOW) continue;
      scratched[c] = scratched[c]! + 1;
    }
  }
  return maskShares({ texels: mask.texels, scratched });
}

/**
 * The share of each reading zone scratched, 0 to 1, by zone: see `zoneOf`
 * and `symbolZone`. A zone with no texels, as a zone off the tray, reads 1:
 * there is nothing of it to scratch, and a box waiting on it would never
 * clear.
 */
export function maskZoneShares(mask: Mask): number[] {
  'worklet';
  const shares: number[] = [];
  for (let z = 0; z < mask.zoneTexels.length; z++) {
    const texels = mask.zoneTexels[z]!;
    shares.push(texels > 0 ? mask.zoneScratched[z]! / texels : 1);
  }
  return shares;
}

/**
 * Coverage alone, for timing what a path would reveal without drawing it:
 * which texels the brush has been over, a byte each, and the same counts per
 * cell as the mask keeps.
 */
export type Coverage = {
  width: number;
  height: number;
  /** 1 where the brush has been over the texel's centre. */
  hit: Uint8Array;
  cellOf: Int8Array;
  texels: number[];
  scratched: number[];
};

/** Coverage over the same texels and cells as `makeMask` lays out, nothing scratched. */
export function makeCoverage(
  width: number,
  height: number,
  cells: readonly CellBox[],
): Coverage {
  'worklet';
  const mask = makeMask(width, height, cells);
  return {
    width: mask.width,
    height: mask.height,
    hit: new Uint8Array(mask.width * mask.height),
    cellOf: mask.cellOf,
    texels: mask.texels,
    scratched: mask.scratched,
  };
}

/**
 * The brush of `radius` dragged from (`x0`, `y0`) to (`x1`, `y1`) over
 * `coverage`: every texel `stampMask` would code as scratched, by the same
 * test, its distance from the segment less the radius below 0, counted per
 * cell as the mask counts. Returns how many texels it newly scratched.
 */
export function stampCoverage(
  coverage: Coverage,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
): number {
  'worklet';
  const { width, height, hit, cellOf, scratched } = coverage;
  const i0 = Math.max(0, Math.floor(Math.min(x0, x1) - radius - 0.5));
  const i1 = Math.min(width - 1, Math.ceil(Math.max(x0, x1) + radius - 0.5));
  const j0 = Math.max(0, Math.floor(Math.min(y0, y1) - radius - 0.5));
  const j1 = Math.min(height - 1, Math.ceil(Math.max(y0, y1) + radius - 0.5));
  if (i0 > i1 || j0 > j1) return 0;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length2 = dx * dx + dy * dy;
  const scale = 127.5 / MASK_REACH;
  let newly = 0;
  for (let j = j0; j <= j1; j++) {
    const py = j + 0.5;
    const row = j * width;
    for (let i = i0; i <= i1; i++) {
      const t = row + i;
      if (hit[t] === 1) continue;
      const px = i + 0.5;
      let u = length2 > 0 ? ((px - x0) * dx + (py - y0) * dy) / length2 : 0;
      if (u < 0) u = 0;
      else if (u > 1) u = 1;
      const ex = x0 + u * dx - px;
      const ey = y0 + u * dy - py;
      const d = Math.sqrt(ex * ex + ey * ey) - radius;
      // The mask's own test: its code for `d` below 128.
      const raw = 127.5 + d * scale;
      if ((raw <= 0 ? 0 : Math.floor(raw + 0.5)) >= SCRATCHED_BELOW) continue;
      hit[t] = 1;
      newly++;
      const c = cellOf[t]!;
      if (c >= 0) scratched[c] = scratched[c]! + 1;
    }
  }
  return newly;
}
