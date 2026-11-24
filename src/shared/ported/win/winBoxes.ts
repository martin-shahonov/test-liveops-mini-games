// Constants from MiniGames packages/win/src/winBoxes.ts (0.11.0): the rest is laid out in the skin's boxes.

export const WIN_PIXEL = 1290 / 1320 / 3;

/**
 * How many frames more each tier's lockup holds its settled frame than its
 * export does: a second, so the landed total sits still on screen for longer
 * before the win goes.
 */
export const LOCKUP_HOLD_FRAMES = 30;

/**
 * The coin's flip is 250 px frames: its disc is 174.483 px across where the
 * still's is 170.90, so it is drawn at that ratio, centred on the still's
 * canvas.
 */
export const COIN_FLIP = { frame: 250, scale: 170.9 / 174.483 } as const;

