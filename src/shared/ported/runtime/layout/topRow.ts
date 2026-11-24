import type { PlacedBox } from './fit';

/**
 * The designer's top row, her HUD (the repository's `layout-hud.json`), in
 * points on her reference screen (iPhone 15, 393 x 852 pt): her px over 6 on
 * her 2358 x 5112 px board.
 */
export type TopRowRule = {
  /**
   * Her reference screen's height: distances and sizes scale with a frame's
   * height over this.
   */
  readonly referenceHeight: number;
  /**
   * Icon centres: sound and help from the frame's left edge, close from its
   * right edge.
   */
  readonly sound: number;
  readonly help: number;
  readonly close: number;
  /** The icons' centre from the frame's top, on a screen with a notch. */
  readonly centreY: number;
  /**
   * Across and in size, a frame counts as at least this tall, so the tap
   * zones of sound and help never overlap.
   */
  readonly minHeightAcross: number;
  /** A frame counts as at most this tall: her tallest screens. */
  readonly maxHeight: number;
  /** Each icon's tap zone, a square of this side, points. Never scaled. */
  readonly button: number;
  /**
   * Her sprites' drawn size, width and height, at the reference. Sound off
   * swaps in for sound on, on the same centre.
   */
  readonly icons: {
    readonly sound: readonly [number, number];
    readonly soundOff: readonly [number, number];
    readonly help: readonly [number, number];
    readonly close: readonly [number, number];
  };
  /** The icons' opacity. */
  readonly opacity: number;
  /**
   * A vector icon's side at the reference. Her sprites are the ink of 20 pt
   * Material icons, so a host drawing its own icons draws them this size,
   * scaled as hers are.
   */
  readonly glyph: number;
  /** A screen without a notch or an island, which reserves no room for one. */
  readonly noNotch: {
    /** A top inset this deep or less is a status bar, not a notch. */
    readonly maxTopInset: number;
    /**
     * The icons' centre below the top inset on a screen `gapPixels` of its
     * own device pixels tall, scaled with the screen's height in them.
     */
    readonly gap: number;
    readonly gapPixels: number;
    /**
     * The most device pixels a point that height is counted in, her table's
     * 3x screens, and how a screen whose pixels are not given is read.
     */
    readonly pixelRatio: number;
  };
  /** The iPhone Duo, known by its frame, whose icons sit round the system's. */
  readonly duo: {
    /** Its frame upright, width and height; on its side the other way round. */
    readonly size: readonly [number, number];
    /** How far either side of a frame may be off and still be the Duo's. */
    readonly tolerance: number;
    /** Upright: the system icons' line, the icons' centre from the top. */
    readonly uprightCentreY: number;
    /** Upright: close's right edge from the frame's left edge. */
    readonly uprightCloseRight: number;
    /** On its side: the column's centre from the frame's left edge. */
    readonly columnX: number;
    /** On its side: each icon's centre from the frame's top. */
    readonly column: {
      readonly close: number;
      readonly help: number;
      readonly sound: number;
    };
  };
};

/**
 * Her HUD of 5 Nov: `rule` and the sprites' sizes in layout-hud.json, with
 * the readings of what it leaves open (the 658 and 960 pt holds, a notch
 * above a 24 pt top inset, her no-notch margin read from the screen's own
 * pixels as her table reads it, at most 3 a point, a web page's at 3).
 */
export const TOP_ROW_RULE: TopRowRule = {
  referenceHeight: 852,
  sound: 230 / 6,
  help: 572 / 6,
  close: 236 / 6,
  centreY: 527 / 6,
  minHeightAcross: 658,
  maxHeight: 960,
  button: 44,
  icons: {
    sound: [90 / 6, 88 / 6],
    soundOff: [90 / 6, 90 / 6],
    help: [100 / 6, 100 / 6],
    close: [70 / 6, 70 / 6],
  },
  opacity: 0.92,
  glyph: 20,
  noNotch: {
    maxTopInset: 24,
    // Her `top_safe_pt + 37 pt x (k / 0.547)`, k being the screen's height
    // in its own pixels over her board's 5112 px, and 0.547 her 15 Pro
    // Max's k. So a 2x screen's row sits nearer its status bar than a 3x
    // screen's of the same height: the iPhone SE's 37.65 pt down.
    gap: 37,
    gapPixels: 5112 * 0.547,
    pixelRatio: 3,
  },
  duo: {
    size: [669, 951],
    tolerance: 1,
    // Her px over 3, on the Duo's 2007 x 2853 px screen.
    uprightCentreY: 143 / 3,
    uprightCloseRight: 1319 / 3,
    columnX: 2709 / 3,
    column: { close: 715 / 3, help: 906 / 3, sound: 1097 / 3 },
  },
};

/** How far system UI covers the game frame from each edge, points. */
export type TopRowInsets = {
  readonly top?: number;
  readonly left?: number;
  readonly right?: number;
};

export type TopRowName = 'sound' | 'help' | 'close';

/** Each button's tap zone, 44 x 44 points. */
export type TopRowButtons = Readonly<Record<TopRowName, PlacedBox>>;

/**
 * Each icon's drawn box, centred in its zone; `soundOff` is sound's while
 * muted, on the same centre.
 */
export type TopRowIcons = Readonly<Record<TopRowName | 'soundOff', PlacedBox>>;

export type TopRowOptions = {
  /**
   * How to read a frame whose top inset is not known (`insets.top`
   * undefined): `'notch'`, the default, keeps the row a phone with a notch
   * has, as an app that passes no insets cannot see its status bar; `'none'`
   * reads it as a screen without one, as a web page is. A known top inset
   * decides by itself.
   */
  readonly unknownTop?: 'notch' | 'none';
  /**
   * The screen's device pixels a point, from which a row without a notch
   * takes its height, as her table does: `PixelRatio.get()` on iOS and
   * Android. Counted as at most 3. Left out, 3, as a web page is read, so
   * a browser's row stays 37 pt down on a 932 pt page at any zoom.
   */
  readonly pixelRatio?: number;
  /** The rule to place by: `TOP_ROW_RULE` unless said. */
  readonly rule?: TopRowRule;
};

/** The whole top row on a frame. */
export type HudPlaces = {
  /** Which of her rules placed it. */
  readonly rule: 'notch' | 'no-notch' | 'duo-upright' | 'duo-side';
  readonly buttons: TopRowButtons;
  readonly icons: TopRowIcons;
  /** A vector icon's side on this frame, points: see `TopRowRule.glyph`. */
  readonly glyph: number;
  readonly opacity: number;
};

/** What a game hands `renderTopRow`. */
export type GameTopRow = {
  /**
   * Each button's tap zone in the game frame, points: 44 x 44, centred on
   * its icon. Centre the host's button in it.
   */
  buttons: TopRowButtons;
  /**
   * Each icon's drawn box in the game frame, points: her sprite's size on
   * this frame, centred in its zone. `soundOff` is the muted sound icon's,
   * on the same centre.
   */
  icons: TopRowIcons;
  /**
   * The side, in points, of a 20 pt vector icon scaled as her sprites are,
   * for a host that draws its own icons.
   */
  glyph: number;
  /** The icons' opacity: 0.92. */
  opacity: number;
  /**
   * True until the game is shown, while only the top row is drawn over its
   * cover, and over its coin loader until that has faded out over the game
   * shown under it. A host whose placeholder carries its own way out
   * meanwhile can keep its row from screen readers until then. Never true
   * with the cover turned off (`showLoadingCover`): the row is then drawn
   * over the game as it loads, and is the player's to use.
   */
  covered: boolean;
  muted: boolean;
  onToggleSound: () => void;
  /** Opens How To Play: the game's own, or the host's `onHelp`. */
  onHelp: () => void;
  onClose: () => void;
};

/** An inset as a distance: none for one missing, negative or not finite. */
const inset = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) ? Math.max(0, value) : 0;

/**
 * A screen's pixels a point as her no-notch row counts them: at most
 * `most`, and `most` for a ratio not given or not a positive number.
 */
const pixelsAPoint = (value: number | undefined, most: number) =>
  value !== undefined && Number.isFinite(value) && value > 0
    ? Math.min(most, value)
    : most;

/** A box `size` at the reference, scaled by `scale`, centred on `x`, `y`. */
function centred(
  x: number,
  y: number,
  [width, height]: readonly [number, number],
  scale: number,
): PlacedBox {
  return {
    left: x - (width * scale) / 2,
    top: y - (height * scale) / 2,
    width: width * scale,
    height: height * scale,
  };
}

/** The zones and icons on their centres, the icons scaled by `scale`. */
function boxes(
  kind: HudPlaces['rule'],
  centres: Readonly<Record<TopRowName, readonly [number, number]>>,
  scale: number,
  rule: TopRowRule,
): HudPlaces {
  const zone = (name: TopRowName) => {
    const [x, y] = centres[name];
    return centred(x, y, [rule.button, rule.button], 1);
  };
  const icon = (name: TopRowName, size: readonly [number, number]) => {
    const [x, y] = centres[name];
    return centred(x, y, size, scale);
  };
  return {
    rule: kind,
    buttons: { sound: zone('sound'), help: zone('help'), close: zone('close') },
    icons: {
      sound: icon('sound', rule.icons.sound),
      soundOff: icon('sound', rule.icons.soundOff),
      help: icon('help', rule.icons.help),
      close: icon('close', rule.icons.close),
    },
    glyph: rule.glyph * scale,
    opacity: rule.opacity,
  };
}

/**
 * The iPhone Duo's row, upright or on its side, or null for any other frame.
 * Her places sit inside the system's own status areas, so no inset moves
 * them, and her icons are the same size both ways, scaled by the long side.
 */
function placeDuo(
  frame: { readonly width: number; readonly height: number },
  rule: TopRowRule,
): HudPlaces | null {
  const { size, tolerance } = rule.duo;
  const near = (width: number, height: number) =>
    Math.abs(frame.width - width) <= tolerance &&
    Math.abs(frame.height - height) <= tolerance;
  const scale = size[1] / rule.referenceHeight;
  if (near(size[0], size[1])) {
    // On the system icons' line, close just left of them.
    const y = rule.duo.uprightCentreY;
    const close =
      rule.duo.uprightCloseRight - (rule.icons.close[0] * scale) / 2;
    return boxes(
      'duo-upright',
      {
        sound: [rule.sound * scale, y],
        help: [rule.help * scale, y],
        close: [close, y],
      },
      scale,
      rule,
    );
  }
  if (near(size[1], size[0])) {
    // One column under the system icons, on their centre line.
    const x = rule.duo.columnX;
    const { column } = rule.duo;
    return boxes(
      'duo-side',
      {
        sound: [x, column.sound],
        help: [x, column.help],
        close: [x, column.close],
      },
      scale,
      rule,
    );
  }
  return null;
}

/**
 * The top row on a frame `frame.width` x `frame.height` points: each
 * button's tap zone, each icon's box, the size a host's own vector icon is
 * drawn at and the icons' opacity.
 *
 * Her distances from the frame's edges, scaled by its height over 852 pt:
 * sound and help from the left edge, close from the right. Across and in
 * size a frame counts as at least 658 pt tall, so the 44 pt zones of sound
 * and help never overlap, and no frame counts as taller than 960 pt, her
 * tallest screens. A frame with a notch or an island, its top inset deeper
 * than 24 pt, has her row's height, its zones moved down only as far as
 * the inset needs. One without (a status bar of 24 pt or less, a desktop
 * popup) has it below its top inset by her gap, scaled by the frame's
 * height in the screen's own pixels (`options.pixelRatio`, at most 3, and
 * 3 unless given): its zones may reach into a status bar, as hers do on
 * the iPhone SE, but never above the frame, and its icons stay below the
 * status bar. The left pair moves right and close left only as far as
 * `insets` need.
 * The iPhone Duo, known by its frame, has her row on its system icons' line
 * upright and her column under them on its side, whatever its insets.
 */
export function placeHud(
  frame: { readonly width: number; readonly height: number },
  insets: TopRowInsets = {},
  options: TopRowOptions = {},
): HudPlaces {
  const rule = options.rule ?? TOP_ROW_RULE;
  const duo = placeDuo(frame, rule);
  if (duo) return duo;
  const tall = Math.min(rule.maxHeight, frame.height);
  const scale = Math.max(rule.minHeightAcross, tall) / rule.referenceHeight;
  const half = rule.button / 2;
  const known = insets.top !== undefined && Number.isFinite(insets.top);
  const top = inset(insets.top);
  const notch = known
    ? top > rule.noNotch.maxTopInset
    : (options.unknownTop ?? 'notch') === 'notch';
  const pixels =
    tall * pixelsAPoint(options.pixelRatio, rule.noNotch.pixelRatio);
  const tallestIcon = Math.max(
    ...Object.values(rule.icons).map(([, height]) => height * scale),
  );
  const y = notch
    ? Math.max((rule.centreY * tall) / rule.referenceHeight, top + half)
    : Math.max(
        top + (rule.noNotch.gap * pixels) / rule.noNotch.gapPixels,
        top + tallestIcon / 2,
        half,
      );
  const left = inset(insets.left);
  const right = inset(insets.right);
  const shift = Math.max(0, left - (rule.sound * scale - half));
  return boxes(
    notch ? 'notch' : 'no-notch',
    {
      sound: [rule.sound * scale + shift, y],
      help: [rule.help * scale + shift, y],
      close: [
        Math.min(frame.width - rule.close * scale, frame.width - right - half),
        y,
      ],
    },
    scale,
    rule,
  );
}

/**
 * The top row's tap zones alone, as `placeHud` places them: what
 * `GameTopRow.buttons` is.
 */
export function placeTopRow(
  frame: { readonly width: number; readonly height: number },
  insets: TopRowInsets = {},
  options: TopRowOptions = {},
): TopRowButtons {
  return placeHud(frame, insets, options).buttons;
}
