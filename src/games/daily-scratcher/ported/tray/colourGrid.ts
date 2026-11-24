import type { ColourGrid } from './flakes';

/**
 * Four bytes a point of a picture read back, `width` by `height`, as the
 * three of its colour the flakes take: what `coatingColours` hands them,
 * on either platform.
 */
export function rgbOf(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): ColourGrid {
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < width * height; i++, j += 4) {
    rgb[i * 3] = rgba[j]!;
    rgb[i * 3 + 1] = rgba[j + 1]!;
    rgb[i * 3 + 2] = rgba[j + 2]!;
  }
  return { width, height, rgb };
}
