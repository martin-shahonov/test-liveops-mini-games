// From MiniGames games/scratcher/src/ValueLine.tsx (0.11.0): where a line of glyphs goes.
import { bitmapTextInk } from '../../../shared/ported/runtime';
import type { BitmapFont, BoardFit } from '../../../shared/ported/runtime';
import type { InkMap } from './inkMap';
import type { GlyphInk } from './valueInk';

/**
 * A glyph sheet and its caps' height in its own pixels: what a line's caps,
 * in board points, are scaled from. Every sheet here has its line box
 * centred on its caps, so a line is placed by its caps' centre.
 */
export type GlyphSheet = {
  font: BitmapFont;
  capHeight: number;
  /** Where each glyph's ink lies in its image, for a value to be read by: see `GlyphInk`. */
  ink?: GlyphInk;
  /** Each glyph's bright ink over its image, by character, for a value to be read by its ink: see `InkMap`. */
  inkMaps?: Readonly<Record<string, InkMap>>;
};

/** Where a line goes, every length in board points. */
export type InkLine = {
  /** Its ink's centre across, and its caps' centre down. */
  centre: readonly [number, number];
  /** Its caps' height at the designer's size. */
  cap: number;
  /** The widest its ink may be: a wider line is set smaller to fit. */
  maxInk?: number;
};

/**
 * A line worked out once from the sheet its ink is measured on, for every
 * sheet drawn on it: where the pen starts across and the caps' centre down,
 * in board points, and `pixel`, board points a sheet pixel. `scale` is its
 * size against the designer's, 1 unless it was set smaller to fit.
 */
export type InkLinePlace = {
  pen: readonly [number, number];
  pixel: number;
  scale: number;
};

/**
 * Where `text` from `sheet` sits on `line`: centred across by its ink, the
 * reach of its glyph images, so the trailing spacing a sheet bakes into its
 * advances (its tracking) and a coin's lead are not counted as width; its
 * caps centred on the line; and set smaller, about the same centre, where
 * its ink would pass `maxInk`.
 *
 * A second sheet drawn under it, a value's glow, is drawn from this place,
 * never from its own: its images are padded for a wider blur and its coin
 * is empty, so a line centred on its own ink would sit beside the digits.
 * It must share the digits' advances and pixels a point.
 */
export function inkLinePlace(
  text: string,
  sheet: GlyphSheet,
  line: InkLine,
): InkLinePlace {
  const pixel = line.cap / sheet.capHeight;
  const ink = bitmapTextInk(text, sheet.font, sheet.font.lineHeight * pixel);
  const width = ink.right - ink.left;
  const scale =
    line.maxInk !== undefined && width > line.maxInk && width > 0
      ? line.maxInk / width
      : 1;
  return {
    pen: [
      line.centre[0] - ((ink.left + ink.right) / 2) * scale,
      line.centre[1],
    ],
    pixel: pixel * scale,
    scale,
  };
}

/**
 * Where a line from `font` lands on the screen, in screen points from
 * `origin`, the corner of the view it is drawn in: its line box's top-left
 * corner, which is the pen's start, and its height, what `BitmapText`
 * takes as its size.
 */
export function inkLineBox(
  fit: BoardFit,
  font: BitmapFont,
  place: InkLinePlace,
  origin: readonly [number, number] = [0, 0],
): { left: number; top: number; size: number } {
  const lineHeight = place.pixel * font.lineHeight;
  return {
    left: fit.offsetX + place.pen[0] * fit.k - origin[0],
    top: fit.offsetY + (place.pen[1] - lineHeight / 2) * fit.k - origin[1],
    size: lineHeight * fit.k,
  };
}

