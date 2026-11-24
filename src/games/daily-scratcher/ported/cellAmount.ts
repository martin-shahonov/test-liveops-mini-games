import { formatPrizeAmount } from './rules';
import type { ScratcherPrize } from './rules';

/**
 * The value sheets' glyph for the Betty coin, drawn before a coins amount
 * in the cells and on the top prize.
 */
export const VALUE_COIN = 'B';

/**
 * A prize amount as the card prints it, in the cells and on the top prize:
 * the rules' `formatPrizeAmount`, in full below 1,000 and always short
 * from there, to three significant digits (1K, 1.23K, 5K, 12.3K, 50K,
 * 1.23M; 9,999 reads 10K), as her board writes it. Empty for an amount the
 * card cannot print, which `cardFaults` reports before the card is ever
 * scratched. A screen reader hears the whole amount whatever this prints.
 */
export function cellAmount(amount: number): string {
  return formatPrizeAmount(amount);
}

/**
 * A prize as its value line prints it: the coin and the amount for coins,
 * the amount alone for tokens, which the sheets have no mark for. Empty
 * for an amount the card cannot print.
 */
export function valueText(prize: ScratcherPrize): string {
  const amount = cellAmount(prize.amount);
  if (amount === '') return '';
  return prize.rewardType === 'Coins' ? `${VALUE_COIN}${amount}` : amount;
}
