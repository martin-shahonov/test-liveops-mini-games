/** Where a browser window becomes a popup - the host's own breakpoint. */
export const DESKTOP_FROM = 1000;

/** The 1290 x 2796 artboard every composition is drawn for, in points. */
export const PHONE_FRAME = { width: 430, height: 932 } as const;

export const DESKTOP_WIDTH_SHARE = 0.9;

/**
 * The share of the window's height the popup takes, when that is less than
 * the board's.
 */
export const DESKTOP_HEIGHT_SHARE = 0.94;

/** The popup's corner radius, in points; a full-screen sheet is square. */
export const SHEET_RADIUS = 24;

/**
 * The shape of a game's desktop popup: its width over its height, and the
 * tallest it gets, in points. It shrinks with a short or narrow window as
 * the square does.
 */
export type DesktopShape = { aspect: number; maxHeight: number };

/**
 * The popup every game opens in unless it asks for another shape: a square
 * at most, as tall as the board. The wheel's backdrop art is a square
 * fitted to the frame's height, so a popup wider than it is tall would run
 * past the art.
 */
export const SQUARE_POPUP: DesktopShape = {
  aspect: 1,
  maxHeight: PHONE_FRAME.height,
};

export type GameFrameInput = {
  width: number;
  height: number;
  isTouch: boolean;
};

function takesWholeScreen({ width, isTouch }: GameFrameInput): boolean {
  return isTouch || width < DESKTOP_FROM;
}

// The popup at its shape, as tall as the shape allows and the window holds,
// and as wide as that height gives it and the window holds.
function desktopFrame(
  width: number,
  height: number,
  shape: DesktopShape,
): { width: number; height: number } {
  const frameHeight = Math.min(
    shape.maxHeight,
    Math.round(height * DESKTOP_HEIGHT_SHARE),
  );
  return {
    width: Math.min(
      Math.round(frameHeight * shape.aspect),
      Math.round(width * DESKTOP_WIDTH_SHARE),
    ),
    height: frameHeight,
  };
}

/** The box the game draws into, in points; on a desktop, a popup of `shape`. */
export function gameFrame(
  input: GameFrameInput,
  shape: DesktopShape = SQUARE_POPUP,
): {
  width: number | '100%';
  height: number;
} {
  const { width, height } = input;

  if (takesWholeScreen(input)) {
    return { width: '100%', height };
  }

  return desktopFrame(width, height, shape);
}

/**
 * The corner radius of the sheet `gameSheetPresentation` opens, in points,
 * for the game to clip what it draws to.
 */
export function gameSheetRadius(input: GameFrameInput): number {
  return takesWholeScreen(input) ? 0 : SHEET_RADIUS;
}

export type GameSheetPresentation = {
  snapPoints?: string[];
  topInset?: number;
  /** Always null: `hideHeader` leaves a spacer that pushes the art down. */
  handleComponent: null;
  bottomInset?: number;
  style?: {
    maxWidth?: number;
    marginHorizontal?: number;
    borderRadius?: number;
  };
};

/** The sheet geometry the host should open the game with; on a desktop, a popup of `shape`. */
export function gameSheetPresentation(
  input: GameFrameInput,
  shape: DesktopShape = SQUARE_POPUP,
): GameSheetPresentation {
  const { width, height } = input;

  if (takesWholeScreen(input)) {
    return {
      snapPoints: ['100%'],
      topInset: 0,
      handleComponent: null,
      style: { borderRadius: 0 },
    };
  }

  const frame = desktopFrame(width, height, shape);

  return {
    handleComponent: null,
    bottomInset: Math.max(20, Math.round((height - frame.height) / 2)),
    // An explicit margin, not `auto`: Yoga resolves `auto` on web but leaves
    // the sheet flush left on Android.
    style: {
      maxWidth: frame.width,
      marginHorizontal: Math.max(0, Math.round((width - frame.width) / 2)),
      borderRadius: SHEET_RADIUS,
    },
  };
}
