export const SPIN_TIMING = {
  windUpMs: 480,
  windUpRadians: 0.38,
  windUpHoldMs: 130,
  launchMs: 820,
  /** One full turn while waiting for the prize; looped. */
  cruiseMs: 440,
  /**
   * Paired, not independent. The settle opens at the cruise speed however far
   * it goes, bending its curve to fit. An out-cubic opens at three times its
   * average speed, so with `settleTurns * TAU / settleMs * 3` on the cruise
   * speed the settle over its whole turns alone is a plain out-cubic, and the
   * rest of the way to the prize, up to a turn more, bends it only a little.
   */
  settleTurns: 5,
  settleMs: 6600,
} as const;

/**
 * How a spin leaves rest: `windUp` turns the wheel back and holds it there
 * before the launch, `instant` launches it at the press. Either way the
 * launch, the cruise and the settle are the same; only when they start
 * moves.
 */
export type SpinStart = 'windUp' | 'instant';

/**
 * The start a spin takes when the host names none: at the press, which gets
 * the wheel to full speed 610 ms sooner. The wind-up stays a host's choice.
 */
export const DEFAULT_SPIN_START: SpinStart = 'instant';

/**
 * How a spin leaves rest, as the wheel drives it: one of the host's
 * `SpinStart`s from the Spin button, or `flick`, a finger's release that
 * throws the wheel from its own speed (see `FLICK`). The host never names a
 * flick; a release does.
 */
export type SpinLaunch = SpinStart | 'flick';

/**
 * A release that throws the wheel, and how it joins the spin. The wheel is
 * already turning at the release speed, so the throw is a blend from that
 * speed to the cruise's, smooth in speed and in acceleration at both ends;
 * the cruise, the settle and the stop after it are every spin's.
 */
export const FLICK = {
  /**
   * From the release to the cruise speed. At the slowest flick the blend
   * pushes hardest, 1.5 x (cruise - minSpeed) / blend: 34.8 rad/s^2 over
   * 400 ms, with no jump in it at either end.
   */
  blendMs: 400,
  /** The slowest forward release that spins, in radians a second: under it the wheel eases to rest. */
  minSpeed: 5,
  /**
   * The fastest release speed the wheel takes, in radians a second: a
   * harder flick is held to it. 1.4 x the cruise, under the 1.5 x that the
   * sound's readings stop believing, so every reading after a release is
   * taken at its word.
   */
  maxSpeed: 20,
  /**
   * How far forward the finger must have turned the wheel since it last
   * changed direction, in radians: a jab or a tremor at lift-off is no
   * flick, while winding the wheel back and then flinging it is.
   */
  minTravel: 0.2,
} as const;

/** When the launch begins, in ms from the press, by how the spin starts; a flick is already launched at its release. */
export const LAUNCH_AT_MS: Readonly<Record<SpinLaunch, number>> = {
  windUp: SPIN_TIMING.windUpMs + SPIN_TIMING.windUpHoldMs,
  instant: 0,
  flick: 0,
};

/**
 * From the press to full speed, by how the spin starts: the launch, after
 * the wind-up and its hold where there is one. A flick's is its blend,
 * timed from the release.
 */
export const THROW_MS: Readonly<Record<SpinLaunch, number>> = {
  windUp: LAUNCH_AT_MS.windUp + SPIN_TIMING.launchMs,
  instant: LAUNCH_AT_MS.instant + SPIN_TIMING.launchMs,
  flick: FLICK.blendMs,
};
