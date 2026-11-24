/**
 * The tray's diagonal, which the quick sweep's wipe and the resting sheen
 * both travel along: from its top-left corner towards its bottom-right, with
 * every point of the tray read by how far along it the point projects.
 */
export type Diagonal = {
  /** The unit direction, top-left to bottom-right. */
  ux: number;
  uy: number;
  /** How far the tray reaches along it: its bottom-right corner's projection. */
  length: number;
};

export function diagonalOf(width: number, height: number): Diagonal {
  'worklet';
  const length = Math.sqrt(width * width + height * height);
  if (length === 0) return { ux: 1, uy: 0, length: 0 };
  return { ux: width / length, uy: height / length, length };
}

/** How far along the diagonal the point (`x`, `y`) projects. */
export function alongDiagonal(d: Diagonal, x: number, y: number): number {
  'worklet';
  return x * d.ux + y * d.uy;
}

/**
 * A band's front, along the diagonal, that lies over none of the tray: a
 * band there is off, however wide. Far enough that a frame's rounding
 * cannot bring it back, and a plain number, so writing it again is writing
 * the same value.
 */
export const BAND_OFF = -1e6;

/**
 * The two points a linear gradient runs between for a band `width` wide
 * centred `front` along the diagonal: on the line through the tray's
 * top-left corner along the diagonal, at the band's near and far edges, so
 * the gradient reads 0 at the near edge and 1 at the far one everywhere
 * across the tray.
 */
export function bandEnds(
  d: Diagonal,
  front: number,
  width: number,
): { x0: number; y0: number; x1: number; y1: number } {
  'worklet';
  const near = front - width / 2;
  const far = front + width / 2;
  return {
    x0: d.ux * near,
    y0: d.uy * near,
    x1: d.ux * far,
    y1: d.uy * far,
  };
}
