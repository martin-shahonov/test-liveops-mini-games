/**
 * Every event the wheel reports through `onError`, with when it is reported
 * and the keys of the context that comes with it.
 */
export const EVENTS = {
  /**
   * A spin that did not pay out, or whose reward the player never saw; the
   * error is a `GameError`, whose reason says which, `reward-late` and
   * `reward-after-close` included. `{ reason, sectors, reward? }`.
   */
  spinFailed: 'daily_wheel_spin_failed',
  /** A host callback threw. `{}`. */
  hookFailed: 'daily_wheel_hook_failed',
  /**
   * The host's celebration failed, or the celebration outlasted its limits;
   * the reward was handed over anyway. `{ reward }`, the reward's id.
   */
  celebrateFailed: 'daily_wheel_celebrate_failed',
  /**
   * The coin shower drew no frame for 15 s, or ran on past 60 s, so the win
   * screen was taken down without its end. `{ reward }`, the reward's id.
   */
  showerStalled: 'daily_wheel_shower_stalled',
  /**
   * With `unknownSector: 'showAmount'`, a reward whose id is none of the
   * sectors was won without a landing, its amount shown and handed to
   * `onFinish` as any win's: the host's sectors are not the backend's. Not a
   * failure, and the error carries no reward to reconcile.
   * `{ reward, sectors }`, the reward's id and the count of sectors.
   */
  rewardOffWheel: 'daily_wheel_reward_off_wheel',
  /** A sector's amount is not a non-negative number, so Spin is off. `{ sectors, sectorIds }`. */
  invalidPrize: 'daily_wheel_invalid_prize',
  /** The wheel has no sectors, so Spin is off. `{ sectors }`. */
  noSectors: 'daily_wheel_no_sectors',
  /**
   * The host named a tier the wheel has no art for, so the Member wheel is
   * drawn. Once per tier name a screen is given; no tier at all is not
   * reported. `{ loyaltyTier }`, the name as the host gave it.
   */
  unknownTier: 'daily_wheel_unknown_tier',
  /**
   * The wheel was shown before all of it was in, or its glows were not lit
   * in time after it was. `{ waiting, afterMs }`, the parts still missing
   * and how long it waited in view: 2500, or 10000 for glows a spin, or a
   * decode ahead of theirs, held back past their own 2500.
   */
  slowReveal: 'daily_wheel_slow_reveal',
  /**
   * A glow's sheets failed to load, so it is left out of the open: it draws
   * nothing until the screen opens again, and nothing waits for it. Once
   * per glow. `{ glow }`, `'sector'`, `'title'` or `'button'`.
   */
  glowFailed: 'daily_wheel_glow_failed',
  /**
   * An image of the resting wheel failed to load as the wheel drew it, so
   * the wheel is shown without it: the rim, the face, the gem, the pointer,
   * a word of the title, Spin, or a glyph sheet of the amounts, by its part
   * (`onLight`, `onDark`). Spin's fails when one of its sprites does, or the
   * face of its word, which is then drawn in the platform's. Once per part.
   * `{ part }`.
   */
  artFailed: 'daily_wheel_art_failed',
  /**
   * The floor's still failed to load, and failed again when it was loaded a
   * second time, so the floor under the cut backdrop video shows the board's
   * colour for the open. `{ cut }`, `'portrait'` or `'square'`.
   */
  floorFailed: 'daily_wheel_floor_failed',
  /** A sound failed to load, and stays silent. `{ file }`. */
  soundFailed: 'daily_wheel_sound_failed',
  /**
   * Web only: CanvasKit failed to load, so the glows, the coin shower and the
   * particles draw nothing and the wheel plays without them. `{}`.
   */
  canvasKitFailed: 'daily_wheel_canvaskit_failed',
  /**
   * Web only: the host passed no `loadCanvasKit` and CanvasKit is not on the
   * page, so the same art draws nothing. `{}`.
   */
  canvasKitMissing: 'daily_wheel_canvaskit_missing',
  /** A download ahead of an open failed. `{ loyaltyTier }`, with the `file` or `step` that failed. */
  prefetchFailed: 'daily_wheel_prefetch_failed',
} as const;

/** The name of an event the wheel reports through `onError`. */
export type DailyWheelEvent = (typeof EVENTS)[keyof typeof EVENTS];
