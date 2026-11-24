// Platform-neutral: nothing here may reference the DOM, React or a renderer.
// The wire shapes below are the Betty backend's; changing them is cross-team.

export type WheelSector = {
  id: number;
  targetType: 'Coins';
  winAmount: number;
  isSpecialSector: boolean;
};

export type WheelReward = WheelSector & {
  balance: number;
  /**
   * When the next spin is available, as an ISO 8601 date-time, for the
   * host's countdown. Left out when the backend sends none: the wheel reads
   * neither this nor `balance`, and nothing makes a date up in its place.
   */
  nextAvailableAt?: string;
};
