/**
 * Where a tray's coating can be scratched off, as plain numbers a worklet
 * reads: a rounded rect in the tray's board points, from its top-left
 * corner. Nothing here touches Skia, so it runs under node as it does on
 * the UI thread.
 */

/** A rounded rect, board points from the tray's top-left corner. */
export type RoundedBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
};

/**
 * The field the coating covers and the finger clears: the reveal, a
 * cell's fade and Quick Scratch's band stop `inset` points inside its
 * edge, and what lies outside it, the coating's soft shadow, stays until
 * the box is done. The designer's field is her coating's core, out to its
 * rim's outer edge, inset 0: the rim scratches off with the coating.
 */
export type ScratchField = RoundedBox & {
  /** How far inside the field the reveal stops, board points. */
  inset: number;
};

/** `box` taken in by `by` on every side, its corner radius with it. */
export function shrunk(box: RoundedBox, by: number): RoundedBox {
  'worklet';
  return {
    left: box.left + by,
    top: box.top + by,
    width: Math.max(0, box.width - 2 * by),
    height: Math.max(0, box.height - 2 * by),
    radius: Math.max(0, box.radius - by),
  };
}

/** Where the reveal may reach: the field shrunk by its inset. */
export function cutOf(field: ScratchField): RoundedBox {
  'worklet';
  return shrunk(field, field.inset);
}

/**
 * The signed distance from (`x`, `y`) to the edge of `box`, board points:
 * negative inside, 0 on the edge. The shader's `inCut` reads the same.
 */
export function roundedDistance(box: RoundedBox, x: number, y: number): number {
  'worklet';
  const r = Math.min(box.radius, box.width / 2, box.height / 2);
  const qx = Math.abs(x - (box.left + box.width / 2)) - (box.width / 2 - r);
  const qy = Math.abs(y - (box.top + box.height / 2)) - (box.height / 2 - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Whether (`x`, `y`) lies inside `box`, by `margin` points or more. */
export function insideRounded(
  box: RoundedBox,
  x: number,
  y: number,
  margin: number,
): boolean {
  'worklet';
  return roundedDistance(box, x, y) <= -margin;
}
