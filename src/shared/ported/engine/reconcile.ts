import { GameError } from './errors';
import { findSectorIndex } from './geometry';
import type { WheelReward, WheelSector } from './types';

/**
 * The sector a reward lands on, or why the wheel must not land at all. The
 * amount has to match too, or the player is shown one number while the host
 * credits another.
 */
export function reconcileReward(
  sectors: readonly WheelSector[],
  reward: WheelReward,
): { index: number } | GameError {
  const index = findSectorIndex(sectors, reward.id);
  if (index < 0) {
    return new GameError(
      'reward-not-on-wheel',
      `Reward id ${reward.id} is not among the ${sectors.length} sectors`,
      { reward },
    );
  }

  const sector = sectors[index];
  if (!sector || sector.winAmount !== reward.winAmount) {
    return new GameError(
      'reward-amount-mismatch',
      `Reward ${reward.id} pays ${reward.winAmount} but sector ${index} shows ${sector?.winAmount}`,
      { reward },
    );
  }

  return { index };
}
