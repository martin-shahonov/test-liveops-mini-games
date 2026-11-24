import type { RewardType, ScratcherCard, ScratcherOutcome } from './types';

/**
 * The most winning symbols a card names. The WINNING SYMBOLS box shows them
 * in one row of three, so a fourth would be laid out below the box, out of
 * sight, and the box could not be scratched clear around it.
 */
export const MOST_WINNING_SYMBOLS = 3;

/**
 * Why a card cannot be played, with what is at fault. A card with no
 * winning symbols or no cells has nothing to match, and one with more
 * winning symbols than its box shows hides some; a winning symbol that is
 * not a string can never equal a cell's; a prize amount that is negative,
 * not finite or not a number at all could be printed as anything.
 */
export type CardFault =
  | { reason: 'no-winning-symbols' }
  | { reason: 'too-many-winning-symbols'; count: number }
  | { reason: 'no-cells' }
  | { reason: 'invalid-winning-symbol'; indices: readonly number[] }
  | { reason: 'invalid-amount'; cells: readonly number[]; topPrize: boolean };

const isValidAmount = (amount: number): boolean =>
  Number.isFinite(amount) && amount >= 0;

const indicesWhere = <T>(
  items: readonly T[],
  test: (item: T) => boolean,
): number[] => items.flatMap((item, index) => (test(item) ? [index] : []));

/** Every fault on a card, each once. The screen reports them and keeps the foil on. */
export function cardFaults(card: ScratcherCard): CardFault[] {
  const faults: CardFault[] = [];
  if (card.winning.length === 0) faults.push({ reason: 'no-winning-symbols' });
  if (card.winning.length > MOST_WINNING_SYMBOLS) {
    faults.push({
      reason: 'too-many-winning-symbols',
      count: card.winning.length,
    });
  }
  if (card.cells.length === 0) faults.push({ reason: 'no-cells' });

  const indices = indicesWhere(
    card.winning,
    (symbol) => typeof symbol !== 'string',
  );
  if (indices.length) {
    faults.push({ reason: 'invalid-winning-symbol', indices });
  }

  const cells = indicesWhere(
    card.cells,
    (cell) => !isValidAmount(cell.prize.amount),
  );
  const topPrize =
    card.topPrize !== undefined && !isValidAmount(card.topPrize.amount);
  if (cells.length || topPrize) {
    faults.push({ reason: 'invalid-amount', cells, topPrize });
  }

  return faults;
}

export const isPlayableCard = (card: ScratcherCard): boolean =>
  cardFaults(card).length === 0;

/**
 * What the card pays. A symbol listed twice among the winning ones matches
 * a cell once. Throws on a card that cannot be played rather than read a
 * prize off it; the screen checks `isPlayableCard` before a finger or Quick
 * Scratch can start a claim.
 */
export function scratcherOutcome(card: ScratcherCard): ScratcherOutcome {
  const faults = cardFaults(card);
  if (faults.length) {
    throw new Error(
      `The card cannot be played: ${faults.map((fault) => fault.reason).join(', ')}`,
    );
  }

  const matched: number[] = [];
  const totals: Partial<Record<RewardType, number>> = {};
  card.cells.forEach((cell, index) => {
    if (!card.winning.includes(cell.symbol)) return;
    matched.push(index);
    const { rewardType, amount } = cell.prize;
    totals[rewardType] = (totals[rewardType] ?? 0) + amount;
  });

  return { matched, totals, coins: totals.Coins ?? 0 };
}
