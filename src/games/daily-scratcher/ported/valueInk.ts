/**
 * Where a glyph sheet's ink lies in each glyph's image, in sheet pixels from
 * the image's top-left corner: its left, top, width and height, alpha past
 * half. A sheet pads its images for a soft shadow, 5 or 6 pixels either side
 * and more below, so a value is read by its ink rather than by its images:
 * see `cardZones`.
 */
export type GlyphInk = Readonly<
  Record<string, readonly [number, number, number, number]>
>;

/**
 * The cell values' sheet, `assets/fonts/value-cell.png` (`VALUE_FONT_CELL`),
 * measured from its pixels: `valueInk.test.ts` measures them again, so a
 * sheet drawn again fails there until this is too.
 */
export const VALUE_CELL_INK: GlyphInk = {
  ',': [6, 3, 10, 15],
  '.': [5, 3, 9, 9],
  '0': [6, 3, 29, 34],
  '1': [6, 3, 17, 34],
  '2': [6, 3, 26, 34],
  '3': [5, 3, 27, 34],
  '4': [6, 3, 29, 34],
  '5': [5, 3, 27, 34],
  '6': [6, 3, 27, 34],
  '7': [5, 3, 25, 34],
  '8': [6, 3, 28, 34],
  '9': [6, 4, 27, 34],
  B: [5, 3, 40, 40],
  K: [6, 3, 31, 34],
  M: [6, 3, 40, 34],
};
