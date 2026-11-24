// From MiniGames games/scratcher/src/CardCells.tsx (0.11.0): what each cell draws, as data.
import type { AssetSource } from '../../../shared/ported/runtime';
import { matchedSymbolBox, symbolImageBox, symbolShadowBox, valueLine } from './cardLayout';
import type { SymbolArt } from './cardLayout';
import type { CellGrid, PrizeCellGrid } from './skins';
import type { CellBox } from './tray';
import { inkLinePlace } from './valueLine';
import type { GlyphSheet, InkLinePlace } from './valueLine';

/**
 * A tile and the width in board points it is cut for, with the glow a
 * matched one takes under it, the tile a matched cell draws instead
 * (`match`) and its darkened copy (`dark`), what a cell that does not match
 * takes once the result is known.
 */
export type TileArt = {
  source: AssetSource;
  glow: AssetSource;
  match: AssetSource;
  dark: AssetSource;
  width: number;
};

/**
 * A symbol's images and how they are placed: see `SymbolArt`. `dark` is
 * the symbol darkened as a symbol that does not match is once the result
 * is known; its shadow, black, has none.
 */
export type SymbolImage = SymbolArt & {
  source: AssetSource;
  dark: AssetSource;
  shadow: SymbolArt['shadow'] & { source: AssetSource };
};

/** What a cell draws over its tile, every box in board points. */
export type CellArt = {
  /**
   * Its symbol: its image and its darkened copy at `box`, laid out at
   * `matched`, the size its image ships for, and drawn at `box`'s size
   * about its centre; and its shadow's image at `shadow.box`.
   */
  symbol?: {
    source: AssetSource;
    dark: AssetSource;
    box: CellBox;
    matched: CellBox;
    shadow: { source: AssetSource; box: CellBox };
  };
  /** Its value, YOUR SYMBOLS only: the line and where it goes. */
  value?: { text: string; place: InkLinePlace };
};

/**
 * How a cell's art shows: at rest; lit, a match the engine has called; or
 * dark, a cell with no part in a winning card's match once the win is
 * known, as her win state draws every tile, symbol and value that does not
 * match.
 */
export type CellLook = 'rest' | 'lit' | 'dark';

/**
 * Each of `count` slots' look, in grid order: lit where `lit` names it, and
 * once `darken` says a win is known, dark everywhere else, a slot no cell
 * fills included.
 */
export function cellLooks(
  count: number,
  lit: readonly number[],
  darken: boolean,
): CellLook[] {
  return Array.from({ length: count }, (_, i) =>
    lit.includes(i) ? 'lit' : darken ? 'dark' : 'rest',
  );
}

/**
 * The tile cut for the width nearest `width`: her tile on a 9-cell card
 * and the winning row, its narrowed cut on a 12-cell card.
 */
export function tileFor(tiles: readonly TileArt[], width: number): TileArt {
  let best = tiles[0]!;
  for (const tile of tiles) {
    if (Math.abs(tile.width - width) < Math.abs(best.width - width)) {
      best = tile;
    }
  }
  return best;
}

/**
 * The images a tray's cells wait for before its part of the open settles,
 * as `CardCells` draws them: each slot's tile, and each symbol's shadow and
 * the symbol. Their matched and darkened copies load as the tiles give way
 * to them, and are not waited for.
 */
export function cellsAwaited(
  slots: readonly CellBox[],
  tiles: readonly TileArt[],
  cells: readonly CellArt[],
): AssetSource[] {
  return [
    ...slots.map((slot) => tileFor(tiles, slot.width).source),
    ...cells.flatMap((cell) =>
      cell.symbol ? [cell.symbol.shadow.source, cell.symbol.source] : [],
    ),
  ];
}

/**
 * Each cell's art on one tray, from its grid and its cells as `cardLayout`
 * lays them, in grid order: a symbol placed by its ink with its shadow
 * under it and its box once matched (none for a symbol without art, whose
 * tile stays bare), and in YOUR SYMBOLS, whose grid prints values, each
 * value line from the digits' sheet, set smaller where it would not fit
 * its tile.
 */
export function trayCellArt({
  grid,
  cells,
  symbols,
  matchScale,
  values,
}: {
  grid: CellGrid | PrizeCellGrid;
  cells: readonly CellBox[];
  /** Each cell's symbol, in grid order. */
  symbols: readonly (SymbolImage | undefined)[];
  /**
   * How much larger than its box at rest a symbol is laid out, about its
   * centre: her 112 %, the size its image ships for. It is drawn at its
   * size at rest, matched or not, and pops past it: see `symbolPop`.
   */
  matchScale: number;
  /** Each cell's value line, its text from `valueText`, for a grid that prints them. */
  values?: { texts: readonly string[]; sheet: GlyphSheet; sideRoom?: number };
}): CellArt[] {
  return cells.map((cell, i) => {
    const art: CellArt = {};
    const symbol = symbols[i];
    if (symbol) {
      const box = symbolImageBox(grid, cell, symbol);
      art.symbol = {
        source: symbol.source,
        dark: symbol.dark,
        box,
        matched: matchedSymbolBox(box, matchScale),
        shadow: {
          source: symbol.shadow.source,
          box: symbolShadowBox(box, symbol),
        },
      };
    }
    const text = values?.texts[i];
    if (values && text && 'prizeCap' in grid) {
      art.value = {
        text,
        place: inkLinePlace(
          text,
          values.sheet,
          valueLine(grid, cell, values.sideRoom),
        ),
      };
    }
    return art;
  });
}

