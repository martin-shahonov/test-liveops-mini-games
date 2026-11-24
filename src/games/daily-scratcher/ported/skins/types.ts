import type {
  AssetSource,
  BitmapFont,
  BoardBox,
  BoardSpec,
  SoundSet,
  UiButtonSources,
} from '../../../../shared/ported/runtime';
import type { SpriteSheet } from '../../../../shared/ported/vfx';
import type {
  WinArtTier,
  WinCoinBeds,
  WinScreenArt,
  WinSoundKey,
} from '../../../../shared/ported/win';
import type { InkMap } from '../inkMap';
import type { GlyphInk } from '../valueInk';
import type { ScratcherSymbolId } from './symbols';

export type { ScratcherSymbolId, WinArtTier };

/**
 * The motion designer's glows, each a sheet on a box in board points: the
 * one round the button, played while the word it shows can be pressed.
 */
export type ScratcherGlows = {
  button: ScratcherButtonGlow;
};

/**
 * The glow round the button, one canvas for both its words: a ring whose
 * bright line, `line` px of its canvas across and down about the canvas's
 * middle, is laid along the shown pill's gold band as that pill is laid out
 * (`glowRing`), so one sheet fits both words, and any word.
 */
export type ScratcherButtonGlow = {
  loop: SpriteSheet;
  line: { width: number; height: number };
};

/**
 * What one of the motion designer's card animations is laid on: the
 * ticket's plate, the BETTY SCRATCHER line, the TOP PRIZE plate, or the two
 * scratch fields' cores together.
 */
export type ScratcherAnimationAnchor =
  | 'ticket'
  | 'title'
  | 'topPrize'
  | 'fields';

/**
 * Where an animation sits on what it is laid on, in that box's widths: its
 * untrimmed canvas's centre `offset` from the box's centre, and its size.
 * It moves with the box and scales with its width, so a new layout carries
 * it along.
 */
export type ScratcherAnimationPlace = {
  anchor: ScratcherAnimationAnchor;
  offset: readonly [number, number];
  size: readonly [number, number];
};

/** One of the card's animations: the motion designer's sheet and its place. */
export type ScratcherCardAnimation = {
  sheet: SpriteSheet;
  place: ScratcherAnimationPlace;
};

/**
 * The glows on every lit tile, each centred on its tile at `scale` times
 * the tile's width and height: `back` over the tile and under its symbol,
 * `frameIn` and then `frameIdle` over the symbol and its value.
 */
export type ScratcherTileAnimations = {
  back: SpriteSheet;
  frameIn: SpriteSheet;
  frameIdle: SpriteSheet;
  scale: number;
};

/**
 * The motion designer's animations on the card. Every card plays `rim`
 * round the ticket, `title` over the BETTY SCRATCHER line, `topPrize` over
 * its plate once and `fields` over the two fields until the first scratch;
 * a card with a match also `back`, behind the ticket, and the tile glows on
 * every lit tile, from the moment its match lights.
 */
export type ScratcherAnimations = {
  /** The BETTY SCRATCHER line's box, which `title` is laid on, in board points. */
  titleLine: BoardBox;
  rim: ScratcherCardAnimation;
  title: ScratcherCardAnimation;
  topPrize: ScratcherCardAnimation;
  fields: ScratcherCardAnimation;
  back: ScratcherCardAnimation;
  tile: ScratcherTileAnimations;
};

/**
 * The stills `elements` places and `sources` draws. The names are their
 * filenames in a skin folder, so they follow `defineAssets`' naming rule.
 */
export type ScratcherStillName =
  | 'cardshadow'
  | 'card'
  | 'titlegame'
  | 'nowin'
  | 'nowinagain';

/**
 * Boxes with no file of their own: the two trays, whose coatings are drawn
 * through Skia over their cells; the top prize's pill, baked into the card,
 * where its value is written; the top row; and the old How To Play plate's,
 * which the art layout still carries (`art/layout.json`), where nothing is
 * drawn since How To Play moved into Betty's drawer.
 */
export type ScratcherSlotName =
  | 'traywinning'
  | 'trayyours'
  | 'topprize'
  | 'uirow'
  | 'howtoplay';

/**
 * A glyph sheet and its caps' height in its own pixels, what a line's caps
 * in board points are scaled from. Each sheet's line box is centred on its
 * caps, so a line is placed by its caps' centre.
 */
export type ScratcherGlyphSheet = {
  font: BitmapFont;
  capHeight: number;
  /** Where each glyph's ink lies in its image, for a value to be read by: see `GlyphInk`. */
  ink?: GlyphInk;
  /**
   * Each glyph's bright ink over its image, her soft shadow left out, by
   * character: where a finger reads a printed character in YOUR SYMBOLS.
   * Without it, `ink`'s box.
   */
  inkMaps?: Readonly<Record<string, InkMap>>;
};

/**
 * Where the button goes on a fit, in board points: its pill centred
 * between the ticket's foot, `ticketFoot`, and the start of a bottom safe
 * zone `bottomMargin` screen points tall. `plateCentre` is her plate's
 * centre on her reference board. See `GENERIC_BUTTON_PLACE`.
 */
export type ScratcherButtonPlace = {
  ticketFoot: number;
  bottomMargin: number;
  plateCentre: number;
};

/**
 * One symbol as the card draws it, in points: her symbol and its shadow, two
 * images, since her win state treats them apart (all shadows under all
 * symbols). `size` is the symbol's box at rest, its image shipped at 3.36
 * px a point of it, so the matched symbol, drawn `matchGlows.symbol.scale`
 * times as large about its centre, still lands at 3; `ink`, the centre of
 * its ink (alpha past half) less the box's centre, which her layout places
 * on the tile.
 */
export type ScratcherSymbolArt = {
  source: AssetSource;
  size: readonly [number, number];
  ink: readonly [number, number];
  /**
   * The size of its ink's box, alpha past half: where a finger reads it.
   * Without it the symbol is read by the box every symbol's ink fits in.
   */
  inkSize?: readonly [number, number];
  /**
   * Its ink over its image, pixel by pixel, the image `size` points across
   * and down: where a finger reads it in YOUR SYMBOLS, the texels its ink
   * covers rather than its box. Without it, `inkSize`'s box.
   */
  inkMap?: InkMap;
  /**
   * Her shadow under it, drawn under every symbol of its tray: its box's
   * centre less the symbol's box's centre, and its size. A matched symbol
   * grows; its shadow keeps this box. Her shadows are black, so her
   * non-matching brightness leaves them as they are: they have no dark copy.
   */
  shadow: {
    source: AssetSource;
    centre: readonly [number, number];
    size: readonly [number, number];
  };
  /**
   * The symbol as her win state draws it where it does not match, once the
   * result is known: the same image, each of R, G and B mixed 40 % of the
   * way toward its luminance, then times 0.52 (`GENERIC_NON_MATCHING`),
   * baked by the art pipeline from the same master, to cross-fade to.
   */
  dark: AssetSource;
};

/**
 * One cut of her tile: the tile under a cell, `match` her tile-match on a
 * matched cell, and `dark` the tile as her win state draws it under a cell
 * that does not match, once the result is known (each of R, G and B times
 * 0.62, `GENERIC_NON_MATCHING`), baked from the same master to cross-fade
 * to.
 */
export type ScratcherTileCut = {
  source: AssetSource;
  match: AssetSource;
  dark: AssetSource;
};

/**
 * The tile under every cell, drawn at the cell's box: her one tile for both
 * trays (`full`), and the same narrowed for a 12-cell card's four columns
 * (`narrow`); `radius`, its outer corner radius, and `face`, how far inside
 * its edge its face starts, in points.
 */
export type ScratcherTiles = {
  full: ScratcherTileCut;
  narrow: ScratcherTileCut;
  radius: number;
  face: number;
};

/**
 * A matched cell's glows: under its tile, her glow-tile centred on it and
 * `grow` points past it on every side, cut for each tile (`full`,
 * `narrow`); and her matched symbol's size, `scale` times its size at rest,
 * which every symbol is laid out at about its centre, its image's size, and
 * drawn at its size at rest from, popping when it matches, with no glow
 * behind it (see `GENERIC_MATCH_GLOW` and `symbolPop`).
 */
export type ScratcherMatchGlows = {
  tile: {
    full: AssetSource;
    narrow: AssetSource;
    grow: number;
  };
  symbol: {
    scale: number;
  };
};

/**
 * A cell's value line: coin and amount centred by their ink on the tile's
 * centre, caps `cap` tall at `size` points, centred `centreY` of the
 * tile's height below its top, set smaller when its ink is wider than the
 * tile's face less `margin` points a side.
 */
export type ScratcherValueLine = {
  centreY: number;
  cap: number;
  size: number;
  margin: number;
  /** The digits' sheet, the coin `B` among them. */
  sheet: ScratcherGlyphSheet;
  /** A lit value's glow, drawn under the digits from their pen: every advance the digits' sheet's. */
  glow: BitmapFont;
  /**
   * The value as her win state draws it where it does not match, once the
   * result is known: the digits' sheet with each of R, G and B times 0.5
   * (`GENERIC_NON_MATCHING`), every glyph, advance and box the digits'
   * sheet's, so it is drawn from the same pen to cross-fade to.
   */
  dark: BitmapFont;
};

/**
 * A tray's scratch field, in points from the tray's top-left corner: its
 * rect, its corner `radius`, and `inset`, how far inside it the reveal
 * stops, so the coating's lip around the field always stays.
 */
export type ScratchField = {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
  inset: number;
};

/** A coating at a density of its own: device pixels a board point it lands 1:1 at. */
export type CoatingCopy = { pixelsPerPoint: number; source: AssetSource };

/** A tray's coating, the designer's: drawn whole over its tray, and the field it is scratched off in. */
export type ScratchCoating = {
  source: AssetSource;
  /** Device pixels a board point `source` lands 1:1 at; 3, the designer's, when left out. */
  pixelsPerPoint?: number;
  /**
   * The same coating reduced by area, for a screen that draws it smaller
   * than its own pixels, where the tray's cubic, which has no mip levels,
   * would break its fine lines into dots: see `pickCoating`.
   */
  reduced?: readonly CoatingCopy[];
  field: ScratchField;
};

/** A grid of cells inside a tray, every length in board points. */
export type CellGrid = {
  columns: number;
  rows: number;
  /** A cell's box. */
  size: readonly [number, number];
  /** Between two cells, across and down alike. */
  gap: number;
  /** The top-left corner of the first cell, on the board. */
  origin: readonly [number, number];
  /** The symbol's drawn size, square. */
  symbol: number;
  /** The symbol's centre below the cell's top. */
  symbolCentreY: number;
};

/** A grid whose cells print their prize under the symbol, from the prize sheet. */
export type PrizeCellGrid = CellGrid & {
  /** The centre of the prize's line box below the cell's top. */
  prizeCentreY: number;
  /** The prize's cap height. */
  prizeCap: number;
};

/**
 * What the scratcher plays, by the moment it marks: the bed under the whole
 * screen, the Quick Scratch press, the foil scraped under a moving finger,
 * a cell revealed, a matched cell lit, the Quick Scratch sweep, a card
 * with no match, and the win's own, which are the win package's.
 */
export type ScratcherSoundKey =
  | 'ambience'
  | 'tap'
  | 'scratch'
  | 'reveal'
  | 'match'
  | 'quick'
  | 'nowin'
  | WinSoundKey;

/**
 * Every file carries its level in the mix, so each plays at volume 1 unless
 * a cue moves it. The coin beds are the win package's, played where
 * `coinShowerSound` asks for them, on iOS unless the host says otherwise.
 * How and when each plays is in `docs/sounds.md`.
 */
export type ScratcherSounds = SoundSet<ScratcherSoundKey> & {
  coinBed?: WinCoinBeds;
};

export type ScratcherSkin = BoardSpec & {
  id: string;
  /** How a report names the skin a card falls back to. */
  name: string;
  elements: Readonly<Record<ScratcherStillName | ScratcherSlotName, BoardBox>>;
  /** The slots are placed, never drawn, so they have elements and no sources. */
  sources: Readonly<Record<ScratcherStillName, AssetSource>>;
  /** The backdrop still, a cut for a phone and one for anything wider: the scratcher plays no video. */
  backdropPoster: { portrait: AssetSource; square: AssetSource };
  /** The glow round the button; a skin without one draws the pill alone. */
  glows?: ScratcherGlows;
  /** The motion designer's animations on the card; a skin without them draws none. */
  animations?: ScratcherAnimations;
  /**
   * Board points per pixel of the procedural art: what How To Play and the
   * no-win plates are authored at.
   */
  pixel: number;
  /** The card face: its box, its corner radius and its frame's width, what the card glow is laid on. */
  card: { plate: BoardBox; radius: number; frame: number };
  /** The coating over each tray and the field it is scratched off in. */
  coatings: { winning: ScratchCoating; yours: ScratchCoating };
  /**
   * The static noise a scratch's edge is made ragged with, a tile laid at
   * 3 px a point from each tray's corner and read from its alpha alone:
   * see `art/render/grit.mjs`.
   */
  grit: AssetSource;
  /** The winning row, and YOUR SYMBOLS for 9 and for 12 cells. */
  cells: { winning: CellGrid; 9: PrizeCellGrid; 12: PrizeCellGrid };
  /** The symbols by the id a card names them with. */
  symbols: Readonly<Record<ScratcherSymbolId, AssetSource>>;
  /** Her tile under every cell, its matched and its darkened copy. */
  tiles: ScratcherTiles;
  /** Her six symbols as drawn on the tiles, each with its shadow, its darkened copy and where it is placed. */
  symbolArt: Readonly<Record<ScratcherSymbolId, ScratcherSymbolArt>>;
  /** A matched cell's glows. */
  matchGlows: ScratcherMatchGlows;
  /** Where a cell's value is written. */
  valueLine: ScratcherValueLine;
  /**
   * Where the universal button sits on a fit: QUICK SCRATCH and COLLECT,
   * on the board's centre line at the height `place` gives (her 34 pt
   * rule).
   */
  buttons: { place: ScratcherButtonPlace };
  /**
   * The universal button's five sprites, the runtime's, through the skin's
   * file resolver. The scratcher draws the frame, the idle face and the
   * pressed face: none of its buttons rests lit.
   */
  ui: UiButtonSources;
  /**
   * Where the old plate's OKAY sat, its middle in board points. Nothing is
   * drawn there: How To Play closes with its drawer's Close pill.
   */
  okayCentre: readonly [number, number];
  /**
   * How To Play's three steps' pictures, the designer's popups v3: scratch
   * the card, match a symbol, win the prize. The drawer, the words and the
   * Close pill are drawn in code.
   */
  howToPlay: {
    steps: readonly [
      scratch: AssetSource,
      match: AssetSource,
      prize: AssetSource,
    ];
  };
  /**
   * The system popups' badges, the wheel's: wifi for No connection and
   * Connection lost, an exclamation mark for Something went wrong and an
   * hourglass for Prize not confirmed.
   */
  popups: { wifi: AssetSource; alert: AssetSource; hourglass: AssetSource };
  /**
   * The coin in the hand: its `sheet` of frames turning from face-on and
   * the sheet's frame `table`, a TexturePacker JSON, drawn in `COIN_POSE`;
   * and, for `COIN_MOTION.mode` 'warp', the designer's tilted coin, drawn
   * `size` points across and down, its `anchor`, the rim point that touches
   * the card, under the finger, in points from the sprite's top-left.
   */
  scratchCoin: {
    sheet: AssetSource;
    table: AssetSource;
    source: AssetSource;
    size: readonly [number, number];
    anchor: readonly [number, number];
  };
  /**
   * The top prize's line on the plate: centred by its ink on `centreX`,
   * its baseline on `baseline`, its caps `cap` tall, all in board points;
   * `size`, the face's size in points, is what `cap` is; drawn from
   * `sheet`.
   */
  topPrizeValue: {
    centreX: number;
    baseline: number;
    size: number;
    cap: number;
    sheet: ScratcherGlyphSheet;
  };
  /** How dark the screen goes under How To Play and the no-win plate, 0 to 1. */
  overlayDim: number;
  /**
   * Whether a card with no match ends under the no-win plate: the screen
   * dimmed by `overlayDim` and the plate rising over the card, its art the
   * `nowin` or `nowinagain` still. The generic skin turns it on (the
   * owner's call of 13 Nov 2026: the real game keeps the plate). Off, the
   * card ends as it was revealed, its yours cells dimmed and COLLECT
   * offered, the outcome read out all the same.
   */
  noWinPlate?: boolean;
  /**
   * The deprecated `row.box` on a frame fitting the skin's wide-screen band:
   * across the frame, `top` points down and `height` tall. Without one the
   * box stays the board's own. The buttons follow the runtime's rule either
   * way.
   */
  wideTopRow?: { top: number; height: number };
  /** The win package's, laid about the card's centre. */
  winScreen: WinScreenArt;
  /** Without them the scratcher plays silently. */
  sounds?: ScratcherSounds;
};
