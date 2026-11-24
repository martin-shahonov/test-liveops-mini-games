export type { WheelSector, WheelReward } from './types';

export {
  TAU,
  POINTER_ANGLE,
  sectorArc,
  sectorCentre,
  normalise,
  findSectorIndex,
  restingRotationFor,
  sectorAtRotation,
  spinDistance,
  randomJitter,
} from './geometry';

export {
  DEFAULT_SPIN_START,
  FLICK,
  LAUNCH_AT_MS,
  SPIN_TIMING,
  THROW_MS,
} from './timing';
export type { SpinLaunch, SpinStart } from './timing';

export { GAME_ERROR_REASONS, GameError, isGameError } from './errors';
export type { GameErrorReason } from './errors';
export { reconcileReward } from './reconcile';

export { winTierFor } from './winTier';
export type { WinTier } from './winTier';
