// Platform-neutral: nothing here may reference the DOM, React or a renderer.
// These are the game's shapes, not the backend's: the host maps its launch
// and play responses onto them, so a change here is a change to every host.

/**
 * What a prize pays in. The first cards pay coins only; a card carries the
 * type from the start so one can mix the two without a new shape.
 */
export type RewardType = 'Coins' | 'Tokens';

export type ScratcherPrize = { rewardType: RewardType; amount: number };

/** The skin's symbol id, such as `coin` or `ruby`. */
export type ScratcherSymbol = string;

/** One of YOUR SYMBOLS: the symbol and the prize printed under it. */
export type ScratcherCell = { symbol: ScratcherSymbol; prize: ScratcherPrize };

export type ScratcherCard = {
  /** The game entry the host launched. */
  id: number;
  /** The WINNING SYMBOLS box: three of them. */
  winning: readonly ScratcherSymbol[];
  /** YOUR SYMBOLS in row-major order: 9 or 12 of them. */
  cells: readonly ScratcherCell[];
  /**
   * Cells to a row. The trays are drawn for 9 cells as 3 x 3 and 12 as
   * 4 x 3, which `gridFor` pins whatever this says; another count is laid
   * out by it.
   */
  columns: number;
  /** The TOP PRIZE field: the most the card can pay. */
  topPrize?: ScratcherPrize;
};

/**
 * What a card pays: every cell whose symbol is among the winning ones, in
 * grid order, and their prizes added up by what they pay in.
 */
export type ScratcherOutcome = {
  matched: readonly number[];
  totals: Readonly<Partial<Record<RewardType, number>>>;
  /** `totals.Coins`, or 0: the amount the win screen counts up. */
  coins: number;
};

/** The server's answer to a play: the outcome it paid, on the card it paid it for. */
export type ScratcherReward = ScratcherOutcome & { cardId: number };
