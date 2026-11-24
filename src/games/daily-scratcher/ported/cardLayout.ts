import type { BitmapFont, BoardBox } from '../../../shared/ported/runtime';
import { VALUE_COIN } from './cellAmount';
import { inkPixels } from './inkMap';
import type { InkMap } from './inkMap';
import { cellPosition, gridFor } from './rules';
import type { ScratcherCard } from './rules';
import type { CellGrid, PrizeCellGrid, ScratcherSkin } from './skins';
import type { CellBox, CellZones, ReadingZone } from './tray';
import type { GlyphInk } from './valueInk';

/**
 * Where the card's cells sit, from the skin's grids: the rule
 * `art/compose.mjs` lays the delivered files out by, so every plate,
 * symbol and prize the screen draws lands where the composed screens show
 * it. Everything here is in board points.
 */

/** One tray's cells, on the board and in the tray's own points. */
export type TrayCells<G extends CellGrid = CellGrid> = {
  /** The tray's box on the board. */
  tray: BoardBox;
  grid: G;
  /** Each cell's plate in board points, in grid order. */
  cells: CellBox[];
  /**
   * Every slot of the grid in board points, in grid order: the cells', then
   * the ones no cell fills, a winning row of one or two symbols, or a last
   * row left short. Each draws a tile, so no slot shows as a hole.
   */
  slots: CellBox[];
  /** The same from the tray's top-left corner, as the tray's canvas takes them. */
  local: CellBox[];
  /** Where each cell is read, from the tray's top-left corner, in grid order: see `readingZones`. */
  zones: CellZones[];
};

export type CardLayout = {
  winning: TrayCells;
  yours: TrayCells<PrizeCellGrid>;
};

/** A box's top-left corner. */
export function boxOrigin(box: BoardBox): { left: number; top: number } {
  return {
    left: box.centre[0] - box.size[0] / 2,
    top: box.centre[1] - box.size[1] / 2,
  };
}

/** `count` cells of `grid`, each at its row and column from the grid's origin. */
export function gridCells(grid: CellGrid, count: number): CellBox[] {
  const cells: CellBox[] = [];
  for (let index = 0; index < count; index++) {
    const { row, column } = cellPosition(index, grid.columns);
    cells.push({
      left: grid.origin[0] + column * (grid.size[0] + grid.gap),
      top: grid.origin[1] + row * (grid.size[1] + grid.gap),
      width: grid.size[0],
      height: grid.size[1],
    });
  }
  return cells;
}

/**
 * Every slot of `grid`, its columns times its rows, or `count` if that is
 * more, laid out as `gridCells` lays its cells.
 */
export function gridSlots(grid: CellGrid, count = 0): CellBox[] {
  return gridCells(grid, Math.max(count, grid.columns * grid.rows));
}

/** `cells` from `tray`'s top-left corner rather than the board's. */
export function trayLocal(
  cells: readonly CellBox[],
  tray: BoardBox,
): CellBox[] {
  const { left, top } = boxOrigin(tray);
  return cells.map((cell) => ({
    ...cell,
    left: cell.left - left,
    top: cell.top - top,
  }));
}

/**
 * The YOUR SYMBOLS grid for a card: the skin's for 9 and for 12 cells, the
 * two the art is drawn for. Any other count is laid out by `gridFor`
 * across the same span: its columns share the 9 grid's width with the same
 * gaps, with the 12 grid's symbol and prize metrics from four columns up
 * and the 9 grid's below, over as many rows as it fills, which past three
 * run below the tray.
 */
export function yoursGrid(
  cells: ScratcherSkin['cells'],
  card: Pick<ScratcherCard, 'cells' | 'columns'>,
): PrizeCellGrid {
  const count = card.cells.length;
  if (count === 9) return cells[9];
  if (count === 12) return cells[12];
  const { columns, rows } = gridFor(count, card.columns);
  const nine = cells[9];
  const like = columns >= cells[12].columns ? cells[12] : nine;
  const span = nine.columns * nine.size[0] + (nine.columns - 1) * nine.gap;
  return {
    ...like,
    columns,
    rows,
    size: [(span - (columns - 1) * nine.gap) / columns, like.size[1]],
    gap: nine.gap,
    origin: nine.origin,
  };
}

/** Where the card's cells sit, both trays'. */
export function cardLayout(
  skin: Pick<ScratcherSkin, 'elements' | 'cells'>,
  card: Pick<ScratcherCard, 'winning' | 'cells' | 'columns'>,
): CardLayout {
  const winningTray = skin.elements.traywinning;
  const winning = gridCells(skin.cells.winning, card.winning.length);
  const winningLocal = trayLocal(winning, winningTray);
  const yoursTray = skin.elements.trayyours;
  const grid = yoursGrid(skin.cells, card);
  const yours = gridCells(grid, card.cells.length);
  const yoursLocal = trayLocal(yours, yoursTray);
  return {
    winning: {
      tray: winningTray,
      grid: skin.cells.winning,
      cells: winning,
      slots: gridSlots(skin.cells.winning, winning.length),
      local: winningLocal,
      zones: readingZones(skin.cells.winning, winningLocal),
    },
    yours: {
      tray: yoursTray,
      grid,
      cells: yours,
      slots: gridSlots(grid, yours.length),
      local: yoursLocal,
      zones: readingZones(grid, yoursLocal),
    },
  };
}

/** A cell's symbol: square, centred across the cell, `symbolCentreY` below its top, in the cell's own points. */
export function symbolBox(grid: CellGrid, cell: CellBox): CellBox {
  return {
    left: cell.left + cell.width / 2 - grid.symbol / 2,
    top: cell.top + grid.symbolCentreY - grid.symbol / 2,
    width: grid.symbol,
    height: grid.symbol,
  };
}

/** A cell's prize line box: as wide as the cell, its caps centred `prizeCentreY` below the cell's top. */
export function prizeBox(grid: PrizeCellGrid, cell: CellBox): BoardBox {
  return {
    centre: [cell.left + cell.width / 2, cell.top + grid.prizeCentreY],
    size: [cell.width, grid.prizeCap],
  };
}

/**
 * A symbol's image as the card draws it, every length in board points: her
 * symbol at rest, placed by its ink, and her shadow under it, its own
 * image.
 */
export type SymbolArt = {
  /** The symbol's box at rest. */
  size: readonly [number, number];
  /** Her symbol's ink centre, from the box's centre. */
  ink: readonly [number, number];
  /** Her shadow's box: its centre from the symbol's box's centre, and its size. */
  shadow: {
    centre: readonly [number, number];
    size: readonly [number, number];
  };
};

/** `box` from its centre, in board points. */
const centred = (
  x: number,
  y: number,
  width: number,
  height: number,
): CellBox => ({ left: x - width / 2, top: y - height / 2, width, height });

/**
 * Where a cell's symbol image lands at rest, placed by its ink as her
 * layout places it: the ink's centre across the cell's centre and the
 * grid's `symbolCentreY` below its top, on the winning row the tile's
 * centre and in YOUR SYMBOLS higher, over the value.
 */
export function symbolImageBox(
  grid: CellGrid,
  cell: CellBox,
  art: SymbolArt,
): CellBox {
  return centred(
    cell.left + cell.width / 2 - art.ink[0],
    cell.top + grid.symbolCentreY - art.ink[1],
    art.size[0],
    art.size[1],
  );
}

/** Where a symbol's shadow lands, from the symbol's image box at rest: hers, which keeps its box when the symbol grows. */
export function symbolShadowBox(image: CellBox, art: SymbolArt): CellBox {
  return centred(
    image.left + image.width / 2 + art.shadow.centre[0],
    image.top + image.height / 2 + art.shadow.centre[1],
    art.shadow.size[0],
    art.shadow.size[1],
  );
}

/** A symbol's image box drawn `scale` times as large about its centre: a matched symbol's, at her 112 %. */
export function matchedSymbolBox(image: CellBox, scale: number): CellBox {
  return centred(
    image.left + image.width / 2,
    image.top + image.height / 2,
    image.width * scale,
    image.height * scale,
  );
}

/** A matched tile's glow: the tile grown `grow` points on every side. */
export function tileGlowBox(tile: CellBox, grow: number): CellBox {
  return {
    left: tile.left - grow,
    top: tile.top - grow,
    width: tile.width + 2 * grow,
    height: tile.height + 2 * grow,
  };
}

/**
 * The least room either side of a value's ink, in points from the tile's
 * edge: her tile's soft edge, rim and inner band, 21 of her px (3.83 pt)
 * before its face starts, and 4 pt of the face. A value whose ink is wider
 * than the tile less this a side is set smaller to fit: on a 67.108 pt tile
 * of a 12-cell card, 51.449 pt.
 */
export const VALUE_SIDE_ROOM = (21 * 430) / 2358 + 4;

/**
 * A cell's value line: its ink centred across the cell, its caps' centre the
 * grid's `prizeCentreY` below the cell's top and `prizeCap` tall, at most
 * `maxInk` wide: see `VALUE_SIDE_ROOM`.
 */
export function valueLine(
  grid: PrizeCellGrid,
  cell: CellBox,
  sideRoom: number = VALUE_SIDE_ROOM,
): {
  centre: readonly [number, number];
  cap: number;
  maxInk: number;
} {
  return {
    centre: [cell.left + cell.width / 2, cell.top + grid.prizeCentreY],
    cap: grid.prizeCap,
    maxInk: cell.width - 2 * sideRoom,
  };
}

/**
 * The box every symbol's ink fits in, in points: her six symbols' ink boxes
 * laid on one centre, as the card places each symbol by its ink, so the
 * widest, her crown's 49.654 at rest, by the tallest, her coin's 43.766.
 * `art/handoff.mjs` measures each symbol's ink into `art/layout.json`'s
 * `inkSize`; a skin with other symbols needs its own.
 */
export const SYMBOL_INK_UNION: readonly [number, number] = [49.654, 43.766];

/**
 * Where each of `cells` is read, from the corner `cells` are given from,
 * whatever the card: its symbol zone, `inkUnion` centred where every
 * symbol's ink is placed, across the cell's centre and `symbolCentreY`
 * below its top; and where the grid prints prizes, one value zone, the
 * widest ink its value line may take, `prizeCap` tall, centred on the line
 * (see `valueLine`). A card is read by its own ink where the skin knows it:
 * see `cardZones`.
 */
export function readingZones(
  grid: CellGrid | PrizeCellGrid,
  cells: readonly CellBox[],
  inkUnion: readonly [number, number] = SYMBOL_INK_UNION,
): CellZones[] {
  return cells.map((cell) => {
    const symbol = centred(
      cell.left + cell.width / 2,
      cell.top + grid.symbolCentreY,
      inkUnion[0],
      inkUnion[1],
    );
    if (!('prizeCentreY' in grid)) return { symbol };
    const line = valueLine(grid, cell);
    return {
      symbol,
      value: [centred(line.centre[0], line.centre[1], line.maxInk, line.cap)],
    };
  });
}

/**
 * The least a reading zone is across and down, board points: a texel of
 * the mask either way and a little over, so no zone is left with none,
 * which would read as read.
 */
export const LEAST_ZONE = 2;

/** `box` grown about its centre to at least `LEAST_ZONE` either way. */
function atLeast(box: CellBox): CellBox {
  const width = Math.max(box.width, LEAST_ZONE);
  const height = Math.max(box.height, LEAST_ZONE);
  return {
    left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2,
    width,
    height,
  };
}

/**
 * A character whose ink covers fewer texels than this by their centres,
 * the dot of 2.5K, is read by every texel its ink touches instead: read by
 * its centres alone, each a large part of it, its share runs ahead of what
 * shows. On her direction 2, version 6 card every other character covers
 * 23 or more (a 1 set smaller on a 12-cell card; 38 or more at her size),
 * every symbol 660 or more.
 */
export const SMALL_INK_TEXELS = 16;

/** Less than this past a texel's edge, in points, is not touching it: what a sum of floats leaves over. */
const TOUCH = 1e-9;

/**
 * Where `map`, drawn over `image` (tray points from the tray's corner),
 * lies on the tray's mask, a texel a point: the texels whose centre falls
 * on one of its ink pixels, texel (i, j) reading the pixel
 * `(i + 0.5 - left) * map.width / width` across and the same down, as runs
 * [row, first, last, ...] of whole texels, row by row. Where fewer than
 * `SMALL_INK_TEXELS` texels do, every texel an ink pixel covers any of
 * instead. None at all, `[]`: the caller keeps the zone's box.
 */
export function inkTexels(map: InkMap, image: CellBox): number[] {
  const pixels = inkPixels(map);
  const across = map.width / image.width;
  const down = map.height / image.height;
  const i0 = Math.ceil(image.left - 0.5);
  const i1 = Math.ceil(image.left + image.width - 0.5) - 1;
  const j0 = Math.ceil(image.top - 0.5);
  const j1 = Math.ceil(image.top + image.height - 0.5) - 1;
  const runs: number[] = [];
  let count = 0;
  for (let j = j0; j <= j1; j++) {
    const v = Math.min(
      map.height - 1,
      Math.max(0, Math.floor((j + 0.5 - image.top) * down)),
    );
    // A run open from `first`, which may lie left of the tray's corner.
    let open = false;
    let first = 0;
    for (let i = i0; i <= i1 + 1; i++) {
      const u = Math.min(
        map.width - 1,
        Math.max(0, Math.floor((i + 0.5 - image.left) * across)),
      );
      if (i <= i1 && pixels[v * map.width + u] === 1) {
        count++;
        if (!open) {
          open = true;
          first = i;
        }
      } else if (open) {
        runs.push(j, first, i - 1);
        open = false;
      }
    }
  }
  return count >= SMALL_INK_TEXELS ? runs : touchedTexels(map, image, pixels);
}

/** Every texel an ink pixel of `map` over `image` covers any of, as runs: see `inkTexels`. */
function touchedTexels(
  map: InkMap,
  image: CellBox,
  pixels: Uint8Array,
): number[] {
  const px = image.width / map.width;
  const py = image.height / map.height;
  const left = Math.floor(image.left);
  const top = Math.floor(image.top);
  const columns = Math.ceil(image.left + image.width) - left;
  const rows = Math.ceil(image.top + image.height) - top;
  const touched = new Uint8Array(columns * rows);
  for (let v = 0; v < map.height; v++) {
    const j0 = Math.floor(image.top + v * py + TOUCH) - top;
    const j1 = Math.ceil(image.top + (v + 1) * py - TOUCH) - 1 - top;
    for (let u = 0; u < map.width; u++) {
      if (pixels[v * map.width + u] !== 1) continue;
      const i0 = Math.floor(image.left + u * px + TOUCH) - left;
      const i1 = Math.ceil(image.left + (u + 1) * px - TOUCH) - 1 - left;
      for (let j = j0; j <= j1; j++) {
        touched.fill(1, j * columns + i0, j * columns + i1 + 1);
      }
    }
  }
  const runs: number[] = [];
  for (let j = 0; j < rows; j++) {
    let first = -1;
    for (let i = 0; i <= columns; i++) {
      if (i < columns && touched[j * columns + i] === 1) {
        if (first < 0) first = i;
      } else if (first >= 0) {
        runs.push(top + j, left + first, left + i - 1);
        first = -1;
      }
    }
  }
  return runs;
}

/**
 * Where a value's characters print, from the board's corner, the coin left
 * out, as `ValueLine` draws `text` from `font` at `place`: each one's ink
 * where `ink` knows it, and otherwise its advance across and the caps,
 * `cap` sheet pixels tall, down. The pen and each image's lead and drop are
 * the runtime's `BitmapText`'s.
 */
export function valueGlyphBoxes(
  text: string,
  font: BitmapFont,
  cap: number,
  place: { pen: readonly [number, number]; pixel: number },
  ink?: GlyphInk,
): CellBox[] {
  const { pixel } = place;
  const lineTop = place.pen[1] - (font.lineHeight * pixel) / 2;
  const boxes: CellBox[] = [];
  let pen = 0;
  for (const ch of text) {
    const glyph = font.glyphs[ch];
    if (!glyph) continue;
    if (ch !== VALUE_COIN) {
      const lead = glyph.xoffset ?? (glyph.advance - glyph.w) / 2;
      const own = ink?.[ch];
      boxes.push(
        atLeast(
          own
            ? {
                left: place.pen[0] + (pen + lead + own[0]) * pixel,
                top: lineTop + ((glyph.yoffset ?? 0) + own[1]) * pixel,
                width: own[2] * pixel,
                height: own[3] * pixel,
              }
            : {
                left: place.pen[0] + pen * pixel,
                top: place.pen[1] - (cap * pixel) / 2,
                width: glyph.advance * pixel,
                height: cap * pixel,
              },
        ),
      );
    }
    pen += glyph.advance;
  }
  return boxes;
}

/**
 * Each character of a value as `ValueLine` draws `text` from `font` at
 * `place`, the coin left out, in the order `valueGlyphBoxes` gives their
 * boxes: its glyph's image, from the board's corner, the glyph's `w` by `h`
 * sheet pixels at the pen and its lead across and the line's top and its
 * drop down, as the runtime's `BitmapText` places it.
 */
export function valueGlyphImages(
  text: string,
  font: BitmapFont,
  place: { pen: readonly [number, number]; pixel: number },
): { ch: string; image: CellBox }[] {
  const { pixel } = place;
  const lineTop = place.pen[1] - (font.lineHeight * pixel) / 2;
  const images: { ch: string; image: CellBox }[] = [];
  let pen = 0;
  for (const ch of text) {
    const glyph = font.glyphs[ch];
    if (!glyph) continue;
    if (ch !== VALUE_COIN) {
      const lead = glyph.xoffset ?? (glyph.advance - glyph.w) / 2;
      images.push({
        ch,
        image: {
          left: place.pen[0] + (pen + lead) * pixel,
          top: lineTop + (glyph.yoffset ?? 0) * pixel,
          width: glyph.w * pixel,
          height: glyph.h * pixel,
        },
      });
    }
    pen += glyph.advance;
  }
  return images;
}

/** A value as a tray's cell prints it: its text, the sheet it is drawn from and where, from the board's corner. */
export type PrintedValue = {
  text: string;
  sheet: {
    font: BitmapFont;
    capHeight: number;
    ink?: GlyphInk;
    inkMaps?: Readonly<Record<string, InkMap>>;
  };
  place: { pen: readonly [number, number]; pixel: number };
};

/** A cell's symbol as it draws it, for it to be read by its ink: its image, from the board's corner, and its ink. */
export type SymbolInk = { image: CellBox; map: InkMap };

/**
 * Where each of a tray's cells is read, from the tray's corner, as the card
 * draws them: its symbol's own ink box, `inks`, placed where every symbol
 * is placed by its ink, and where the cell prints a value, `values`, a zone
 * for each of its characters but the coin (see `valueGlyphBoxes`). A symbol
 * with no ink size is read by `SYMBOL_INK_UNION`, and a cell whose value is
 * not given by the widest ink its value line may take, as `readingZones`
 * reads every card.
 *
 * Where the card knows its ink, a zone is read by the texels its ink covers
 * (see `inkTexels`) and keeps its box beside them: a symbol whose image and
 * ink are in `symbolInk`, and a character whose sheet has `inkMaps`, at its
 * glyph's image (see `valueGlyphImages`), so a line set smaller is read at
 * its size. YOUR SYMBOLS is read so; WINNING, given none, by its boxes.
 */
export function cardZones(
  tray: TrayCells,
  inks: readonly (readonly [number, number] | undefined)[],
  values?: readonly (PrintedValue | undefined)[],
  symbolInk?: readonly (SymbolInk | undefined)[],
): CellZones[] {
  const { left, top } = boxOrigin(tray.tray);
  const local = (box: CellBox): CellBox => ({
    ...box,
    left: box.left - left,
    top: box.top - top,
  });
  /** `zone`, and the texels `map` covers drawn over `image`, board points, where it covers any. */
  const read = (
    zone: CellBox,
    map: InkMap | undefined,
    image: CellBox | undefined,
  ): ReadingZone => {
    if (map === undefined || image === undefined) return zone;
    const texels = inkTexels(map, local(image));
    return texels.length > 0 ? { ...zone, texels } : zone;
  };
  const fixed = readingZones(tray.grid, tray.local);
  return tray.local.map((cell, i) => {
    const ink = inks[i] ?? SYMBOL_INK_UNION;
    const art = symbolInk?.[i];
    const symbol = read(
      centred(
        cell.left + cell.width / 2,
        cell.top + tray.grid.symbolCentreY,
        ink[0],
        ink[1],
      ),
      art?.map,
      art?.image,
    );
    const printed = values?.[i];
    if (!('prizeCentreY' in tray.grid)) return { symbol };
    if (printed === undefined || printed.text === '') {
      return { symbol, value: fixed[i]!.value };
    }
    const maps = printed.sheet.inkMaps;
    const images =
      maps === undefined
        ? []
        : valueGlyphImages(printed.text, printed.sheet.font, printed.place);
    const value = valueGlyphBoxes(
      printed.text,
      printed.sheet.font,
      printed.sheet.capHeight,
      printed.place,
      printed.sheet.ink,
    ).map((box, g) => {
      const glyph = images[g];
      return read(local(box), glyph && maps?.[glyph.ch], glyph?.image);
    });
    return { symbol, value: value.length > 0 ? value : fixed[i]!.value };
  });
}

/** A field's core on the board: its rect inside `tray`, and its corner radius. */
export function fieldCore(
  tray: BoardBox,
  field: {
    left: number;
    top: number;
    width: number;
    height: number;
    radius: number;
  },
): { box: CellBox; radius: number } {
  const { left, top } = boxOrigin(tray);
  return {
    box: {
      left: left + field.left,
      top: top + field.top,
      width: field.width,
      height: field.height,
    },
    radius: field.radius,
  };
}
