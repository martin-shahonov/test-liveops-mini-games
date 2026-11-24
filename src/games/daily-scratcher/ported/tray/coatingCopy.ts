/**
 * How far a coating may be drawn larger than its own pixels, rather than a
 * denser copy of it: a little, with Catmull-Rom's cubic, before it softens.
 */
export const COATING_UPSCALE = 1.15;

/**
 * Her 3 px a point: what her coatings are drawn at, and the most a tray's
 * canvas is backed by, at which the cut's lip is 1.7 px wide. A screen with
 * fewer device pixels a point backs it with its own.
 */
export const TRAY_PIXEL_RATIO = 3;

/** A coating at a density of its own: device pixels a board point it lands 1:1 at. */
export type CoatingCopyOf<S> = { pixelsPerPoint: number; source: S };

/**
 * Device pixels a board point a tray lands its drawing at: the board's fit
 * `k` on a screen of `screenRatio` device pixels a point, the tray's canvas
 * shrunk by `backing` (see `backingScale`). What its coating's copy is
 * picked by, worked out the same way for a screen still to open by the
 * lobby's prefetch and the warm-up (see `trayDensityOn`).
 */
export function trayDensity(
  k: number,
  screenRatio: number,
  backing: number,
): number {
  return k * (screenRatio / backing);
}

/**
 * Which coating to draw on a screen of `screen` device pixels a board
 * point: of `source`, at `density`, and its `copies`, the least dense that
 * is drawn no larger than `COATING_UPSCALE` times its pixels. The tray
 * samples the coating with a cubic, which has no mip levels, so drawn much
 * smaller than its pixels her engraved lines break into dots and dashes:
 * on the desktop popup at 1x, 3.3 times smaller in a 1440 x 900 window.
 * Her own on a 3x phone; on a screen not measured yet, too.
 */
export function pickCoating<S>(
  source: S,
  density: number,
  copies: readonly CoatingCopyOf<S>[],
  screen: number,
): S {
  return pickCoatingCopy(source, density, copies, screen).source;
}

/** The same as `pickCoating`, with the density of the copy it picks. */
export function pickCoatingCopy<S>(
  source: S,
  density: number,
  copies: readonly CoatingCopyOf<S>[],
  screen: number,
): CoatingCopyOf<S> {
  let picked: CoatingCopyOf<S> = { pixelsPerPoint: density, source };
  if (!(screen > 0)) return picked;
  for (const copy of copies) {
    if (
      copy.pixelsPerPoint < picked.pixelsPerPoint &&
      copy.pixelsPerPoint * COATING_UPSCALE >= screen
    ) {
      picked = copy;
    }
  }
  return picked;
}
