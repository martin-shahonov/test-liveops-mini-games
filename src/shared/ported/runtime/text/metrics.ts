import type { AssetSource } from '../layout/assetSource';

export type BitmapGlyph = {
  /** Position and size within the atlas, in atlas pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Pen advance after drawing, in atlas pixels. Usually >= `w`. */
  advance: number;
  /** Ink offset from the top of the line box, in atlas pixels; omitting it parks punctuation at cap height. */
  yoffset?: number;
  /**
   * Where the image starts, from the pen, in atlas pixels. Without it the
   * image is centred on its advance, which suits a sheet padded evenly either
   * side of its ink.
   */
  xoffset?: number;
};

export type BitmapFont = {
  /** The atlas image: `require()`d, or its URL. */
  source: AssetSource;
  /** True pixel size of the atlas: measure the image, as exporters routinely leave `scaleW`/`scaleH` stale. */
  atlasWidth: number;
  atlasHeight: number;
  /** Baseline-to-baseline height, and the unit `size` is expressed in. */
  lineHeight: number;
  glyphs: Readonly<Record<string, BitmapGlyph>>;
};

/** Width in points that `text` occupies at `size`. */
export function measureBitmapText(
  text: string,
  font: BitmapFont,
  size: number,
): number {
  // Advance, not ink width: ink under-reports the trailing space and lets a
  // label sit closer to the rim than it renders.
  const scale = size / font.lineHeight;
  let w = 0;
  for (const ch of text) {
    const g = font.glyphs[ch];
    if (g) w += g.advance * scale;
  }
  return w;
}

/** Where a glyph's image starts, from the pen, in atlas pixels. */
export function glyphLead(glyph: BitmapGlyph): number {
  return glyph.xoffset ?? (glyph.advance - glyph.w) / 2;
}

/**
 * How far `text`'s glyph images reach at `size`: from the first one's left
 * edge to the last one's right, in points from where the pen starts. What the
 * eye takes for the text's width, which its advance need not be.
 */
export function bitmapTextInk(
  text: string,
  font: BitmapFont,
  size: number,
): { left: number; right: number } {
  const scale = size / font.lineHeight;
  let pen = 0;
  let ink: { left: number; right: number } | null = null;
  for (const ch of text) {
    const g = font.glyphs[ch];
    if (!g) continue;
    const left = pen + glyphLead(g) * scale;
    ink = { left: ink ? ink.left : left, right: left + g.w * scale };
    pen += g.advance * scale;
  }
  return ink ?? { left: 0, right: 0 };
}
