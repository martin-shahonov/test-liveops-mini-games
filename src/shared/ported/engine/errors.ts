import type { WheelReward } from './types';

/**
 * Why a game stopped without paying out. Only `reward-unavailable` and
 * `reward-offline` are safe to retry; the rest may follow a claim the server
 * has already committed. Every game reports these same reasons, so a host
 * handles them alike.
 */
export const GAME_ERROR_REASONS = [
  'reward-unavailable',
  // The host's: the device was offline, so the claim was never sent.
  'reward-offline',
  // The host's: the claim was sent, but the connection dropped before its
  // answer came, so the prize may have been awarded.
  'reward-connection-lost',
  'reward-unconfirmed',
  'reward-timeout',
  // A prize arrived after `reward-timeout`; the host reconciles it.
  'reward-late',
  // For a game without a wheel, a reward for another round than the one shown.
  'reward-not-on-wheel',
  'reward-amount-mismatch',
  'reward-after-close',
] as const;

export type GameErrorReason = (typeof GAME_ERROR_REASONS)[number];

/**
 * `R` is the reward the game hands over with the error, the wheel's unless
 * the game names its own, so a host reconciles what it was actually paid.
 */
export class GameError<R = WheelReward> extends Error {
  readonly reason: GameErrorReason;
  readonly reward?: R;

  constructor(
    reason: GameErrorReason,
    message: string,
    options?: { reward?: R; cause?: unknown },
  ) {
    super(
      message,
      options?.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = 'GameError';
    this.reason = reason;
    this.reward = options?.reward;
  }
}

/**
 * Narrow an `unknown` from a callback without instanceof across bundles. The
 * reason has to be one of the game's: another library's error can carry a
 * `reason` of its own, which a host switching over these would not handle.
 * The reward is not checked, only typed: the caller names its game's.
 */
export function isGameError<R = WheelReward>(
  error: unknown,
): error is GameError<R> {
  if (!(error instanceof Error)) return false;
  const reason: unknown = (error as { reason?: unknown }).reason;
  return (
    typeof reason === 'string' &&
    (GAME_ERROR_REASONS as readonly string[]).includes(reason)
  );
}
