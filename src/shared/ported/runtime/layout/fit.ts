/** An element's place on the artboard, in board points. */
export type BoardBox = {
  centre: readonly [number, number];
  /** The whole canvas, not the ink: an asset bakes its shadow and glow into the margin. */
  size: readonly [number, number];
  /** Set on the chrome around the centrepiece, never on the element the spread pivots about. */
  spread?: boolean;
  /**
   * Where its centre goes instead on a frame wider than tall, a tablet or an
   * unfolded phone on its side, where the board's top and bottom margins,
   * kept on a phone for its status bar and home bar, are not needed.
   */
  wideCentre?: readonly [number, number];
};

export type ShortScreenSpread = {
  /** The line elements spread away from, in board points. */
  pivotY: number;
  /** Spread per unit of shortness, shortness being width-fit over height-fit, less one. */
  gain: number;
  limit: number;
  /**
   * The widest frame, as width over height, that counts as a short phone. A
   * tablet is height-bound too, but from width to spare rather than shortness.
   */
  maxAspect: number;
};

/**
 * A frame wider than `minAspect` (width over height) fits a band of the
 * board rather than the whole of it: the rows from `top` to `bottom`, in
 * board points, `margin` points clear of the frame above and below and
 * centred across it, the board above and below the band running off the
 * frame. Opted into by a skin whose composition is drawn for such a frame;
 * without it every frame contains the board.
 */
export type WideScreenFit = {
  top: number;
  bottom: number;
  margin: number;
  minAspect: number;
  /**
   * Where the backdrop's still sits on such a frame: the still's `aspect`
   * (width over height, as its cut is made), and `focus`, the share of its
   * height that lands on the frame's centre line. It still covers the
   * frame; only where it is cut changes.
   */
  backdrop?: { aspect: number; focus: number };
};

export type BoardSpec = {
  /** The artboard's own size in board points. Everything else is relative. */
  board: readonly [number, number];
  elements: Readonly<Record<string, BoardBox>>;
  shortScreen?: ShortScreenSpread;
  wideScreen?: WideScreenFit;
};

export type BoardFit = {
  /** Board points -> screen points. */
  k: number;
  offsetX: number;
  offsetY: number;
  frameWidth: number;
  frameHeight: number;
  spread?: number;
  spreadPivot?: number;
  /** The frame fits the skin's wide-screen band, not the whole board: see `WideScreenFit`. */
  band?: boolean;
};

export type PlacedBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * The widest phone board a pack is drawn for, 1320 device pixels, over the
 * reference artboard's 1290. Titles are authored at exactly board resolution,
 * so a board scaled past this would show them enlarged.
 */
export const MAX_BOARD_SCALE = 1320 / 1290;

/**
 * Contain, not cover: the whole composition stays on screen and the
 * leftover goes to the backdrop. A frame past a skin's wide-screen aspect
 * fits its band instead: see `WideScreenFit`.
 */
export function fitBoard(
  spec: BoardSpec,
  frameWidth: number,
  frameHeight: number,
): BoardFit {
  const [bw, bh] = spec.board;
  const measured = frameWidth > 0 && frameHeight > 0;
  const kw = measured ? frameWidth / bw : 0;
  const kh = measured ? frameHeight / bh : 0;
  const wide = spec.wideScreen;
  if (measured && wide && frameWidth / frameHeight > wide.minAspect) {
    const band = wide.bottom - wide.top;
    const k = Math.min(
      kw,
      (frameHeight - 2 * wide.margin) / band,
      MAX_BOARD_SCALE,
    );
    return {
      k,
      offsetX: (frameWidth - bw * k) / 2,
      offsetY: (frameHeight - band * k) / 2 - wide.top * k,
      frameWidth,
      frameHeight,
      spread: 1,
      spreadPivot: spec.shortScreen?.pivotY ?? 0,
      band: true,
    };
  }
  const k = measured ? Math.min(kw, kh, MAX_BOARD_SCALE) : 0;

  return {
    k,
    offsetX: (frameWidth - bw * k) / 2,
    offsetY: (frameHeight - bh * k) / 2,
    frameWidth,
    frameHeight,
    spread: measured
      ? shortScreenSpread(spec.shortScreen, kw, kh, frameWidth / frameHeight)
      : 1,
    spreadPivot: spec.shortScreen?.pivotY ?? 0,
  };
}

export function shortScreenSpread(
  rule: ShortScreenSpread | undefined,
  kw: number,
  kh: number,
  aspect: number,
): number {
  if (!rule || !(kh > 0) || aspect > rule.maxAspect) return 1;
  const across = Math.min(kw, MAX_BOARD_SCALE);
  if (kh >= across) return 1;
  return Math.min(rule.limit, 1 + rule.gain * (across / kh - 1));
}

/** Where one element lands, in screen points, ready for an absolute style. */
export function placeBox(fit: BoardFit, box: BoardBox): PlacedBox {
  const [w, h] = box.size;
  const wide = fit.frameWidth > fit.frameHeight;
  const [cx, y] = wide && box.wideCentre ? box.wideCentre : box.centre;
  const spread = box.spread ? (fit.spread ?? 1) : 1;
  const pivot = fit.spreadPivot ?? 0;
  const cy = spread === 1 ? y : pivot + (y - pivot) * spread;

  const width = w * fit.k;
  const height = h * fit.k;

  return {
    left: fit.offsetX + cx * fit.k - width / 2,
    top: fit.offsetY + cy * fit.k - height / 2,
    width,
    height,
  };
}

/** A named element's placement, or `null` if the board does not carry it. */
export function place(
  fit: BoardFit,
  spec: BoardSpec,
  key: string,
): PlacedBox | null {
  const box = spec.elements[key];
  return box ? placeBox(fit, box) : null;
}

/** Points of overscan on each side of the backdrop. See `backdropBox`. */
export const COVER_OVERSCAN = 1;

/**
 * Where the backdrop goes: the frame grown by a point on every side, which the
 * picture covers, cropped about its centre. The overscan is fixed points, not
 * a percentage: rounding can leave a hairline along one edge, and a percentage
 * would also scale the scene about the frame's centre. Null until both sides
 * are measured, and Board waits for a box: iOS decodes an image once, at its
 * first layout, so a backdrop mounted at the overscan alone stays a thumbnail.
 */
export function backdropBox(
  frameWidth: number,
  frameHeight: number,
): PlacedBox | null {
  if (!(frameWidth > 0 && frameHeight > 0)) return null;
  return {
    left: -COVER_OVERSCAN,
    top: -COVER_OVERSCAN,
    width: frameWidth + 2 * COVER_OVERSCAN,
    height: frameHeight + 2 * COVER_OVERSCAN,
  };
}

/**
 * How much a cut `frame` pixels big is scaled to land in `box`: it covers the
 * box, but a box wider than tall is covered by its height alone, as the board
 * is fitted by it, so the scene stays under the board and its plinth under
 * the wheel, and what it leaves either side is the game's to fill.
 */
export function backdropScale(
  box: PlacedBox,
  frame: readonly [number, number],
): number {
  const [width, height] = frame;
  if (box.width > box.height) return box.height / height;
  return Math.max(box.width / width, box.height / height);
}

/**
 * Where a cropped cut's files land in `box`: the whole composition, `frame`
 * pixels, lands about the box's centre, scaled as `backdropScale` says, and
 * the files take its rows from `top`, `height` of them.
 */
export function croppedBackdropBox(
  box: PlacedBox,
  frame: readonly [number, number],
  top: number,
  height: number,
): PlacedBox {
  const [width, fullHeight] = frame;
  const scale = backdropScale(box, frame);
  const left = box.left + (box.width - width * scale) / 2;
  const coverTop = box.top + (box.height - fullHeight * scale) / 2;
  return {
    left,
    top: coverTop + top * scale,
    width: width * scale,
    height: height * scale,
  };
}

/**
 * Where a still of `aspect` lands in `box` on a band-fitted frame: covering
 * it, centred across, its height placed so `focus` of it falls on the
 * frame's centre line `centreY`, but never so far that it leaves the box
 * uncovered at the top or the bottom. A box with no room up or down, a
 * frame the still covers by its height, places it exactly as covering it
 * about its centre does.
 */
export function focusedBackdropBox(
  box: PlacedBox,
  aspect: number,
  focus: number,
  centreY: number,
): PlacedBox {
  const scale = Math.max(box.width / aspect, box.height);
  const width = aspect * scale;
  const height = scale;
  const top = Math.min(
    box.top,
    Math.max(box.top + box.height - height, centreY - focus * height),
  );
  return {
    left: box.left + (box.width - width) / 2,
    top,
    width,
    height,
  };
}

/**
 * The frame size Board draws at before it is measured, or zero to wait for
 * onLayout. Only whole points qualify: the backdrop mounts at this size and iOS
 * keeps that first decode (see `backdropBox`), so any size layout might round or
 * override must not be used.
 */
export function statedFrameSize(
  width: number | '100%' | undefined,
  height: number | undefined,
  restyled: boolean,
): { width: number; height: number } {
  if (restyled || !isWholePoints(width) || !isWholePoints(height)) {
    return { width: 0, height: 0 };
  }
  return { width, height };
}

function isWholePoints(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
