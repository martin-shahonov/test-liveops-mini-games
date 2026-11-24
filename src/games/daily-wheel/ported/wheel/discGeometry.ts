/** Share of the room between gem and rim an amount may take before it is shrunk. */
const LABEL_ROOM = 0.9;

/** Sizes in points; `rimInner` is a fraction of `rimSize`, `labelRadius` of `faceSize`. */
export type DiscParts = {
  rimSize: number;
  rimInner: number;
  labelRadius: number;
  faceSize: number;
  gemSize: number;
};

export function amountRoom({
  rimSize,
  rimInner,
  labelRadius,
  faceSize,
  gemSize,
}: DiscParts) {
  const radius = faceSize * labelRadius;
  const room =
    2 *
    Math.min(radius - gemSize / 2, rimSize * rimInner - radius) *
    LABEL_ROOM;
  return { radius, room };
}

/**
 * Where the rim glow's export is drawn, in the rim box's points: `size` rim
 * canvases wide, laid so the ring's own centre lands on the rim's.
 */
export function rimGlowBox(
  rimSize: number,
  size: number,
  ringCentre: readonly [number, number],
  exportSize: { width: number; height: number },
) {
  const scale = (size * rimSize) / exportSize.width;
  return {
    left: rimSize / 2 - ringCentre[0] * scale,
    top: rimSize / 2 - ringCentre[1] * scale,
    width: exportSize.width * scale,
    height: exportSize.height * scale,
  };
}

/**
 * The face as it shows between the rim's metal and the gem, in the rim box's
 * points, as an SVG path: a glow drawn over the wheel rather than on the disc,
 * under both, is kept to it. The gem's circle winds the other way, so it is a
 * hole.
 */
export function faceBetween(
  rimSize: number,
  rimInner: number,
  gem: { x: number; y: number; radius: number },
): string {
  const centre = rimSize / 2;
  return `${circlePath(centre, centre, rimSize * rimInner, 1)} ${circlePath(gem.x, gem.y, gem.radius, 0)}`;
}

/** Two half arcs, clockwise on screen with `sweep` 1. */
function circlePath(x: number, y: number, r: number, sweep: 0 | 1): string {
  const arc = (to: number) => `A ${r} ${r} 0 1 ${sweep} ${to} ${y}`;
  return `M ${x - r} ${y} ${arc(x + r)} ${arc(x - r)} Z`;
}

/** A band's inner and outer arcs and its line weight, as fractions of `rimSize`. */
export type BandRing = { inner: number; outer: number; weight: number };

const BOOST_WEIGHT = 0.009;

/** Clear space from the amounts and from the rim, as fractions of `rimSize`. */
const AMOUNT_GAP = 0.004;
const RIM_GAP = 0.003;

/**
 * The most of the ring between the amounts and the rim the band's line may
 * take: an outline near the amounts, not a fill of the ring.
 */
const MAX_WEIGHT_SHARE = 1 / 7;

/**
 * The Boosted band, just outside the amounts. An outline needs a stroke's
 * width between its two arcs or it reads as a solid bar, so a ring too narrow
 * for the usual weight thins it.
 */
export function boostRing(parts: DiscParts): BandRing {
  const { radius, room } = amountRoom(parts);

  const from = (radius + room / 2) / parts.rimSize + AMOUNT_GAP;
  const to = parts.rimInner - RIM_GAP;
  const weight = Math.min(BOOST_WEIGHT, (to - from) * MAX_WEIGHT_SHARE);

  // A stroke straddles its arc, so each arc sits half a weight in from the edge it paints.
  return {
    inner: from + weight / 2,
    outer: from + weight * 2.5,
    weight,
  };
}
