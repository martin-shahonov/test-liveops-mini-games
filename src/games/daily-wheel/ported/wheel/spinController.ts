import {
  GameError,
  POINTER_ANGLE,
  SPIN_TIMING,
  TAU,
  isGameError,
  normalise,
  randomJitter,
  reconcileReward,
  restingRotationFor,
  sectorArc,
  spinDistance,
  type SpinLaunch,
  type WheelReward,
  type WheelSector,
} from '../../../../shared/ported/engine';
import { isPlayable } from './screenState';
import { TIMED_OUT, withinTimeout } from './withinTimeout';

/** A slow mobile claim answers well inside this; a stalled one would cruise until the socket dies. */
export const REWARD_TIMEOUT_MS = 15_000;

/**
 * Where a finger let go of the wheel to throw it, as the frame loop that
 * carries the wheel on meanwhile has it: a spin started on it takes the
 * wheel over from that loop, on the same curve, so the hand-over moves
 * nothing.
 */
export type FlickRelease = {
  /** The loop carrying the wheel on: a spin takes over that loop's wheel, and no other. */
  token: number;
  /** The wheel's angle at the release, in radians. */
  from: number;
  /** The release frame's own time, on the frame loop's clock, in ms. */
  at: number;
  /** How fast the wheel was turning then, in radians a millisecond. */
  speed: number;
};

export type SpinDriver = {
  /**
   * Throws the wheel, after a wind-up or at once as `start` says, or, for a
   * flick, takes it over from `release`. Settles once it turns at the
   * cruise speed, the speed `settle` takes over at, or once the throw is
   * cut short.
   */
  launch(start: SpinLaunch, release?: FlickRelease): Promise<void>;
  /** Coast to rest at `resting` radians. `onSettled` runs only if the coast completes. */
  settle(resting: number, onSettled: () => void): void;
  /** Slows the wheel to rest from however it is turning, on no prize in particular. */
  stop(): void;
};

/**
 * Where a reward shown without a landing sits: on no sector, the pointer on
 * the line between two wedges. See `UnknownSector`.
 */
export const OFF_WHEEL = -1;

/**
 * What a reward whose id is none of the spun sectors does. `'refuse'`: the
 * wheel will not land, and the spin fails as `reward-not-on-wheel`.
 * `'showAmount'`: the claim answered with a prize, so the wheel settles with
 * the pointer on the line between two wedges, on neither of them, and the
 * prize is won as it was sent, landing at `OFF_WHEEL`. An amount that is not
 * a prize, or one that disagrees with the sector its id names, is refused
 * either way: there is then nothing true to show.
 */
export type UnknownSector = 'refuse' | 'showAmount';

/**
 * A confirmed reward, matched to the sector of the spun wheel it lands on,
 * or to none (`OFF_WHEEL`).
 */
export type SpinLanding = {
  reward: WheelReward;
  /** Where the reward sits in `sectors`, or `OFF_WHEEL` for none. */
  index: number;
  /** The sectors the wheel was spun with. */
  sectors: readonly WheelSector[];
};

export type SpinRequest = {
  sectors: readonly WheelSector[];
  /** How the wheel leaves rest: a flick names the release it leaves from. */
  start: SpinLaunch;
  release?: FlickRelease;
  getReward: () => Promise<WheelReward> | WheelReward;
  /** What a reward that names none of `sectors` does: `'refuse'` unless said. */
  unknownSector?: UnknownSector;
  /** The wheel stays held until a promise returned from here settles. */
  onWin: (landing: SpinLanding) => void | Promise<void>;
  onError: (error: unknown) => void;
  onStart?: () => void;
  /**
   * The reward is confirmed and the wheel will come to rest with it, on its
   * sector or on none (`OFF_WHEEL`), well before it does: time to ready what
   * the win shows. Never heard for a reward the wheel refuses, one that
   * answers after the timeout, or once closed.
   */
  onLanding?: (landing: SpinLanding) => void;
  /**
   * The spin was refused before it started, as it is while another is in
   * play, once locked, once the wheel has closed, or on a wheel that cannot
   * pay out: nothing was claimed. Heard at once, inside the call, for a
   * flick whose wheel is still being carried on and must be let go.
   */
  onRefused?: () => void;
};

/**
 * A spin as the screen's Spin button and a flick ask for one:
 * how the wheel leaves rest is the screen's own setting, added as the spin
 * starts, unless the request carries a flick's release.
 */
export type ScreenSpinRequest = Omit<SpinRequest, 'start'>;

export type SpinController = {
  /**
   * Refused while a spin or its win is in play, while the wheel is closed,
   * while the host offers no spin, and for good once a retry would claim
   * twice.
   */
  spin(request: SpinRequest): Promise<void>;
  /**
   * Whether the wheel is on screen. Closing it hands back a reward a claim
   * in flight confirms, and refuses every spin asked for until it opens
   * again.
   */
  setLive(live: boolean): void;
  /**
   * Whether the host offers a spin (`spinAvailable`). Taking it away
   * refuses every spin asked for until it is offered again, and stops
   * nothing: a host takes it away as its claim goes out, and the spin
   * under way plays out and pays out.
   */
  setOffered(offered: boolean): void;
};

export function createSpinController(
  driver: SpinDriver,
  onSpinningChange: (spinning: boolean) => void,
  /** Drawing these rather than newer sectors keeps the wedges from changing under a decided landing. */
  onHold: (sectors: readonly WheelSector[] | undefined) => void,
): SpinController {
  // Plain state rather than React state: two taps in the same tick both read
  // the old state and would both start a spin.
  let held: readonly WheelSector[] | undefined;
  let locked = false;
  let live = true;
  let offered = true;
  // Closing calls this directly: unmounting cancels the settle that would report.
  let handBack: (() => void) | undefined;

  const spin = async ({
    sectors,
    start,
    release: flicked,
    getReward,
    unknownSector = 'refuse',
    onWin,
    onError,
    onStart,
    onLanding,
    onRefused,
  }: SpinRequest) => {
    // A request heard after the wheel closed, as a flick's release or a
    // press handled in the task that closes the sheet can be, would claim
    // the day's spin where nobody sees it, and with no settle ever asked
    // for its throw would cruise on for good. One the host offers no spin
    // for would claim a reward it says is spent, or not there.
    if (!live || !offered || held || locked || !isPlayable(sectors)) {
      onRefused?.();
      return;
    }
    held = sectors;
    onHold(sectors);
    onSpinningChange(true);
    onStart?.();

    const thrown = driver.launch(start, flicked);

    const end = () => {
      handBack = undefined;
      onSpinningChange(false);
    };

    const release = () => {
      held = undefined;
      onHold(undefined);
    };

    const abort = (error: GameError) => {
      const retryable = isRetryable(error);
      if (!retryable) locked = true;
      // Stop and free first: a report that throws must not leave the wheel turning.
      driver.stop();
      end();
      release();
      // Once closed, still report anything that may have followed a committed claim.
      if (live || !retryable) onError(error);
    };

    let claim: Promise<WheelReward> | WheelReward;
    let answer: WheelReward | typeof TIMED_OUT;
    try {
      claim = getReward();
      answer = await withinTimeout(claim, REWARD_TIMEOUT_MS);
    } catch (error) {
      abort(claimFailure(error));
      return;
    }
    if (answer === TIMED_OUT) {
      // The claim can still commit after the wheel gives up on it. Listening
      // before the abort keeps the report if the timeout's own report throws.
      // A late answer without a reward has nothing to reconcile, so, like a
      // late failure, it adds nothing to the timeout already reported.
      Promise.resolve(claim).then(
        (reward) => {
          if (!isReadableReward(reward)) return;
          onError(
            new GameError(
              'reward-late',
              `Reward ${reward.id} arrived after the ${REWARD_TIMEOUT_MS} ms timeout`,
              { reward },
            ),
          );
        },
        () => {},
      );
      abort(
        new GameError(
          'reward-timeout',
          `No reward after ${REWARD_TIMEOUT_MS} ms`,
        ),
      );
      return;
    }
    // The host's types promise a reward, but its service may not keep that
    // promise. With nothing to reconcile the wheel cannot land, and the claim
    // may still have been recorded.
    if (!isReadableReward(answer)) {
      abort(
        new GameError(
          'reward-unconfirmed',
          'The claim answered without a reward',
          { cause: answer },
        ),
      );
      return;
    }
    const reward = answer;

    const reconciled = reconcileReward(sectors, reward);
    let index: number;
    if (!(reconciled instanceof GameError)) index = reconciled.index;
    else if (showsOffWheel(reconciled, unknownSector)) index = OFF_WHEEL;
    else {
      abort(reconciled);
      return;
    }
    const landing: SpinLanding = { reward, index, sectors };

    const count = sectors.length;
    const resting =
      index === OFF_WHEEL
        ? lineRotationFor(Math.floor(Math.random() * count), count)
        : restingRotationFor(index, count, randomJitter(sectorArc(count)));

    // Confirmed, so it reaches the host once: as a win at rest, or handed back on close.
    let reported = false;
    const finish = () => {
      if (reported) return;
      reported = true;
      end();
      if (!live) {
        release();
        onError(
          new GameError(
            'reward-after-close',
            `Reward ${reward.id} was not shown because the wheel closed`,
            { reward },
          ),
        );
        return;
      }
      let shown: void | Promise<void>;
      try {
        shown = onWin(landing);
      } catch (error) {
        release();
        throw error;
      }
      // The landed wedges stay drawn until the win has been shown.
      if (shown === undefined) release();
      else void shown.finally(release);
    };

    if (!live) {
      finish();
      return;
    }
    handBack = finish;
    onLanding?.(landing);

    // The throw always plays out, with its wind-up where it has one: a fast
    // claim waits here, and the settle joins the curve at the cruise speed
    // the throw reached.
    await thrown;
    if (reported) return;

    driver.settle(resting, finish);
  };

  return {
    spin,
    setLive(next) {
      live = next;
      if (!live) handBack?.();
    },
    setOffered(next) {
      offered = next;
    },
  };
}

/**
 * Where the settle brings the wheel to rest from `current`, both in radians:
 * `settleTurns` whole turns on, then forward to `resting`, so it never turns
 * back and always has the turns to slow down over.
 */
export function settleTarget(current: number, resting: number): number {
  'worklet';
  return current + spinDistance(current, resting, SPIN_TIMING.settleTurns);
}

// A worklet takes the functions it calls as it is defined, so each helper is
// declared above the worklets that call it.

/** The cruise speed over the settle's average speed across `distance`. */
function openingSlope(distance: number): number {
  'worklet';
  return ((TAU / SPIN_TIMING.cruiseMs) * SPIN_TIMING.settleMs) / distance;
}

/**
 * The settle's curve over `distance` radians: the share of it covered, 0 to 1,
 * against the share of its time gone. It opens at the cruise speed wherever
 * the prize is, so the wheel neither surges nor sags as the settle takes over,
 * and it keeps the out-cubic's landing, coming to rest with nothing left to
 * slow. A cubic can match the speed only by giving that landing up, the wheel
 * stopping with its brake still on; this is the quartic that keeps both. Over
 * `settleTurns` turns alone it is `Easing.out(cubic)`. It only ever slows while
 * its opening slope, the cruise speed over its average, is from 2 to 4; the
 * settle's five to six turns keep that from 2.5 to 3.
 */
export function settleEasing(distance: number): (progress: number) => number {
  'worklet';
  const slope = openingSlope(distance);
  return (progress) => {
    'worklet';
    const left = 1 - progress;
    return 1 - left * left * left * (4 - slope + (slope - 3) * left);
  };
}

/**
 * The slope of `settleEasing(distance)` at `progress`: the settle's speed as a
 * multiple of its average, which a stop mid-settle slows from.
 */
export function settleEasingSlope(distance: number, progress: number): number {
  'worklet';
  const slope = openingSlope(distance);
  const left = 1 - progress;
  return left * left * (3 * (4 - slope) + 4 * (slope - 3) * left);
}

/**
 * Whether another spin is safe after `error`. Only the host can say nothing
 * was awarded: the server refused the claim, or the device was offline and
 * never sent it.
 */
export function isRetryable(error: unknown): boolean {
  return (
    isGameError(error) &&
    (error.reason === 'reward-unavailable' || error.reason === 'reward-offline')
  );
}

/**
 * The resting angle that puts the pointer on the line after sector `index`,
 * between it and the next: on no wedge, so a reward on none of them never
 * rests under one whose amount it is not. `restingRotationFor` keeps a
 * landing off these lines for the same reason.
 */
export function lineRotationFor(index: number, count: number): number {
  return normalise(POINTER_ANGLE - (index + 1) * sectorArc(count));
}

/**
 * Whether a reward the sectors refused is still shown, as `unknownSector`
 * says: only one whose id is on no sector, and whose amount is a prize, a
 * number that is not negative, so the win screen has a true amount to count.
 */
function showsOffWheel(
  refused: GameError,
  unknownSector: UnknownSector,
): boolean {
  const amount = refused.reward?.winAmount;
  return (
    unknownSector === 'showAmount' &&
    refused.reason === 'reward-not-on-wheel' &&
    typeof amount === 'number' &&
    Number.isFinite(amount) &&
    amount >= 0
  );
}

/** The reasons a host rejects `getReward` with, passed on as they are. */
const HOST_REASONS: readonly string[] = [
  'reward-unavailable',
  'reward-offline',
  'reward-connection-lost',
];

/**
 * Whether a claim's answer is something `reconcileReward` can read. Any
 * object is: one without the sector's id or amount is refused there.
 */
function isReadableReward(answer: unknown): answer is WheelReward {
  return typeof answer === 'object' && answer !== null;
}

function claimFailure(error: unknown): GameError {
  if (isGameError(error) && HOST_REASONS.includes(error.reason)) return error;
  return new GameError(
    'reward-unconfirmed',
    'The claim failed without saying whether it went through',
    { cause: error },
  );
}

export function spinFailureContext(
  error: unknown,
  sectorCount: number,
): Record<string, unknown> {
  if (!isGameError(error)) return { reason: 'unknown', sectors: sectorCount };
  return error.reward
    ? { reason: error.reason, sectors: sectorCount, reward: error.reward }
    : { reason: error.reason, sectors: sectorCount };
}
