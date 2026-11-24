export type {
  RewardType,
  ScratcherCard,
  ScratcherCell,
  ScratcherOutcome,
  ScratcherPrize,
  ScratcherReward,
  ScratcherSymbol,
} from './types';

export {
  MOST_WINNING_SYMBOLS,
  cardFaults,
  isPlayableCard,
  scratcherOutcome,
} from './outcome';
export type { CardFault } from './outcome';

export { scratcherWinTier } from './winTier';

export { reconcileScratcherReward } from './reconcile';

export { formatPrizeAmount } from './format';

export { cellIndex, cellPosition, gridFor } from './grid';
export type { Grid } from './grid';

export {
  BOX_DONE_SHARE,
  CELL_REVEALED_SHARE,
  IDLE_READ_SHARE,
  READ_SHARE,
  REVEAL_AREA_CAP,
  WINNING_AREA_SHARE,
  WINNING_IDLE_AREA_SHARE,
  WINNING_REVEAL,
  YOURS_DWELL_GLYPH_INK_SHARE,
  YOURS_GLYPH_INK_SHARE,
  YOURS_REVEAL,
  YOURS_SYMBOL_INK_SHARE,
  boxDone,
  boxRead,
  cellRead,
  cellRevealed,
  dwellRead,
  idleClean,
  matchCalled,
  revealedCells,
  valueWaived,
} from './reveal';
export type { RevealRule } from './reveal';
