import type { ScratcherPlacement } from './DailyScratcherScreen.types';
import type { ScratcherStillName } from './skins/types';

/**
 * Which no-win plate a card shows where its skin shows one, and which words
 * end it with no match, by where it came from: the daily card's tells its
 * player to come back tomorrow, and a bonus or a bought card, whose player
 * is not coming back tomorrow for another, wishes better luck next time.
 * The plates bake their text; `labels.noMatch` is what a screen reader
 * hears.
 */
export function noWinPlate(
  placement: ScratcherPlacement,
): Extract<ScratcherStillName, 'nowin' | 'nowinagain'> {
  return placement === 'daily' ? 'nowin' : 'nowinagain';
}
