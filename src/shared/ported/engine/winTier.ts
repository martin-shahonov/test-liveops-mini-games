import type { WheelSector } from './types';

/** How big a win was, relative to the wheel it was won on rather than to a fixed amount. */
export type WinTier = 'jackpot' | 'mega' | 'nice';

/** Share of the remaining distinct values, not of sectors: repeated small prizes must not crowd out Mega. */
const MEGA_SHARE = 1 / 3;

/** The top distinct value is the jackpot, the best third of what remains is mega, and ties share a tier. */
export function winTierFor(
  winAmount: number,
  sectors: readonly WheelSector[],
): WinTier {
  // Non-finite amounts are dropped: a NaN makes `b - a` NaN and sorts to the front, taking the top prize.
  const values = [...new Set(sectors.map((s) => s.winAmount))]
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => b - a);
  if (!values.length) return 'nice';

  const top = values[0]!;
  if (winAmount >= top) return 'jackpot';

  const rest = values.slice(1);
  if (!rest.length) return 'nice';

  // Floor with no minimum of one: rounding up makes the lower prize on a two-value wheel a Mega win.
  const megaCount = Math.floor(rest.length * MEGA_SHARE);
  if (megaCount < 1) return 'nice';

  const megaFloor = rest[megaCount - 1]!;
  return winAmount >= megaFloor ? 'mega' : 'nice';
}
