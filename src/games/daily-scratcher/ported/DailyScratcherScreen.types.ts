// From MiniGames games/scratcher/src/DailyScratcherScreen.types.ts (0.11.0): the host's props, kept for their labels and types.
import type { WinTier } from '../../../shared/ported/engine';
/** How the coin shower's coins sound: see MiniGames' `coinShowerSound`. */
export type CoinShowerSound = 'auto' | 'bed' | 'perCoin';
import type { DailyScratcherEvent } from './events';
import type { ScratcherCard, ScratcherOutcome, ScratcherReward } from './rules';
import type { ScratcherSymbolId } from './skins/symbols';
/** The host's own top row (MiniGames' `ScratcherTopRow`): not drawn by the Pixi port. */
type ScratcherTopRow = unknown;


/** Already translated by the host - this package carries no locale data. */
export type DailyScratcherLabels = {
  /** The title block's words, read as the screen's heading; the art bakes them. */
  title: string;
  /** Drawn on the button in capitals while the card is played, and read out. */
  quickScratch: string;
  /** Drawn on the button in capitals once the outcome shows, which ends the card, and read out. */
  collect: string;
  /** Read out for the help button the game draws when the host draws no top row, and names its How To Play. */
  howToPlay: string;
  /**
   * What the sound button in the game's own top row reads out, when the
   * host draws no top row: what a press does, `soundOn` while muted and
   * `soundOff` while it plays.
   */
  soundOn: string;
  soundOff: string;
  /** How To Play's three steps, beside their pictures, `\n` breaking them. */
  howToPlaySteps: readonly [string, string, string];
  /** The Prize not confirmed popup's button. */
  okay: string;
  /**
   * What a screen reader hears as a daily card ends with no match: the
   * words a skin's no-win plate bakes, where it shows one.
   */
  noMatch: string;
  /** The same for a bonus or a bought card, which wishes better luck next time. */
  noMatchAgain: string;
  /**
   * Kept for hosts that pass them: a failed claim is said by its popup
   * (`somethingWentWrong` and the rest) since 0.11, not by a line.
   */
  failed: string;
  unavailable: string;
  jackpot: string;
  mega: string;
  nice: string;
  /**
   * Read out for the close button the game draws when the host draws no top
   * row and for the drawer's cross, and How To Play's Close pill.
   */
  close: string;
  /**
   * What a screen reader hears the coin loader as, announced once as it
   * comes up over the cover of a card that is slow to open, or as a host's
   * placeholder draws it (`ScratcherLoading`).
   */
  loading: string;
  /** The two trays, for a screen reader. */
  winningSymbols: string;
  yourSymbols: string;
  /** How a tray's label counts its cells still under the coating: "9 covered". */
  covered: string;
  /** Before the matched symbols' names, as a win is read out. */
  matched: string;
  /** The unit after a tokens total, as a win is read out. */
  tokens: string;
  /** Each symbol's spoken name, by the id a card names it with. */
  symbols: Readonly<Record<ScratcherSymbolId, string>>;
  /** The TOP PRIZE plaque, for a screen reader; the card bakes its label. */
  topPrize: string;
  /** How to win, read as the YOUR SYMBOLS tray's hint: the design shows no instruction line. */
  matchHint: string;
  /**
   * The system popups, the wheel's, shown for a claim that failed: No
   * connection (the device was offline, nothing was sent; Retry claims the
   * card again, leaving it as it is), Connection lost (the answer was lost;
   * Reconnect closes the card), Something went wrong (the host refused the
   * claim; Try again claims it again, as Retry does) and Prize not
   * confirmed (any other failure; Okay puts it away over the locked card).
   * Each detail's `\n` breaks it.
   */
  noConnection: string;
  noConnectionDetail: string;
  retry: string;
  connectionLost: string;
  connectionLostDetail: string;
  reconnect: string;
  somethingWentWrong: string;
  somethingWentWrongDetail: string;
  tryAgain: string;
  prizeNotConfirmed: string;
  prizeNotConfirmedDetail: string;
};

/**
 * The host's strings, each optional: whatever is left out falls back to
 * English, the symbols' names one by one.
 */
export type DailyScratcherLabelsInput = Partial<
  Omit<DailyScratcherLabels, 'symbols'>
> & {
  symbols?: Partial<Record<ScratcherSymbolId, string>>;
};

/**
 * Where the card came from: the day's, a bonus for an offer, or a bought
 * one. The game plays each the same, but for what a card with no match
 * says (`noMatch` or `noMatchAgain`): only the daily card's player is told
 * to come back tomorrow. It echoes it in its lifecycle events for the host.
 */
export type ScratcherPlacement = 'daily' | 'bonus' | 'shop';

/**
 * A scratch has started, its claim asked for: by the first stroke on a
 * tray, by Quick Scratch, or, for a card offered again after a refused
 * claim, by Retry or Try again on the popup that said so, which claims it
 * again before the player scratches on. `scratch` is its number on this
 * screen, counted from 1, as a card offered again starts another.
 */
export type ScratchStartEvent = { scratch: number };

/**
 * The card is fully revealed and its outcome known and reconciled: every
 * matched cell and the totals by what they pay in, and the win's tier for
 * a total above zero; a card with no match has no tier.
 */
export type RevealEvent = { outcome: ScratcherOutcome; tier?: WinTier };

/** Where the coin shower falls on the win screen: see `coinShowerLayer`. */
export type CoinShowerLayer = 'underDim' | 'overDim';

export type DailyScratcherScreenProps = {
  /** The card from the host's launch: its winning symbols, its cells with their prizes, and its top prize. */
  card: ScratcherCard;
  /**
   * Claims the card's reward, once, as the first stroke or Quick Scratch
   * starts; the cells scratched before it answers wait for it. The card is
   * offered again, its foil back on, after two rejections alone:
   * `GameError('reward-unavailable')`, nothing awarded, and
   * `GameError('reward-offline')`, the claim never sent.
   */
  getReward: () => ScratcherReward | Promise<ScratcherReward>;
  /**
   * The reward, once, as the card ends: when its player presses COLLECT,
   * which the button reads once the outcome shows (after the win screen has
   * played out, or as a card with no match ends), or when the card is closed or
   * unmounted once its outcome is final (both boxes done and the claim
   * answered), whichever comes first; on the game's own close it follows
   * `onClose`. After a close before that, a confirmed reward is reported as
   * `reward-after-close`, unless both boxes were done and the claim answers
   * before the unmount, when it follows `onClose`. It carries the matched
   * cells and what they pay in each type, `totals.Coins` and `totals.Tokens`:
   * the win screen counts the coins, and the tokens in a row of their own
   * with no icon, since the game cannot draw the host's.
   */
  onFinish: (reward: ScratcherReward) => void;
  onClose: () => void;
  /** See `DailyScratcherEvent` for what is reported, and when. */
  onError: (
    event: DailyScratcherEvent,
    error: unknown,
    context: Record<string, unknown>,
  ) => void;
  /**
   * The skin the card is drawn with, one of `SCRATCHER_SKINS`. A name the
   * scratcher has no art for draws the generic card and is reported once
   * as `daily_scratcher_unknown_skin`; no skin draws it too, unreported.
   */
  skin?: string;
  /** Where the card came from; `'daily'` when left out. See `ScratcherPlacement`. */
  placement?: ScratcherPlacement;
  labels?: DailyScratcherLabelsInput;
  /**
   * Unused since the designer's direction 2, version 6, whose card has no
   * campaign line: accepted and ignored, so a host that passes one still
   * compiles. Nothing is drawn or read for it.
   */
  campaign?: string;
  /**
   * Draws the top row in the host's own design: each button centred in its
   * 44 pt tap zone in `row.buttons` and its icon at `row.icons`, in the game
   * frame's points, which keep the designer's distances from the frame's
   * edges. Without it the game draws the designer's row: sound, help and
   * close. It runs during the game's render, so a throw from it reaches the
   * host's error boundary; the row's presses reach the host through the
   * game, which reports a throw from one.
   */
  renderTopRow?: (row: ScratcherTopRow) => unknown;
  /**
   * The insets of the window the system covers, points, as
   * `useSafeAreaInsets()` gives them. The top row keeps its buttons inside
   * them on any frame that fills the window, and its top tells the row
   * whether the screen has a notch: deeper than 24 pt, the designer's notch
   * row; 24 pt or less, her row that margin below it. Left out, an app's
   * row sits as under a notch and a web page's as with none. The iPhone Duo
   * has her places for it, upright and on its side, whatever its insets. In
   * the desktop popup they are ignored. The deprecated `row.box` keeps clear
   * of them as before, on a frame wider than tall, which fits the card's
   * band.
   */
  safeArea?: { top?: number; left?: number; right?: number };
  /**
   * Opens the host's How To Play in place of the game's own overlay. It
   * reaches the top row as `onHelp`; without it the row's `onHelp` opens
   * the game's.
   */
  onHelp?: () => void;
  /** Shows the game's How To Play once as the card is shown, for a first visit. */
  howToPlayOnOpen?: boolean;
  /**
   * Loads CanvasKit, which the web draws the trays, the coin shower and the
   * particles through; needed on the web alone, where the light of the win's
   * lockup and the coin's flip draw in a 2D canvas instead. It must resolve only
   * once CanvasKit is on `globalThis`, and hand back one shared promise: the
   * screen calls it more than once, and `prefetchDailyScratcher` does too.
   * Without it, unless CanvasKit is already on the page, none of that art
   * draws, and the game reports `daily_scratcher_canvaskit_missing`.
   */
  loadCanvasKit?: () => Promise<void>;
  /**
   * Whether the game's sound is off, for a host that keeps the player's
   * choice: it then changes only as the host passes the choice back from
   * `onSoundMutedChange`. Left out, the game keeps it itself, starting with
   * sound on.
   */
  soundMuted?: boolean;
  /** The player turned the sound off or on, through the top row's toggle. */
  onSoundMutedChange?: (muted: boolean) => void;
  /**
   * How the coin shower's coins sound. `'bed'` plays the win tier's coins
   * baked into one file, once; `'perCoin'` plays every coin as its own
   * sound. `'auto'`, the default, is the bed on iOS, where each play
   * crosses react-native-sound's queue and the shower's 300 to 430 of them
   * congest it, and per coin on Android and the web. iOS loads the beds as
   * the screen opens; on the web `'bed'` loads the landed tier's as its
   * claim answers. Android's build carries no beds, since it never plays
   * them by default, so there `'bed'` plays per coin. Read as each claim
   * answers and each shower starts, so a change applies from the next win.
   */
  coinShowerSound?: CoinShowerSound;
  /**
   * Where the coin shower falls on the win screen: `'overDim'`, the
   * default, over the dim that comes up with the win's own art and under the
   * particles and the win's text, so the coins keep their full light; or
   * `'underDim'`, under it, so the coins darken with the card. A change
   * shows at once, even mid-win.
   */
  coinShowerLayer?: CoinShowerLayer;
  /**
   * The resting card is on screen: every still in, the trays drawn with
   * their foil intact, the backdrop up and the face of the buttons' words
   * loaded. Called once, as Quick Scratch and the trays first answer: at the
   * reveal, as the cover comes off; or, after a reveal forced at about 2.5 s
   * in view before both trays have drawn their coatings, as on a slow first
   * visit on the web, once they have, which can be many seconds later, and
   * never on a card that can draw no coating. Until then the game draws its
   * own cover, with the top row above it, and its own coin loader once the
   * open runs late, so a host draws nothing over the game while it opens: a
   * placeholder kept over it until this is called would hide the loader.
   * With `showLoadingCover` false there is no cover to keep the card under,
   * so it comes at the reveal, coated or not.
   */
  onReady?: () => void;
  /**
   * Whether the game keeps an opaque cover over its art until the resting
   * card is in, and then shows it in one frame: the two-stage reveal, the
   * default and the one recommended. False draws no cover and no coin
   * loader: the board, the backdrop and the top row show at once, and the
   * stills and the trays as each loads. Either way the trays take no finger
   * and Quick Scratch answers nothing until the resting card is in, or a
   * reveal forced at about 2.5 s shows it, as `onReady` is called, and until
   * then a screen reader reaches none of the card; with the cover, a card
   * so shown stays covered until both trays have drawn their coatings.
   */
  showLoadingCover?: boolean;
  /**
   * Called once, as the screen mounts: the moment to warm a celebration up,
   * so `onCelebrate` can start it at once. A throw inside this or either
   * scratch hook is reported, never fatal to a scratch.
   */
  onOpen?: () => void;
  /** A scratch has started, its claim asked for: see `ScratchStartEvent`. */
  onScratchStart?: (event: ScratchStartEvent) => void;
  /** The card is fully revealed and its outcome known: see `RevealEvent`. */
  onReveal?: (event: RevealEvent) => void;
  /**
   * The host's own celebration, played alongside the game's win screen.
   * COLLECT is offered once both are over, the win screen's part once it
   * has played out, at a time by tier that the README gives under
   * `onFinish`; the reward waits for it.
   */
  onCelebrate?: (tier: WinTier) => Promise<void> | void;
};
