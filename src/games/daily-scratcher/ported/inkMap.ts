/**
 * Which pixels of a picture are its ink, as a finger reads the card: each
 * symbol's image and each glyph of the values' sheet, taken once from the
 * files the card draws (`art/inkmaps.mjs`, `skins/genericInk.ts`). A map
 * holds the picture's pixels row by row from its top-left corner as run
 * lengths: a blank run first, 0 when the first pixel is ink, then ink and
 * blank in turn. Nothing here touches React or Skia.
 */

/** A picture's ink, `width` by `height` pixels: see the file's comment. */
export type InkMap = {
  readonly width: number;
  readonly height: number;
  readonly runs: readonly number[];
};

/**
 * The runs of a `width` by `height` picture whose pixel (`x`, `y`) is ink
 * where `isInk` says: what `art/inkmaps.mjs` writes, by the same rule.
 */
export function inkRuns(
  width: number,
  height: number,
  isInk: (x: number, y: number) => boolean,
): number[] {
  const runs: number[] = [];
  let ink = false;
  let run = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isInk(x, y) === ink) {
        run++;
      } else {
        runs.push(run);
        ink = !ink;
        run = 1;
      }
    }
  }
  runs.push(run);
  return runs;
}

const decoded = new WeakMap<InkMap, Uint8Array>();

/** `map`'s pixels, a byte each, 1 for ink, row by row: decoded once a map. */
export function inkPixels(map: InkMap): Uint8Array {
  let pixels = decoded.get(map);
  if (pixels === undefined) {
    pixels = new Uint8Array(map.width * map.height);
    let at = 0;
    let ink = false;
    for (const run of map.runs) {
      if (ink) pixels.fill(1, at, at + run);
      at += run;
      ink = !ink;
    }
    decoded.set(map, pixels);
  }
  return pixels;
}

/**
 * Whether a symbol image's pixel is its ink: alpha past half. Her shadow
 * under the symbol peaks at 115, so none of it is.
 */
export const symbolInk = (alpha: number): boolean => alpha >= 128;

/**
 * Whether a glyph's pixel is its bright ink: alpha past half and luminance
 * 110 or more, so her soft shadow under the digits is left out.
 */
export const glyphInk = (
  red: number,
  green: number,
  blue: number,
  alpha: number,
): boolean =>
  alpha >= 128 && 0.2126 * red + 0.7152 * green + 0.0722 * blue >= 110;
