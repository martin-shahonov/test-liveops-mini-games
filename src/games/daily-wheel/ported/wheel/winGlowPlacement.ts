import type { PlacedBox as VfxBox } from '../../../../shared/ported/runtime/layout/fit';

type SpriteTile = { x: number; y: number; width: number; height: number };

/**
 * The win glow's canvas: its box cut to the frame, since what lies outside is
 * never seen, and where the glow's own canvas lands inside it. The glow is
 * wider than a phone and reaches above the top of the frame.
 */
export function winGlowCanvas(
  glow: VfxBox,
  frameWidth: number,
  frameHeight: number,
): { box: VfxBox; tile: SpriteTile } {
  const left = Math.max(0, glow.left);
  const top = Math.max(0, glow.top);
  const right = Math.min(frameWidth, glow.left + glow.width);
  const bottom = Math.min(frameHeight, glow.top + glow.height);
  return {
    box: {
      left,
      top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    },
    tile: {
      x: glow.left - left,
      y: glow.top - top,
      width: glow.width,
      height: glow.height,
    },
  };
}
