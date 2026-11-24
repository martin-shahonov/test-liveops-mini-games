import {
  flakeSlots,
  type FlakeDevice,
  type FlakePlan,
  type FlakeTuning,
} from './flakes';

/**
 * The sprites the flakes are drawn from, as the scratcher opens: one
 * texture of white shapes in square cells, which the hand's atlas tints
 * each flake's colour and turns and scales to it. The Coin Lean Lab draws
 * every flake's own outline; the atlas holds a few of each, drawn with the
 * lab's own formulas, and a flake's outline draws pick the nearest (see
 * `spawnFlakes`): a dust grain's disc, crumbs over the range of aspects, a
 * crumb's lit top, chips for each count of corners, each at a few squashes
 * for a chip's tumble, which a turn and a scale cannot make, and the two
 * shadows. Nothing here touches Skia; `useFlakeAtlas` draws it.
 */

/** Where each sprite lies in the atlas, by cell, row by row from its top-left corner, and how it is drawn. */
export type FlakeLayout = {
  /** A cell's side, texels, and the texels an outline unit spans, a flake's size its points. */
  cellPx: number;
  unitPx: number;
  /** Cells across and down, how many there are, and the texture's size, texels. */
  columns: number;
  rows: number;
  count: number;
  width: number;
  height: number;
  /** The dust grain's disc. */
  dust: number;
  /** The first crumb outline, and how many there are, by aspect. */
  crumb: number;
  crumbs: number;
  /** A crumb's lit top. */
  highlight: number;
  /**
   * The first chip outline: for each count of corners from `sidesFrom` to
   * `sidesTo`, `chipsPerSides` outlines, each at `squashLevels` squashes
   * from `squashFrom` to `squashTo`, in that order.
   */
  chip: number;
  sidesFrom: number;
  sidesTo: number;
  chipsPerSides: number;
  squashLevels: number;
  squashFrom: number;
  squashTo: number;
  /** A crumb's shadow, and a chip's. */
  crumbShadow: number;
  chipShadow: number;
};

/** The atlas for the tuning as it stands: see `FLAKES.atlas`. */
export function flakeLayoutOf(flakes: FlakeTuning): FlakeLayout {
  const { atlas, spawn, draw } = flakes;
  const crumbs = Math.max(1, Math.round(atlas.crumbs));
  const sidesFrom = Math.max(3, Math.round(spawn.chipSides[0]!));
  const sidesTo = Math.max(sidesFrom, Math.round(spawn.chipSides[1]!));
  const chipsPerSides = Math.max(1, Math.round(atlas.chipsPerSides));
  const squashLevels = Math.max(1, Math.round(atlas.squashLevels));
  const chips = (sidesTo - sidesFrom + 1) * chipsPerSides * squashLevels;
  const count = 1 + crumbs + 1 + chips + 2;
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const crumb = 1;
  const highlight = crumb + crumbs;
  const chip = highlight + 1;
  return {
    cellPx: atlas.cellPx,
    unitPx: atlas.unitPx,
    columns,
    rows,
    count,
    width: columns * atlas.cellPx,
    height: rows * atlas.cellPx,
    dust: 0,
    crumb,
    crumbs,
    highlight,
    chip,
    sidesFrom,
    sidesTo,
    chipsPerSides,
    squashLevels,
    squashFrom: draw.tumble[0]!,
    squashTo: draw.tumble[0]! + draw.tumble[1]!,
    crumbShadow: chip + chips,
    chipShadow: chip + chips + 1,
  };
}

/** Cell `index`'s box in the texture, texels: left, top, width, height. */
export function cellBox(
  layout: FlakeLayout,
  index: number,
): [number, number, number, number] {
  return [
    (index % layout.columns) * layout.cellPx,
    Math.floor(index / layout.columns) * layout.cellPx,
    layout.cellPx,
    layout.cellPx,
  ];
}

/**
 * A shape in a cell, in outline units about the cell's middle, y down: a
 * closed outline through `points` (x, y pairs), or an ellipse about
 * (`x`, `y`) with radii `rx` and `ry`.
 */
export type FlakeShape =
  | { kind: 'outline'; points: number[] }
  | { kind: 'ellipse'; x: number; y: number; rx: number; ry: number };

/** Mulberry32 from `seed`, as the pools draw theirs. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Every cell's shape, by index, drawn with the lab's outlines (its
 * `makeShape`) from `atlas.seed`: a crumb a closed outline of
 * `crumbPoints` round an ellipse of its aspect, the middle of its share of
 * `crumbAspect`; a chip its corners round a circle, each turned, at a
 * radius and flattened, then squashed down by its level, as a tumbling
 * chip is drawn; the grain a disc of a unit; the shadows and the lit top
 * the lab's ellipses.
 */
export function flakeShapes(
  flakes: FlakeTuning,
  layout: FlakeLayout,
): FlakeShape[] {
  const { spawn, draw } = flakes;
  const random = seeded(flakes.atlas.seed);
  const between = (least: number, most: number) =>
    least + random() * (most - least);
  const shapes: FlakeShape[] = [];
  shapes[layout.dust] = { kind: 'ellipse', x: 0, y: 0, rx: 1, ry: 1 };
  const [aspectFrom, aspectTo] = spawn.crumbAspect as [number, number];
  for (let i = 0; i < layout.crumbs; i++) {
    const aspect =
      aspectFrom + ((i + 0.5) / layout.crumbs) * (aspectTo - aspectFrom);
    const points: number[] = [];
    const n = Math.max(3, Math.round(spawn.crumbPoints));
    for (let k = 0; k < n; k++) {
      const th = (k / n) * Math.PI * 2;
      const r = between(spawn.crumbRadius[0]!, spawn.crumbRadius[1]!);
      points.push(Math.cos(th) * r, (Math.sin(th) * r) / aspect);
    }
    shapes[layout.crumb + i] = { kind: 'outline', points };
  }
  shapes[layout.highlight] = {
    kind: 'ellipse',
    x: 0,
    y: draw.highlight.at,
    rx: draw.highlight.radii[0]!,
    ry: draw.highlight.radii[1]!,
  };
  const levels = layout.squashLevels;
  for (let sides = layout.sidesFrom; sides <= layout.sidesTo; sides++) {
    for (let j = 0; j < layout.chipsPerSides; j++) {
      const corners: number[] = [];
      for (let k = 0; k < sides; k++) {
        const th =
          (k / sides) * Math.PI * 2 +
          between(-spawn.chipJitter, spawn.chipJitter);
        const r = between(spawn.chipRadius[0]!, spawn.chipRadius[1]!);
        corners.push(
          Math.cos(th) * r,
          Math.sin(th) * r * between(spawn.chipFlat[0]!, spawn.chipFlat[1]!),
        );
      }
      for (let level = 0; level < levels; level++) {
        const squash =
          levels <= 1
            ? layout.squashTo
            : layout.squashFrom +
              ((layout.squashTo - layout.squashFrom) * level) / (levels - 1);
        const points = corners.map((v, i) => (i % 2 === 1 ? v * squash : v));
        const index =
          layout.chip +
          ((sides - layout.sidesFrom) * layout.chipsPerSides + j) * levels +
          level;
        shapes[index] = { kind: 'outline', points };
      }
    }
  }
  shapes[layout.crumbShadow] = {
    kind: 'ellipse',
    x: 0,
    y: 0,
    rx: draw.crumbShadow[0]!,
    ry: draw.crumbShadow[1]!,
  };
  shapes[layout.chipShadow] = {
    kind: 'ellipse',
    x: 0,
    y: 0,
    rx: draw.chipShadow[0]!,
    ry: draw.chipShadow[1]!,
  };
  return shapes;
}

/**
 * The flakes as the scratcher opens, from their tuning as it stands on a
 * device of class `device`: the pool's slots and the device's most, the
 * atlas's layout and its shapes. Under Reduce Motion, `still`, no flake is
 * thrown, so each tray's pool keeps a single slot. What is read here shows
 * at the next open.
 */
export function flakePlanOf(
  flakes: FlakeTuning,
  device: FlakeDevice,
  still: boolean,
): FlakePlan {
  const cap = flakes.cap.devices[device];
  const layout = flakeLayoutOf(flakes);
  return {
    slots: still ? 1 : flakeSlots(flakes, cap),
    cap,
    layout,
    shapes: flakeShapes(flakes, layout),
  };
}
