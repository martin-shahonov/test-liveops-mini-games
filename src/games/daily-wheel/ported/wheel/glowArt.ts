// Ported verbatim from MiniGames games/wheel/src/glowArt.ts (0.11.0), less the vfx decode lists.
import type { WheelGlows } from '../../skin/types';

/** The resting wheel's glows, as they come in, one after another. */
export const RESTING_GLOWS = ['sector', 'title', 'button'] as const;
export type RestingGlow = (typeof RESTING_GLOWS)[number];

/**
 * How far either side of the title glow's split its DAILY WHEEL part fades
 * in, in export pixels, where the glow is not drawn whole. DAILY WHEEL's own
 * glow still reaches past the split, at a fifth of its peak, where a cut
 * would leave a line; faded over this much, what is left of the tier word's
 * glow is under 3 % of full.
 */
export const TITLE_SPLIT_FADE = 3;

/**
 * Whether the title glow sweeps the whole title: only over the tier word it
 * was painted for. `tierWord` is the tier whose word is drawn, null where
 * none is; another tier's word is cut differently, so it gets the DAILY WHEEL
 * part alone.
 */
export function titleGlowWhole(
  title: { word: string },
  tierWord: string | null,
): boolean {
  return tierWord === title.word;
}

/** The title glow's soft top edge where it draws its DAILY WHEEL part alone, in points of its `height`. */
export function titleGlowFade(
  height: number,
  sheetHeight: number,
  split: number,
): { from: number; to: number } {
  const perPixel = height / sheetHeight;
  return {
    from: (split - TITLE_SPLIT_FADE) * perPixel,
    to: (split + TITLE_SPLIT_FADE) * perPixel,
  };
}

/**
 * Where the sector glow draws on the disc, in the rim's own points: its
 * canvas the rim's square, the sheet's tile placed by the point its edges
 * meet at the centre, which it turns about.
 */
export function sectorGlowArea(
  rimSize: number,
  sector: Pick<WheelGlows['sector'], 'size' | 'apex' | 'meet'>,
): {
  box: { left: number; top: number; width: number; height: number };
  tile: { x: number; y: number; width: number; height: number };
  pivot: { x: number; y: number };
} {
  const side = sector.size * rimSize;
  return {
    box: { left: 0, top: 0, width: rimSize, height: rimSize },
    tile: {
      x: rimSize / 2 - (sector.meet ?? 0.5) * side,
      y: rimSize / 2 - sector.apex * side,
      width: side,
      height: side,
    },
    pivot: { x: rimSize / 2, y: rimSize / 2 },
  };
}

/**
 * How to fit the sector glow to a wedge of `count` sectors: `stretch` across
 * about the point its edges meet, then `turn`, radians clockwise, so both
 * edges lie on the wedge's dividers. Without `edges` it is taken to open as
 * the `paintedCount` wedge does, and is squeezed by the ratio of the
 * half-angles' tangents. With them, the stretch is the one that opens it to
 * the wedge's angle and the turn the one that centres it.
 */
export function sectorGlowFit(
  count: number,
  paintedCount: number,
  edges?: readonly [number, number],
): { stretch: number; turn: number } {
  const half = Math.PI / Math.max(count, 1);
  if (!edges) {
    return {
      stretch: Math.tan(half) / Math.tan(Math.PI / paintedCount),
      turn: 0,
    };
  }
  const [left, right] = edges;
  const opens = (stretch: number) =>
    Math.atan(left * stretch) + Math.atan(right * stretch);
  // Its angle grows with the stretch, so halving the range finds it.
  let low = 0;
  let high = 1;
  while (opens(high) < 2 * half && high < 1e6) high *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (opens(mid) < 2 * half) low = mid;
    else high = mid;
  }
  const stretch = (low + high) / 2;
  return {
    stretch,
    turn: (Math.atan(left * stretch) - Math.atan(right * stretch)) / 2,
  };
}
