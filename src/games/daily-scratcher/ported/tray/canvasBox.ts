import type { PlacedBox } from '../../../../shared/ported/runtime';

/**
 * The tray's canvas, screen points: its box out to whole points, since the
 * web backs a canvas at its CSS size rounded and stretches that over the
 * exact one, which would soften the coating's every pixel. Also where the
 * tray's own box sits on it, `x` and `y` from its top-left corner.
 */
export function trayCanvasBox(
  box: PlacedBox,
): PlacedBox & { x: number; y: number } {
  const left = Math.floor(box.left + 1e-6);
  const top = Math.floor(box.top + 1e-6);
  const right = Math.ceil(box.left + box.width - 1e-6);
  const bottom = Math.ceil(box.top + box.height - 1e-6);
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    x: box.left - left,
    y: box.top - top,
  };
}
