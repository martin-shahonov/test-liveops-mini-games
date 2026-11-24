/**
 * Every event the scratcher reports through `onError`, with when it is
 * reported and the keys of the context that comes with it.
 */
export const EVENTS = {
  /**
   * A scratch whose claim did not pay out, or whose reward the player never
   * saw; the error is a `GameError`, whose reason says which, `reward-late`
   * and `reward-after-close` included. `{ reason, card, cells, reward? }`:
   * the card's id, how many cells it has, and the reward for the reasons
   * that carry one.
   */
  scratchFailed: 'daily_scratcher_scratch_failed',
  /** A host callback threw. `{}`. */
  hookFailed: 'daily_scratcher_hook_failed',
  /**
   * The host's celebration failed, or the celebration outlasted its limits;
   * COLLECT was offered anyway. `{ card }`, the card's id.
   */
  celebrateFailed: 'daily_scratcher_celebrate_failed',
  /**
   * The coin shower drew no frame for 15 s, or ran on past 60 s, so the win
   * screen was taken down without its end. `{ card }`, the card's id.
   */
  showerStalled: 'daily_scratcher_shower_stalled',
  /**
   * The card cannot be played, so the trays take no finger and Quick
   * Scratch is off: no winning symbols, more than the three its box shows,
   * no cells, a winning symbol that is not a name, a prize that is not a
   * non-negative number, or a symbol the skin has no art for. Once per card. `{ card, cardFaults,
   * unknownSymbols }`: the card's id, what the rules' `cardFaults` found,
   * each with its reason and the indices it names, and the symbol ids the
   * skin cannot draw.
   */
  invalidCard: 'daily_scratcher_invalid_card',
  /**
   * The host named a skin the scratcher has no art for, so the generic
   * card is drawn. Once per skin name a screen is given; no skin at all is
   * not reported. `{ skin }`, the name as the host gave it.
   */
  unknownSkin: 'daily_scratcher_unknown_skin',
  /**
   * The card was shown before all of it was in, or its glow was not lit in
   * time after it was. `{ waiting, afterMs }`, the parts still missing and
   * how long it waited in view.
   */
  slowReveal: 'daily_scratcher_slow_reveal',
  /**
   * The glow's sheet failed to load, so it is left out of the open: it
   * draws nothing until the screen opens again, and nothing waits for it.
   * Once. `{ glow }`, `'button'`; or `'animations'`, for the motion
   * designer's card animations, the four every card plays or a win's.
   */
  glowFailed: 'daily_scratcher_glow_failed',
  /** A sound failed to load, and stays silent. `{ file }`. */
  soundFailed: 'daily_scratcher_sound_failed',
  /**
   * Web only: CanvasKit failed to load, so nothing drawn through Skia can
   * draw: the trays with their foil and cells, the coin shower and the
   * particles. `{}`.
   */
  canvasKitFailed: 'daily_scratcher_canvaskit_failed',
  /**
   * Web only: the host passed no `loadCanvasKit` and CanvasKit is not on the
   * page, so the same art draws nothing. `{}`.
   */
  canvasKitMissing: 'daily_scratcher_canvaskit_missing',
  /**
   * A tray's foil, or one of a tray's tiles or symbols, failed to load:
   * that part draws without it and the open does not wait for it: a tray
   * without its foil shows its symbols, a cell without its tile or symbol
   * is still read out, and the card plays on, as after a lost context.
   * Once per part. `{ canvas }`: `traywinning` or `trayyours`, a tray's
   * foil; `artwinning` or `artyours`, its cells.
   */
  artFailed: 'daily_scratcher_art_failed',
  /**
   * Web only: the browser took a tray's GPU context away, as it does past
   * its limit of live contexts, so that canvas draws nothing from then on;
   * the card plays out through Quick Scratch's reveals. `{ canvas }`:
   * `traywinning` or `trayyours`.
   */
  contextLost: 'daily_scratcher_context_lost',
  /**
   * Never reported since the designer's direction 2, version 6, whose card
   * draws no campaign line; kept so a host that handles it still compiles.
   */
  campaignUnsupported: 'daily_scratcher_campaign_unsupported',
  /** A download ahead of an open failed. `{ skin }`, with the `file` or `step` that failed. */
  prefetchFailed: 'daily_scratcher_prefetch_failed',
} as const;

/** The name of an event the scratcher reports through `onError`. */
export type DailyScratcherEvent = (typeof EVENTS)[keyof typeof EVENTS];
