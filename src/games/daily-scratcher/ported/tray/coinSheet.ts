/**
 * The turning coin's sheet, read as the Coin Lean Lab reads one: a
 * TexturePacker export, JSON (Hash) or JSON (Array), its frames taken in the
 * natural order of their names, every frame cut from one canvas, and each
 * flattened to numbers the UI thread can index; the pose the coin is drawn
 * in, checked against the sheet it is drawn from; and the transform that
 * draws a frame tilted about the point of the rim on the card. Nothing here
 * touches Skia or loads a file: see `skins/coinTables.ts`.
 */

/**
 * Numbers a frame takes in `CoinTable.frames`: its rect in the sheet, x and
 * y, its upright width and height, 1 if the packer turned it, and where its
 * trimmed rect sits on the frame's canvas, x and y. As vfx's sprite sheets
 * lay them out.
 */
export const FRAME_STRIDE = 7;

/** A sheet's frames, flattened: see `coinTableOf`. */
export type CoinTable = {
  count: number;
  /** The canvas every frame is cut from, px: the first frame's untrimmed size. */
  canvas: readonly [number, number];
  /** `FRAME_STRIDE` numbers a frame. */
  frames: readonly number[];
  /** Each frame's name in the export. */
  names: readonly string[];
};

/**
 * The canvas a pose is made for, px: as the Coin Lean Lab writes it,
 * `'500x500'`, or as a pair, `[500, 500]`; see `poseCanvas`.
 */
export type PoseCanvas = readonly number[] | string | null;

/** How the coin is posed in its sheet: `COIN_POSE`'s shape. */
export type CoinPose = {
  frames: number;
  canvas: PoseCanvas;
  contactPoint: readonly number[];
  faceHeightPx: number;
  angles: readonly (number | null)[];
  restFrame: number;
};

/** The parts of a pose the hand draws a frame by. */
export type DrawnPose = {
  /** The point of the rim on the card, frame px. */
  contactPoint: readonly [number, number];
  /** The face-on coin's height, px: `coinH` points. */
  faceHeightPx: number;
  /** The frame drawn when the coin does not turn. */
  restFrame: number;
  /** Whether the frames the tray picks may be drawn, or only `restFrame`. */
  turns: boolean;
};

/**
 * Where the lab's collator puts each printable ASCII character, comparing
 * names by their base letters: the space and the punctuation in the order
 * the Unicode collation's root gives them, then the digits, then the
 * letters, a capital with its small letter.
 */
const COLLATION =
  ' _-,;:!?.\'"()[]{}@*/\\&#%`^+<=>|~$0123456789abcdefghijklmnopqrstuvwxyz';

/** A piece of a name where `COLLATION` puts it: a digit run as a digit, a character past ASCII after them all, by its code. */
function collated(piece: string): number {
  const at = COLLATION.indexOf(/^\d/.test(piece) ? '0' : piece.toLowerCase());
  return at >= 0 ? at : COLLATION.length + piece.codePointAt(0)!;
}

/**
 * Names compared as the lab compares them, with an English browser's
 * collator, numeric and by base letters: digit runs as numbers, so
 * `coin_2` comes before `coin_10`, letters whatever their case, and spaces
 * and punctuation before digits and letters in the collator's own order,
 * so `coin_1` comes before `coin.png` and `coin_2` before `coin-1`. This
 * needs no `Intl`, which a phone's engine may lack, and orders any ASCII
 * names as the lab does; a character past ASCII goes after them, by its
 * code, where the collator reads an accent as its letter.
 */
export function naturalOrder(a: string, b: string): number {
  const pieces = (name: string) => name.match(/\d+|\D/g) ?? [];
  const x = pieces(a);
  const y = pieces(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const p = x[i]!;
    const q = y[i]!;
    const by =
      /^\d/.test(p) && /^\d/.test(q)
        ? Number(p) - Number(q)
        : collated(p) - collated(q);
    if (by !== 0) return by;
  }
  return x.length - y.length;
}

type Box = { x?: unknown; y?: unknown; w?: unknown; h?: unknown };
type RawFrame = {
  filename?: unknown;
  frame?: Box;
  rotated?: unknown;
  spriteSourceSize?: Box;
  sourceSize?: Box;
};

const finite = (...values: unknown[]): boolean =>
  values.every((value) => typeof value === 'number' && Number.isFinite(value));

/**
 * A TexturePacker export's frames, as the lab's `readAtlas` reads them:
 * from a JSON (Hash) by name or a JSON (Array) by `filename`, in natural
 * order; each frame's rect, whether it was turned, its trimmed rect's place
 * on its canvas (0, 0 untrimmed), and the canvas from the first frame's
 * `sourceSize` (its own size if it has none). Throws, saying what is wrong,
 * for an export with no frames or a frame with no rect.
 */
export function coinTableOf(json: unknown): CoinTable {
  const raw = (json as { frames?: unknown } | null)?.frames;
  if (raw === null || typeof raw !== 'object') {
    throw new Error(
      'the frame table has no "frames": export it from TexturePacker as JSON (Hash) or JSON (Array)',
    );
  }
  const list: [string, RawFrame][] = Array.isArray(raw)
    ? raw.map((frame: RawFrame | null) => [
        typeof frame?.filename === 'string' ? frame.filename : '',
        frame ?? {},
      ])
    : Object.entries(raw as Record<string, RawFrame>);
  if (list.length === 0) throw new Error('the frame table lists no frames');
  list.sort((a, b) => naturalOrder(a[0], b[0]));
  let canvas: [number, number] | null = null;
  const frames: number[] = [];
  for (const [name, frame] of list) {
    const rect = frame?.frame;
    if (!rect || !finite(rect.x, rect.y, rect.w, rect.h)) {
      throw new Error(`frame "${name}" has no frame rectangle`);
    }
    const { x, y, w, h } = rect as Record<'x' | 'y' | 'w' | 'h', number>;
    const trim = frame.spriteSourceSize;
    const at =
      trim && finite(trim.x, trim.y)
        ? (trim as Record<'x' | 'y', number>)
        : { x: 0, y: 0 };
    const source = frame.sourceSize;
    canvas ??=
      source && finite(source.w, source.h)
        ? [source.w as number, source.h as number]
        : [w, h];
    frames.push(x, y, w, h, frame.rotated === true ? 1 : 0, at.x, at.y);
  }
  return {
    count: list.length,
    canvas: canvas!,
    frames,
    names: list.map(([name]) => name),
  };
}

/** Frame `index`'s rect in the sheet as stored, x, y, width and height: a turned frame lies on its side. */
export function frameRegion(
  frames: readonly number[],
  index: number,
): [number, number, number, number] {
  'worklet';
  const o = index * FRAME_STRIDE;
  const w = frames[o + 2]!;
  const h = frames[o + 3]!;
  const turned = frames[o + 4] === 1;
  return [frames[o]!, frames[o + 1]!, turned ? h : w, turned ? w : h];
}

/**
 * The name of the first frame whose rect lies outside a sheet image of
 * `width` x `height` px, or null when all of them are inside: a table and
 * an image exported together, as the lab refuses any other pair.
 */
export function frameOutside(
  table: CoinTable,
  width: number,
  height: number,
): string | null {
  for (let i = 0; i < table.count; i++) {
    const [x, y, w, h] = frameRegion(table.frames, i);
    if (x < 0 || y < 0 || x + w > width || y + h > height) {
      return table.names[i] ?? String(i);
    }
  }
  return null;
}

/**
 * The canvas a pose names, [width, height] px: the lab's `'500x500'`, read
 * as the lab reads it, or a pair of numbers. Null for anything else, which
 * the lab takes as no canvas named, so a pose that fits any.
 */
export function poseCanvas(canvas: unknown): [number, number] | null {
  if (typeof canvas === 'string') {
    const size = /^\s*(\d+)\s*x\s*(\d+)\s*$/i.exec(canvas);
    return size ? [Number(size[1]), Number(size[2])] : null;
  }
  if (Array.isArray(canvas) && canvas.length === 2 && finite(...canvas)) {
    return [canvas[0] as number, canvas[1] as number];
  }
  return null;
}

/**
 * What `pose`'s lengths in pixels are scaled by to sit on `table`'s canvas:
 * 1 when it names none, or the sheet's own; the ratio for a canvas of the
 * same shape at another size, to within half a pixel, as the lab scales a
 * pose (the built-in coin's 500 x 500 pose on its sheet repacked at 0.55
 * scale); null for a canvas of another shape.
 */
export function poseScale(pose: CoinPose, table: CoinTable): number | null {
  const size = poseCanvas(pose.canvas);
  const [w, h] = table.canvas;
  if (size === null || (size[0] === w && size[1] === h)) return 1;
  if (!(size[0] > 0 && size[1] > 0)) return null;
  const scale = w / size[0];
  return Math.abs(size[1] * scale - h) <= 0.5 ? scale : null;
}

/** A pose's length in pixels times `scale`, to a thousandth of a pixel, as the lab scales one. */
function scaled(px: number, scale: number): number {
  return scale === 1 ? px : Math.round(px * scale * 1000) / 1000;
}

/** Why `pose` cannot draw `table`'s frames, or null when it can. */
export function poseProblem(pose: CoinPose, table: CoinTable): string | null {
  const [w, h] = table.canvas;
  if (pose.frames !== table.count) {
    return `the pose is for ${pose.frames} frames and the sheet has ${table.count}`;
  }
  const scale = poseScale(pose, table);
  if (scale === null) {
    const size = poseCanvas(pose.canvas)!;
    return `the pose is for a ${size[0]} x ${size[1]} px canvas and the sheet's is ${w} x ${h}`;
  }
  if (pose.angles.length !== table.count) {
    return `the pose has ${pose.angles.length} angles for ${table.count} frames`;
  }
  const cx = scaled(pose.contactPoint[0]!, scale);
  const cy = scaled(pose.contactPoint[1]!, scale);
  if (!(cx >= 0 && cx <= w && cy >= 0 && cy <= h)) {
    return `the contact point (${cx}, ${cy}) is off the ${w} x ${h} px canvas`;
  }
  if (!(pose.faceHeightPx > 0)) return 'the face height is not above 0';
  if (
    !Number.isInteger(pose.restFrame) ||
    pose.restFrame < 0 ||
    pose.restFrame >= table.count
  ) {
    return `the resting frame ${pose.restFrame} is not one of the sheet's ${table.count}`;
  }
  return null;
}

/**
 * A pose any sheet can be drawn in, for one its pose does not fit: resting
 * on its widest frame, the contact point at the middle of that frame's box
 * and the lowest any frame reaches, the face as tall as the tallest frame,
 * and no turning, all read from the frames' trimmed rects. The built-in
 * coin's is (137.5, 235), 195 px, frame 0, the first of its widest. Null
 * for a sheet exported untrimmed, every frame its whole canvas: nothing
 * then tells where the coin lies in its frames, which is widest, where its
 * rim is or how tall.
 */
export function safePose(table: CoinTable): DrawnPose | null {
  let widest = 0;
  let bottom = 0;
  let tallest = 0;
  let trimmed = false;
  for (let i = 0; i < table.count; i++) {
    const o = i * FRAME_STRIDE;
    const w = table.frames[o + 2]!;
    const h = table.frames[o + 3]!;
    if (w > table.frames[widest * FRAME_STRIDE + 2]!) widest = i;
    bottom = Math.max(bottom, table.frames[o + 6]! + h);
    tallest = Math.max(tallest, h);
    if (w !== table.canvas[0] || h !== table.canvas[1]) trimmed = true;
  }
  if (!trimmed) return null;
  const o = widest * FRAME_STRIDE;
  return {
    contactPoint: [table.frames[o + 5]! + table.frames[o + 2]! / 2, bottom],
    faceHeightPx: tallest,
    restFrame: widest,
    turns: false,
  };
}

/**
 * `pose` as the hand draws it from `table`: itself, scaled to the sheet's
 * canvas when made for another size of it (see `poseScale`), or
 * `safePose` with the reason when it does not fit, which is null, no coin,
 * for a sheet of untrimmed frames.
 */
export function drawnPose(
  pose: CoinPose,
  table: CoinTable,
): { pose: DrawnPose | null; problem: string | null } {
  const problem = poseProblem(pose, table);
  if (problem !== null) return { pose: safePose(table), problem };
  const scale = poseScale(pose, table)!;
  return {
    pose: {
      contactPoint: [
        scaled(pose.contactPoint[0]!, scale),
        scaled(pose.contactPoint[1]!, scale),
      ],
      faceHeightPx: scaled(pose.faceHeightPx, scale),
      restFrame: pose.restFrame,
      turns: true,
    },
    problem: null,
  };
}

/**
 * The box every frame's ink covers on the canvas, px, left, top, right and
 * bottom: the union of the frames' trimmed rects, which a canvas drawing
 * the coin must hold rather than the whole canvas they are cut from.
 */
export function inkBox(table: CoinTable): [number, number, number, number] {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (let i = 0; i < table.count; i++) {
    const o = i * FRAME_STRIDE;
    left = Math.min(left, table.frames[o + 5]!);
    top = Math.min(top, table.frames[o + 6]!);
    right = Math.max(right, table.frames[o + 5]! + table.frames[o + 2]!);
    bottom = Math.max(bottom, table.frames[o + 6]! + table.frames[o + 3]!);
  }
  return [left, top, right, bottom];
}

/**
 * Writes into `out` the RSXform, `[scos, ssin, tx, ty]`, that draws frame
 * `index` of `frames` with the canvas's point (`pivotX`, `pivotY`), px, at
 * (`x`, `y`), scaled by `scale` and turned `angle` radians about it,
 * clockwise: the lab's translate, rotate and scale before it draws a frame
 * at its offset less the pivot. A turned frame, stored a quarter turn
 * clockwise so that a stored point (u, v) is the upright point (v, h - u),
 * is turned back in the same transform.
 */
export function coinXform(
  frames: readonly number[],
  index: number,
  scale: number,
  angle: number,
  x: number,
  y: number,
  pivotX: number,
  pivotY: number,
  out: number[],
): void {
  'worklet';
  const o = index * FRAME_STRIDE;
  const h = frames[o + 3]!;
  const turned = frames[o + 4] === 1;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = frames[o + 5]! - pivotX;
  const dy = frames[o + 6]! + (turned ? h : 0) - pivotY;
  out[0] = turned ? scale * sin : scale * cos;
  out[1] = turned ? -scale * cos : scale * sin;
  out[2] = x + scale * (cos * dx - sin * dy);
  out[3] = y + scale * (sin * dx + cos * dy);
}
