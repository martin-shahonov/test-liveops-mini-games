import { GameError } from '../../../../shared/ported/engine';
import { withoutFloatNoise } from './format';
import { scratcherOutcome } from './outcome';
import type { ScratcherCard, ScratcherOutcome, ScratcherReward } from './types';

/**
 * The outcome a reward confirms, or why the card must not show it. The
 * reward has to be this card's and name the cells the card matches, paying
 * what they show, or the player is shown one win while the host credits
 * another. The reasons are the ones every game reports, so a host handles
 * them alike: `reward-not-on-wheel` is a reward for another card. Throws,
 * as `scratcherOutcome` does, on a card that cannot be played; no claim is
 * made on one.
 */
export function reconcileScratcherReward(
  card: ScratcherCard,
  reward: ScratcherReward,
): { outcome: ScratcherOutcome } | GameError<ScratcherReward> {
  if (reward.cardId !== card.id) {
    return new GameError(
      'reward-not-on-wheel',
      `Reward is for card ${reward.cardId}, not for card ${card.id}`,
      { reward },
    );
  }

  // A host's service can answer outside its types: a reward without its
  // cells as a list or its totals as an object names other cells or totals
  // than the card's, and is refused rather than read.
  const { matched, totals } = reward as Partial<ScratcherReward>;
  if (
    !Array.isArray(matched) ||
    typeof totals !== 'object' ||
    totals === null
  ) {
    return new GameError(
      'reward-amount-mismatch',
      'Reward names no list of matched cells, or no totals',
      { reward },
    );
  }

  const outcome = scratcherOutcome(card);
  if (!sameCells(outcome.matched, reward.matched)) {
    return new GameError(
      'reward-amount-mismatch',
      `Reward matches cells ${listOf(reward.matched)} but the card matches ${listOf(outcome.matched)}`,
      { reward },
    );
  }
  if (!sameTotals(outcome, reward)) {
    return new GameError(
      'reward-amount-mismatch',
      `Reward pays ${paysText(reward)} but the card shows ${paysText(outcome)}`,
      { reward },
    );
  }
  if (!sameAmount(outcome.coins, reward.coins)) {
    return new GameError(
      'reward-amount-mismatch',
      `Reward counts ${reward.coins} coins but the card shows ${outcome.coins}`,
      { reward },
    );
  }

  return { outcome };
}

const ascending = (indices: readonly number[]): number[] =>
  [...indices].sort((a, b) => a - b);

/** The same cells, in whatever order the server lists them. */
function sameCells(
  ours: readonly number[],
  theirs: readonly number[],
): boolean {
  if (ours.length !== theirs.length) return false;
  const sorted = ascending(theirs);
  return ascending(ours).every((index, i) => index === sorted[i]);
}

/**
 * The same amount, as far as a double carries one: the card adds its
 * cells' prizes in grid order and the server in its own, and a fractional
 * amount's sum can differ in the last place by the order alone, 0.1 + 0.2 +
 * 0.3 against 0.3 + 0.2 + 0.1. Whatever is not a number is no amount.
 */
function sameAmount(ours: number, theirs: unknown): boolean {
  if (ours === theirs) return true;
  return (
    typeof theirs === 'number' &&
    withoutFloatNoise(ours) === withoutFloatNoise(theirs)
  );
}

/** The same total for every type either side names, an absent one being zero. */
function sameTotals(ours: ScratcherOutcome, theirs: ScratcherOutcome): boolean {
  const types = new Set([
    ...Object.keys(ours.totals),
    ...Object.keys(theirs.totals),
  ]);
  return [...types].every((type) =>
    sameAmount(totalOf(ours, type), totalOf(theirs, type)),
  );
}

const totalOf = ({ totals }: ScratcherOutcome, type: string): number =>
  (totals as Readonly<Partial<Record<string, number>>>)[type] ?? 0;

const listOf = (indices: readonly number[]): string =>
  indices.length ? ascending(indices).join(', ') : 'none';

function paysText({ totals }: ScratcherOutcome): string {
  const parts = Object.entries(totals).map(
    ([type, amount]) => `${String(amount)} ${type}`,
  );
  return parts.length ? parts.join(' and ') : 'nothing';
}
