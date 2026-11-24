import { FLAKE_STRIDE } from './flakes';

/**
 * What the hand's flake atlas draws, unpacked on the UI thread from each
 * tray's packed frame (see `packFlakes`) into RSXforms and colours made
 * once and rewritten in place, as the effects package unpacks its own: one
 * atlas for both trays, every array it reads as long as the slots, blank
 * past the sprites drawn, since native throws, fatally, when two differ in
 * length. Nothing here touches Skia: the RSXforms are made by the
 * `makeXform` the hand hands in, so it runs under node as on the UI thread.
 */

/** Sprites the atlas holds before it first has to grow. */
export const INITIAL_SLOTS = 64;

/** An RSXform, as far as unpacking needs one. */
type Settable = {
  set(scos: number, ssin: number, tx: number, ty: number): void;
};

/** A sprite in no colour, drawn in every slot past the sprites, so the atlas always draws its slots' number. */
export type BlankSprite<X, R> = { xform: X; rect: R; color: Float32Array };

/**
 * The RSXforms and colours the slots are drawn from, kept on the UI thread
 * from one frame to the next and grown there, and how many slots there are.
 */
export type FlakeSlots<X> = {
  xforms: X[];
  tints: Float32Array[];
  capacity: number;
};

/** What the atlas reads, each array `capacity` long. */
export type FlakeSprites<X, R> = {
  transforms: X[];
  sprites: R[];
  colors: Float32Array[];
};

/** No slots grown yet, for the UI thread to keep. */
export function emptySlots<X>(): FlakeSlots<X> {
  'worklet';
  return { xforms: [], tints: [], capacity: INITIAL_SLOTS };
}

/**
 * How many sprites the atlas holds to draw `count`: `capacity` while that is
 * enough, otherwise the first doubling of it that is. Never fewer.
 */
export function slotCapacity(count: number, capacity: number): number {
  'worklet';
  let next = Math.max(1, capacity);
  while (next < count) next *= 2;
  return next;
}

/** Every slot blank: what the atlas draws with no flakes, or before the UI thread has its slots. */
export function blankSprites<X, R>(
  capacity: number,
  blank: BlankSprite<X, R>,
): FlakeSprites<X, R> {
  'worklet';
  const transforms: X[] = [];
  const sprites: R[] = [];
  const colors: Float32Array[] = [];
  for (let i = 0; i < capacity; i++) {
    transforms.push(blank.xform);
    sprites.push(blank.rect);
    colors.push(blank.color);
  }
  return { transforms, sprites, colors };
}

/**
 * The atlas's arrays for `frames`, one packed frame a tray, its sprites put
 * at the tray's place on the hand's canvas, (`offsets[2i]`, `offsets[2i +
 * 1]`) board points, in the frames' order: `held`'s RSXforms and colours
 * rewritten, more made with `makeXform` as the sprites outgrow them, and
 * fresh arrays of them, for the canvas to see a change. `cells` holds one
 * rect per atlas cell.
 */
export function unpackFlakes<X extends Settable, R>(
  frames: readonly Float32Array[],
  offsets: readonly number[],
  held: FlakeSlots<X>,
  cells: readonly R[],
  makeXform: () => X,
  blank: BlankSprite<X, R>,
): FlakeSprites<X, R> {
  'worklet';
  let drawn = 0;
  for (let i = 0; i < frames.length; i++) {
    drawn += Math.floor(frames[i]!.length / FLAKE_STRIDE);
  }
  held.capacity = slotCapacity(drawn, held.capacity);
  while (held.xforms.length < drawn) {
    held.xforms.push(makeXform());
    held.tints.push(new Float32Array(4));
  }
  const transforms: X[] = [];
  const sprites: R[] = [];
  const colors: Float32Array[] = [];
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    const ox = offsets[2 * i] ?? 0;
    const oy = offsets[2 * i + 1] ?? 0;
    const count = Math.floor(frame.length / FLAKE_STRIDE);
    for (let s = 0; s < count; s++) {
      const f = s * FLAKE_STRIDE;
      const slot = transforms.length;
      const xform = held.xforms[slot]!;
      xform.set(
        frame[f]!,
        frame[f + 1]!,
        frame[f + 2]! + ox,
        frame[f + 3]! + oy,
      );
      const tint = held.tints[slot]!;
      tint[0] = frame[f + 5]!;
      tint[1] = frame[f + 6]!;
      tint[2] = frame[f + 7]!;
      tint[3] = frame[f + 8]!;
      transforms.push(xform);
      sprites.push(cells[frame[f + 4]!] ?? blank.rect);
      colors.push(tint);
    }
  }
  while (transforms.length < held.capacity) {
    transforms.push(blank.xform);
    sprites.push(blank.rect);
    colors.push(blank.color);
  }
  return { transforms, sprites, colors };
}
