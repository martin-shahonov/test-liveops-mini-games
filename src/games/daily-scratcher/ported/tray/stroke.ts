import type { PlacedBox } from '../../../../shared/ported/runtime';
/** Reanimated's shared value, as the ported worklets read and write it. */
type SharedValue<T> = { value: T };
import {
  HAND_SLACK,
  runTray,
  takesTouch,
  touchDown,
  touchEntered,
  touchHandedOver,
  touchLifted,
  touchMoved,
  type Tell,
  type TrayShared,
} from './trayMotion';

/**
 * One finger over the whole card: the screen's one gesture over both trays,
 * the gap between them and a margin round them, routing each finger's
 * points into the trays' own stores (see `trayMotion`). A finger is on the
 * tray whose box holds its point; off every box, in the gap or past an
 * edge, it stays on the tray it was on, as a finger dragged off a tray
 * always has, and it goes on onto the other tray only by reaching that
 * tray's box, without lifting: the coin, the stroke and its sound go with
 * it. A finger that lands beside the trays scratches from where it first
 * reaches one. Everything here is a worklet taking all it reads as
 * arguments, so it runs under node as it does on the UI thread.
 */

/**
 * Android's system Back gesture starts from either side edge of the
 * screen. A touch inside this band of either edge, in points of the
 * window, is left to the system: the band is the gesture navigation's own
 * default inset. iOS and the web keep the whole card.
 */
export const ANDROID_EDGE_BAND = 24;

/** Whether a touch `absoluteX` across a window `width` wide is in a side band `band` wide. */
export function inEdgeBand(
  absoluteX: number,
  width: number,
  band: number,
): boolean {
  'worklet';
  return band > 0 && (absoluteX < band || absoluteX > width - band);
}

/**
 * How far round the trays the card takes a touch, board points: the reach
 * the coin already has past a tray, so a finger landing just off a tray,
 * or in the gap between the two, starts scratching as it reaches one.
 */
export const STROKE_MARGIN = HAND_SLACK;

/** A tray as the stroke reaches it: its shared values and what it tells the JS thread. */
export type TrayLane = { shared: TrayShared; tell: Tell };

/** A tray's box in the stroke view's points, from the view's top-left corner. */
export type StrokeBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Where the stroke's trays are, as the gesture's callbacks read it. */
export type StrokeLayout = {
  /** Board points to screen points: the fit's `k`. */
  k: number;
  /** The window's width in points, for the side bands. */
  windowWidth: number;
  /** The side bands' width, points: see `inEdgeBand`. */
  edgeBand: number;
  /** Each tray's box, in the order of the lanes. */
  boxes: readonly StrokeBox[];
};

/**
 * One finger: its touch's id, or -1 for a free slot; `on`, the tray it
 * scratches, or the tray that let it go, whose finger it still is until it
 * lifts, or -1 for none; `spent`, the card was taken from it, so it does
 * nothing more until it lifts; its last point in the view's points.
 */
export type StrokePointer = {
  id: number;
  on: number;
  spent: boolean;
  x: number;
  y: number;
};

/** The fingers on the card, a slot per tray: a finger past them is ignored. */
export type StrokeState = { pointers: StrokePointer[] };

/** The view the stroke takes touches in: the trays' boxes and the gap between them, grown `margin` board points. */
export function strokeBoxOf(
  boxes: readonly PlacedBox[],
  k: number,
  margin: number,
): PlacedBox {
  if (boxes.length === 0) return { left: 0, top: 0, width: 0, height: 0 };
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const box of boxes) {
    left = Math.min(left, box.left);
    top = Math.min(top, box.top);
    right = Math.max(right, box.left + box.width);
    bottom = Math.max(bottom, box.top + box.height);
  }
  const grow = margin * k;
  return {
    left: left - grow,
    top: top - grow,
    width: right - left + 2 * grow,
    height: bottom - top + 2 * grow,
  };
}

/** The trays' boxes from `view`'s corner, with what the callbacks read beside them. */
export function strokeLayoutOf(
  view: PlacedBox,
  boxes: readonly PlacedBox[],
  k: number,
  windowWidth: number,
  edgeBand: number,
): StrokeLayout {
  return {
    k,
    windowWidth,
    edgeBand,
    boxes: boxes.map((box) => ({
      left: box.left - view.left,
      top: box.top - view.top,
      width: box.width,
      height: box.height,
    })),
  };
}

// A worklet takes the functions it calls as it is defined, so each helper is
// declared above the worklets that call it.

/** No finger on the card, a slot for each of `slots` trays. */
export function makeStroke(slots: number): StrokeState {
  'worklet';
  const pointers: StrokePointer[] = [];
  for (let i = 0; i < slots; i++) {
    pointers.push({ id: -1, on: -1, spent: false, x: 0, y: 0 });
  }
  return { pointers };
}

/** Makes the stroke's state on the UI thread, where the gesture rewrites it. */
export function initStroke(
  state: SharedValue<StrokeState | null>,
  slots: number,
): void {
  'worklet';
  state.value = makeStroke(slots);
}

/** The tray whose box holds (`x`, `y`), in the view's points, or -1 for none. */
export function laneAt(layout: StrokeLayout, x: number, y: number): number {
  'worklet';
  for (let i = 0; i < layout.boxes.length; i++) {
    const box = layout.boxes[i]!;
    if (
      x >= box.left &&
      x <= box.left + box.width &&
      y >= box.top &&
      y <= box.top + box.height
    ) {
      return i;
    }
  }
  return -1;
}

/** A point across the view, in tray `i`'s board points. */
export function boardX(layout: StrokeLayout, i: number, x: number): number {
  'worklet';
  return (x - layout.boxes[i]!.left) / layout.k;
}

/** A point down the view, in tray `i`'s board points. */
export function boardY(layout: StrokeLayout, i: number, y: number): number {
  'worklet';
  return (y - layout.boxes[i]!.top) / layout.k;
}

function slotOf(st: StrokeState, id: number): StrokePointer | null {
  'worklet';
  for (let i = 0; i < st.pointers.length; i++) {
    if (st.pointers[i]!.id === id) return st.pointers[i]!;
  }
  return null;
}

function someTakesTouch(lanes: readonly TrayShared[]): boolean {
  'worklet';
  for (let i = 0; i < lanes.length; i++) {
    if (takesTouch(lanes[i]!)) return true;
  }
  return false;
}

function someGrabbable(lanes: readonly TrayShared[]): boolean {
  'worklet';
  for (let i = 0; i < lanes.length; i++) {
    if (lanes[i]!.grabbable.value) return true;
  }
  return false;
}

/** A finger off the card: its lift told where it was, and its slot freed. */
function freed(
  p: StrokePointer,
  lanes: readonly TrayShared[],
  tells: readonly Tell[],
): void {
  'worklet';
  const on = p.on;
  if (on >= 0 && on < lanes.length) {
    touchLifted(lanes[on]!);
    runTray(lanes[on]!, tells[on]!);
  }
  p.id = -1;
  p.on = -1;
  p.spent = false;
}

/**
 * Touch `id` down at (`x`, `y`) in the view, `absoluteX` across the window:
 * 1 if it scratches a tray from here, 0 if it is taken but idle until it
 * reaches one (it landed in the gap, round the trays, on a finished box or
 * on a tray another finger holds), -1 if it is refused: in a side band,
 * with no slot free, or while no tray takes a touch.
 */
export function strokeDown(
  state: SharedValue<StrokeState | null>,
  layout: StrokeLayout,
  lanes: readonly TrayShared[],
  tells: readonly Tell[],
  id: number,
  x: number,
  y: number,
  absoluteX: number,
): number {
  'worklet';
  const st = state.value;
  if (st === null || !(layout.k > 0)) return -1;
  if (inEdgeBand(absoluteX, layout.windowWidth, layout.edgeBand)) return -1;
  if (slotOf(st, id) !== null || !someTakesTouch(lanes)) return -1;
  const p = slotOf(st, -1);
  if (p === null) return -1;
  const lane = laneAt(layout, x, y);
  let on = -1;
  if (
    lane >= 0 &&
    takesTouch(lanes[lane]!) &&
    touchDown(lanes[lane]!, boardX(layout, lane, x), boardY(layout, lane, y))
  ) {
    on = lane;
    runTray(lanes[lane]!, tells[lane]!);
  }
  p.id = id;
  p.on = on;
  p.spent = false;
  p.x = x;
  p.y = y;
  return on >= 0 ? 1 : 0;
}

/**
 * Touch `id` moved to (`x`, `y`) in the view. On a tray, it scratches it,
 * and reaching the other tray's box it goes on there without lifting (see
 * `touchHandedOver`); off every box it stays on its tray. An idle finger
 * presses in on the first tray it reaches that takes a touch. A finger the
 * card was taken from does nothing until it lifts.
 */
export function strokeMoved(
  state: SharedValue<StrokeState | null>,
  layout: StrokeLayout,
  lanes: readonly TrayShared[],
  tells: readonly Tell[],
  id: number,
  x: number,
  y: number,
): void {
  'worklet';
  const st = state.value;
  if (st === null || !(layout.k > 0)) return;
  const p = slotOf(st, id);
  if (p === null) return;
  const x0 = p.x;
  const y0 = p.y;
  p.x = x;
  p.y = y;
  if (p.spent) return;
  if (p.on >= 0) {
    const o = p.on;
    const from = lanes[o]!;
    const store = from.store.value;
    if (store === null || !store.down) {
      // Let go of: the screen stopped it, a sweep or a restore took the
      // card, or the last box ended under it.
      p.spent = true;
      return;
    }
    const to = laneAt(layout, x, y);
    if (
      to >= 0 &&
      to !== o &&
      touchHandedOver(
        from,
        lanes[to]!,
        boardX(layout, o, x),
        boardY(layout, o, y),
        boardX(layout, to, x0),
        boardY(layout, to, y0),
        boardX(layout, to, x),
        boardY(layout, to, y),
        o,
        to,
      )
    ) {
      p.on = to;
      runTray(from, tells[o]!);
      runTray(lanes[to]!, tells[to]!);
      return;
    }
    // Refused before it moved anything, or its crossing let the finger go.
    if (store.down) {
      touchMoved(from, boardX(layout, o, x), boardY(layout, o, y));
    }
    return;
  }
  if (!someGrabbable(lanes)) {
    p.spent = true;
    return;
  }
  const to = laneAt(layout, x, y);
  if (
    to >= 0 &&
    takesTouch(lanes[to]!) &&
    touchEntered(
      lanes[to]!,
      boardX(layout, to, x0),
      boardY(layout, to, y0),
      boardX(layout, to, x),
      boardY(layout, to, y),
    )
  ) {
    p.on = to;
    runTray(lanes[to]!, tells[to]!);
  }
}

/** Touch `id` up or cancelled: its lift told on the tray it is on, and its slot freed. */
export function strokeUp(
  state: SharedValue<StrokeState | null>,
  lanes: readonly TrayShared[],
  tells: readonly Tell[],
  id: number,
): void {
  'worklet';
  const st = state.value;
  if (st === null) return;
  const p = slotOf(st, id);
  if (p !== null) freed(p, lanes, tells);
}

/** The gesture over, however it ended: every finger still on the card lifted. */
export function strokeEnded(
  state: SharedValue<StrokeState | null>,
  lanes: readonly TrayShared[],
  tells: readonly Tell[],
): void {
  'worklet';
  const st = state.value;
  if (st === null) return;
  for (let i = 0; i < st.pointers.length; i++) {
    if (st.pointers[i]!.id !== -1) freed(st.pointers[i]!, lanes, tells);
  }
}
