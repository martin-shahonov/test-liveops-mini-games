import { winTierFor } from '../../../../shared/ported/engine';
import type { WheelSector, WinTier } from '../../../../shared/ported/engine';
import type { ScratcherCard, ScratcherOutcome } from './types';

/**
 * How big a scratcher win was, by the wheel's rule over the card's distinct
 * coin prizes: the top value is the jackpot, the best third of the rest
 * mega, the rest nice. The TOP PRIZE field is the top value when the card
 * carries one, since it is the most the card can pay even when no single
 * cell shows it, and a total two matches add up to is ranked where it
 * falls. Ask only for a total above zero: no win is no tier.
 */
export function scratcherWinTier(
  outcome: ScratcherOutcome,
  card: ScratcherCard,
): WinTier {
  const amounts = card.cells
    .filter((cell) => cell.prize.rewardType === 'Coins')
    .map((cell) => cell.prize.amount);
  if (card.topPrize?.rewardType === 'Coins') amounts.push(card.topPrize.amount);

  // `winTierFor` ranks a wheel's sectors; the card's coin values stand in.
  const sectors: WheelSector[] = [...new Set(amounts)].map((winAmount, id) => ({
    id,
    targetType: 'Coins',
    winAmount,
    isSpecialSector: false,
  }));
  return winTierFor(outcome.coins, sectors);
}
