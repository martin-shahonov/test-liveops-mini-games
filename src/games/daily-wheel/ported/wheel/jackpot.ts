import type { WheelSector } from '../../../../shared/ported/engine';

/** Every sector carrying the top prize - a list, because two sectors can tie. */
export function jackpotIndices(sectors: readonly WheelSector[]): number[] {
  let best = -Infinity;
  for (const s of sectors) {
    if (Number.isFinite(s.winAmount) && s.winAmount > best) best = s.winAmount;
  }
  if (!Number.isFinite(best)) return [];

  const out: number[] = [];
  sectors.forEach((s, i) => {
    if (s.winAmount === best) out.push(i);
  });
  return out;
}

/**
 * Every sector the backend flags with `isSpecialSector`, for the resting
 * glow under `glowingSector: 'special'`. Only a flag that is `true` counts,
 * so one left out, or sent as something else, glows no sector.
 */
export function specialIndices(sectors: readonly WheelSector[]): number[] {
  const out: number[] = [];
  sectors.forEach((s, i) => {
    if (s.isSpecialSector === true) out.push(i);
  });
  return out;
}
