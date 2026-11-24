import { GameError, isGameError } from '../../../shared/ported/engine';
import type { WinTier } from '../../../shared/ported/engine';
import {
  isPlayableCard,
  reconcileScratcherReward,
  scratcherWinTier,
} from './rules';
import type { ScratcherCard, ScratcherOutcome, ScratcherReward } from './rules';
import { hasWin } from './screenState';
import { TIMED_OUT, withinTimeout } from './withinTimeout';

/** A slow mobile claim answers well inside this; a stalled one would keep the card waiting until the socket dies. */
export const REWARD_TIMEOUT_MS = 15_000;

/** A confirmed reward, reconciled with the card it was claimed for. */
export type ClaimLanding = {
  reward: ScratcherReward;
  /** What the card shows, which the reward confirms. */
  outcome: ScratcherOutcome;
  /** The win's tier, for a total above zero; none for a card with no match. */
  tier?: WinTier;
};

export type ClaimRequest = {
  card: ScratcherCard;
  getReward: () => Promise<ScratcherReward> | ScratcherReward;
  /**
   * The reward is confirmed and reconciled, ahead of the show: time to
   * ready what the win shows. Never heard for a reward the card refuses,
   * one that answers after the timeout, or once closed.
   */
  onReconciled?: (landing: ClaimLanding) => void;
  /**
   * The outcome is final: both boxes are done and the reward reconciled.
   * Nothing is shown as won before this.
   */
  onShow: (landing: ClaimLanding) => void;
  onError: (error: unknown) => void;
  onStart?: () => void;
  /**
   * The claim was refused before it started, as it is while another is in
   * play, once locked, once the reward was shown, once the card has
   * closed, or on a card that cannot be played: nothing was claimed.
   */
  onRefused?: () => void;
};

export type ScratchController = {
  /**
   * Refused while a claim is in play, once a reward has been shown or
   * handed back, while the card is closed, and for good once a retry
   * would claim twice.
   */
  claim(request: ClaimRequest): Promise<void>;
  /**
   * Both boxes are done: a reconciled reward is shown now, or as soon as
   * the claim answers. Forgotten by the next claim, whose foil comes back.
   */
  revealed(): void;
  /**
   * Whether the card is on screen. Closing it hands back a reward a claim
   * in flight confirms, and refuses every claim asked for until it opens
   * again.
   */
  setLive(live: boolean): void;
};

export function createScratchController(
  onClaimingChange: (claiming: boolean) => void,
): ScratchController {
  // Plain state rather than React state: two strokes in the same tick both
  // read the old state and would both claim.
  let claiming = false;
  let locked = false;
  /** A reward has been shown or handed back: the card is spent. */
  let spent = false;
  let live = true;
  /** Both boxes of this attempt are done, so a reconciled reward shows at once. */
  let revealedAll = false;
  // Closing calls this directly: the show waits for the boxes otherwise.
  let handBack: (() => void) | undefined;

  const claim = async ({
    card,
    getReward,
    onReconciled,
    onShow,
    onError,
    onStart,
    onRefused,
  }: ClaimRequest) => {
    // A request heard after the card closed, as a stroke handled in the
    // task that closes the sheet can be, would claim the day's card where
    // nobody sees it.
    if (!live || claiming || locked || spent || !isPlayableCard(card)) {
      onRefused?.();
      return;
    }
    claiming = true;
    revealedAll = false;
    onClaimingChange(true);
    onStart?.();

    const end = () => {
      handBack = undefined;
      claiming = false;
      onClaimingChange(false);
    };

    const abort = (error: GameError<ScratcherReward>) => {
      const retryable = isRetryable(error);
      if (!retryable) locked = true;
      // Free first: a report that throws must not leave the claim pending.
      end();
      // Once closed, still report anything that may have followed a committed claim.
      if (live || !retryable) onError(error);
    };

    let answer: ScratcherReward | typeof TIMED_OUT;
    let claimed: Promise<ScratcherReward> | ScratcherReward;
    try {
      claimed = getReward();
      answer = await withinTimeout(claimed, REWARD_TIMEOUT_MS);
    } catch (error) {
      abort(claimFailure(error));
      return;
    }
    if (answer === TIMED_OUT) {
      // The claim can still commit after the card gives up on it. Listening
      // before the abort keeps the report if the timeout's own report throws.
      // A late answer without a reward has nothing to reconcile, so, like a
      // late failure, it adds nothing to the timeout already reported.
      Promise.resolve(claimed).then(
        (reward) => {
          if (!isReadableReward(reward)) return;
          onError(
            new GameError<ScratcherReward>(
              'reward-late',
              `Reward for card ${reward.cardId} arrived after the ${REWARD_TIMEOUT_MS} ms timeout`,
              { reward },
            ),
          );
        },
        () => {},
      );
      abort(
        new GameError<ScratcherReward>(
          'reward-timeout',
          `No reward after ${REWARD_TIMEOUT_MS} ms`,
        ),
      );
      return;
    }
    // The host's types promise a reward, but its service may not keep that
    // promise. With nothing to reconcile the card cannot show an outcome,
    // and the claim may still have been recorded.
    if (!isReadableReward(answer)) {
      abort(
        new GameError<ScratcherReward>(
          'reward-unconfirmed',
          'The claim answered without a reward',
          { cause: answer },
        ),
      );
      return;
    }
    const reward = answer;

    const reconciled = reconcileScratcherReward(card, reward);
    if (reconciled instanceof GameError) {
      abort(reconciled);
      return;
    }
    const { outcome } = reconciled;
    const landing: ClaimLanding = hasWin(outcome)
      ? { reward, outcome, tier: scratcherWinTier(outcome, card) }
      : { reward, outcome };

    // Confirmed, so it reaches the host once: shown as the outcome, or
    // handed back on close.
    let reported = false;
    const finish = () => {
      if (reported) return;
      reported = true;
      spent = true;
      end();
      if (!live) {
        onError(
          new GameError<ScratcherReward>(
            'reward-after-close',
            `Reward for card ${reward.cardId} was not shown because the card closed`,
            { reward },
          ),
        );
        return;
      }
      onShow(landing);
    };

    if (!live) {
      finish();
      return;
    }
    handBack = finish;
    onReconciled?.(landing);
    if (revealedAll) finish();
  };

  return {
    claim,
    revealed() {
      revealedAll = true;
      handBack?.();
    },
    setLive(next) {
      live = next;
      if (!live) handBack?.();
    },
  };
}

/**
 * Whether another claim is safe after `error`. Only the host can say
 * nothing was awarded: the server refused the claim, or the device was
 * offline and never sent it.
 */
export function isRetryable(error: unknown): boolean {
  return (
    isGameError(error) &&
    (error.reason === 'reward-unavailable' || error.reason === 'reward-offline')
  );
}

/** The reasons a host rejects `getReward` with, passed on as they are. */
const HOST_REASONS: readonly string[] = [
  'reward-unavailable',
  'reward-offline',
  'reward-connection-lost',
];

/**
 * Whether a claim's answer is something `reconcileScratcherReward` can
 * read. Any object is: one for another card, or naming other cells or
 * totals, is refused there.
 */
function isReadableReward(answer: unknown): answer is ScratcherReward {
  return typeof answer === 'object' && answer !== null;
}

function claimFailure(error: unknown): GameError<ScratcherReward> {
  if (
    isGameError<ScratcherReward>(error) &&
    HOST_REASONS.includes(error.reason)
  ) {
    return error;
  }
  return new GameError<ScratcherReward>(
    'reward-unconfirmed',
    'The claim failed without saying whether it went through',
    { cause: error },
  );
}

/** What `EVENTS.scratchFailed` reports with: the reason, the card and its size, and the reward where there is one. */
export function scratchFailureContext(
  error: unknown,
  card: Pick<ScratcherCard, 'id' | 'cells'>,
): Record<string, unknown> {
  const context = { card: card.id, cells: card.cells.length };
  if (!isGameError<ScratcherReward>(error)) {
    return { reason: 'unknown', ...context };
  }
  return error.reward
    ? { reason: error.reason, ...context, reward: error.reward }
    : { reason: error.reason, ...context };
}
