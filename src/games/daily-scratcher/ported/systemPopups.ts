import { isGameError } from '../../../shared/ported/engine';
import type { DailyScratcherLabels } from './DailyScratcherScreen.types';
import type { ScratcherSkin } from './skins';

/**
 * The popups the designer drew for a claim that failed, the wheel's (her
 * popups v3): No connection, Connection lost, Something went wrong and
 * Prize not confirmed.
 */
export type SystemPopupKind =
  | 'noConnection'
  | 'connectionLost'
  | 'somethingWentWrong'
  | 'prizeNotConfirmed';

/** What a popup's button does: claim the card again, close it, or put the popup away. */
export type SystemPopupAction = 'claim' | 'close' | 'dismiss';

/**
 * The popup a failed claim shows, or none, by the wheel's rule:
 * - No connection: the host says the device was offline, so the claim was
 *   never sent (`reward-offline`). The foil came back; Retry claims the
 *   card again and leaves it as it is, for the player to scratch or to
 *   press Quick Scratch, neither of which claims again.
 * - Something went wrong: the host says nothing was awarded
 *   (`reward-unavailable`). The same, from Try again.
 * - Connection lost: the claim was sent, but its answer was lost
 *   (`reward-connection-lost`) or never came (`reward-timeout`), so the
 *   prize may have been awarded. The card is locked; Reconnect closes it,
 *   and the host shows the prize once it is back online.
 * - Prize not confirmed: any other failure, which may follow a claim the
 *   server committed: an answer the card could not read, or an error of no
 *   reason. Okay puts it away over the locked card.
 * A prize after a timeout, or after the card closed, has none: it does not
 * fail the card, and must not replace a popup that is up.
 */
export function scratcherPopupFor(error: unknown): SystemPopupKind | null {
  if (!isGameError(error)) return 'prizeNotConfirmed';
  switch (error.reason) {
    case 'reward-offline':
      return 'noConnection';
    case 'reward-unavailable':
      return 'somethingWentWrong';
    case 'reward-connection-lost':
    case 'reward-timeout':
      return 'connectionLost';
    case 'reward-late':
    case 'reward-after-close':
      return null;
    default:
      return 'prizeNotConfirmed';
  }
}

export const POPUP_ACTION: Readonly<
  Record<SystemPopupKind, SystemPopupAction>
> = {
  noConnection: 'claim',
  somethingWentWrong: 'claim',
  connectionLost: 'close',
  prizeNotConfirmed: 'dismiss',
};

/** The labels that are a single string, which a popup's words are. */
type TextKey = {
  [K in keyof DailyScratcherLabels]: DailyScratcherLabels[K] extends string
    ? K
    : never;
}[keyof DailyScratcherLabels];

/** Each popup's words, by their labels' keys, and its badge. */
export const POPUP_PARTS: Readonly<
  Record<
    SystemPopupKind,
    {
      title: TextKey;
      detail: TextKey;
      button: TextKey;
      icon: keyof ScratcherSkin['popups'];
    }
  >
> = {
  noConnection: {
    title: 'noConnection',
    detail: 'noConnectionDetail',
    button: 'retry',
    icon: 'wifi',
  },
  connectionLost: {
    title: 'connectionLost',
    detail: 'connectionLostDetail',
    button: 'reconnect',
    icon: 'wifi',
  },
  somethingWentWrong: {
    title: 'somethingWentWrong',
    detail: 'somethingWentWrongDetail',
    button: 'tryAgain',
    icon: 'alert',
  },
  prizeNotConfirmed: {
    title: 'prizeNotConfirmed',
    detail: 'prizeNotConfirmedDetail',
    button: 'okay',
    icon: 'hourglass',
  },
};

/** What the screen keeps of a failed claim's popup. */
export type PopupState = {
  /** The popup to show, kept while it goes. */
  kind: SystemPopupKind;
  /** Wanted up. It waits while How To Play is. */
  wanted: boolean;
  /** Up and still, so the button's glow stands still under it. */
  shown: boolean;
  /** How it was put away, until it has gone: by its button, or otherwise. */
  away: 'pressed' | 'dismissed' | null;
};

export const NO_POPUP: PopupState = {
  kind: 'somethingWentWrong',
  wanted: false,
  shown: false,
  away: null,
};

export type PopupEvent =
  /** A claim failed: the popup it shows, or none. */
  | { type: 'failed'; kind: SystemPopupKind | null }
  /** Up and still. */
  | { type: 'shown' }
  /** Put away by its cross, a tap beside it, Back, Escape, a pull or Okay. */
  | { type: 'dismissed' }
  /** Its button: Retry, Try again or Reconnect. */
  | { type: 'pressed' }
  /** Gone, its way out played. */
  | { type: 'gone' };

/**
 * A failed claim's popup, step by step: a failure with a popup wants it
 * up, and one with none (a prize after a timeout) changes nothing; put
 * away, it remembers how until it has gone, when `afterGone` says what
 * follows; asked up again before it has gone, it forgets.
 */
export function popupStep(state: PopupState, event: PopupEvent): PopupState {
  switch (event.type) {
    case 'failed':
      return event.kind === null
        ? state
        : { kind: event.kind, wanted: true, shown: false, away: null };
    case 'shown':
      return state.wanted ? { ...state, shown: true } : state;
    case 'dismissed':
      return { ...state, wanted: false, shown: false, away: 'dismissed' };
    case 'pressed':
      return { ...state, wanted: false, shown: false, away: 'pressed' };
    case 'gone':
      return { ...state, away: null };
  }
}

/**
 * What follows a popup's way out: for Retry and Try again, the claim asked
 * for again, where the card is offered again with no claim out, and
 * nothing else: the foil stays as the player left it. Nothing otherwise
 * (Reconnect has closed the card as it was pressed, and Okay only puts the
 * popup away), nor once the popup is wanted again. Sent once the popup has
 * gone, so a claim that fails again at once brings it up anew rather than
 * stopping it on its way out.
 */
export function afterGone(
  state: PopupState,
  { claimOffered }: { claimOffered: boolean },
): 'claim' | 'nothing' {
  if (state.wanted || state.away !== 'pressed') return 'nothing';
  return POPUP_ACTION[state.kind] === 'claim' && claimOffered
    ? 'claim'
    : 'nothing';
}
