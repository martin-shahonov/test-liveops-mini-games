import { isPlayableCard, matchCalled, valueWaived } from './rules';
import type { ScratcherCard, ScratcherOutcome } from './rules';

/** The two foil-covered boxes. */
export type Tray = 'winning' | 'yours';

export const TRAYS: readonly Tray[] = ['winning', 'yours'];

/**
 * Where the card is, from the open to the close. The claim is asked for as
 * the first stroke or Quick Scratch starts, and the outcome is final only
 * once both boxes are done and the claim has been reconciled, whichever
 * comes last; a refused claim offers the card again, any other failure
 * locks it.
 */
export type ScreenPhase =
  | 'opening'
  | 'ready'
  | 'scratching'
  | 'sweeping'
  | 'revealed'
  | 'win'
  | 'nowin'
  | 'failed'
  | 'locked'
  | 'closed';

export type ClaimState = 'none' | 'pending' | 'reconciled' | 'failed';

/**
 * COLLECT, which ends the card once its outcome has shown: 'offered' once
 * it may be pressed (as a card with no match ends, or once a win's screen has
 * gone), 'done' once the reward has gone to the host, by COLLECT, the close
 * or a timed hand-over (`NO_WIN.handOverMs`, `WIN_HAND_OVER`).
 */
export type CollectState = 'none' | 'offered' | 'done';

export type ScreenState = {
  phase: ScreenPhase;
  claim: ClaimState;
  /** Scratches started on this screen, counted from 1: see `ScratchStartEvent`. */
  scratch: number;
  /** Per tray, which cells have revealed, in grid order. */
  revealed: Readonly<Record<Tray, readonly boolean[]>>;
  /** Per tray, whether it has reported its box done. */
  done: Readonly<Record<Tray, boolean>>;
  /**
   * The cells whose rings are lit: a yours cell once it and a winning cell
   * showing its symbol are both revealed, and that winning cell with it.
   * Under Quick Scratch's sweep, once both boxes are done: see `cellRevealed`.
   */
  lit: Readonly<Record<Tray, readonly number[]>>;
  /** The reveal burst has been felt for this attempt. */
  burst: boolean;
  /** How many times the foil has come back: the trays' restore token. */
  restore: number;
  /** The reconciled outcome, once the claim has answered. */
  outcome: ScratcherOutcome | null;
  collect: CollectState;
};

/** The phases a finger or Quick Scratch may start a scratch in. */
const OFFERED: readonly ScreenPhase[] = ['ready', 'scratching', 'failed'];

/** The phases the outcome shows in: the win screen, or the no-win end. */
const OUTCOME: readonly ScreenPhase[] = ['win', 'nowin'];

const none = (count: number): boolean[] => Array<boolean>(count).fill(false);

/**
 * The symbols a card names that `known`, the skin's, has no art for: such
 * a card is reported and locked rather than drawn with bare plates.
 */
export function unknownSymbols(
  card: Pick<ScratcherCard, 'winning' | 'cells'>,
  known: readonly string[],
): string[] {
  const named = [...card.winning, ...card.cells.map((cell) => cell.symbol)];
  return [...new Set(named.filter((symbol) => !known.includes(symbol)))];
}

/**
 * The card as it mounts: under the cover, or locked from the start for a
 * card that cannot be played, which is reported and never scratched: one
 * the rules find faults on, or one naming symbols the skin has no art
 * for, which `playable` says.
 */
export function initialScreenState(
  card: ScratcherCard,
  playable: boolean = isPlayableCard(card),
): ScreenState {
  return {
    phase: playable ? 'opening' : 'locked',
    claim: 'none',
    scratch: 0,
    revealed: {
      winning: none(card.winning.length),
      yours: none(card.cells.length),
    },
    done: { winning: false, yours: false },
    lit: { winning: [], yours: [] },
    burst: false,
    restore: 0,
    outcome: null,
    collect: 'none',
  };
}

/** The cover is off: the card is offered. */
export function shown(state: ScreenState): ScreenState {
  return state.phase === 'opening' ? { ...state, phase: 'ready' } : state;
}

/** Whether a scratch starting now needs a claim: none has been asked for this attempt. */
export function needsClaim(state: Pick<ScreenState, 'claim'>): boolean {
  return state.claim === 'none' || state.claim === 'failed';
}

/**
 * Whether the card may be claimed again with nothing scratched, as a
 * popup's Retry or Try again asks: it was offered again after a refused
 * claim, and no claim is out. The claim then leaves the card as it is: the
 * scratch it starts goes on by the finger or by Quick Scratch, neither of
 * which claims again.
 */
export function claimsAgain(
  state: Pick<ScreenState, 'phase' | 'claim'>,
): boolean {
  return state.phase === 'failed' && needsClaim(state);
}

/** A finger took the foil on `tray`: scratching, where the card is offered. */
export function strokeStarted(state: ScreenState): ScreenState {
  if (!OFFERED.includes(state.phase) || state.phase === 'scratching') {
    return state;
  }
  return { ...state, phase: 'scratching' };
}

/** Quick Scratch was pressed: the sweep takes the card, from a finger too. */
export function quickScratched(state: ScreenState): ScreenState {
  if (!OFFERED.includes(state.phase)) return state;
  return { ...state, phase: 'sweeping' };
}

/** The claim has been asked for: this screen's next scratch. */
export function claimStarted(state: ScreenState): ScreenState {
  return { ...state, claim: 'pending', scratch: state.scratch + 1 };
}

/**
 * The cells lit on `card` with `revealed` as it is: a yours cell whose
 * match the rules call, and every winning cell a lit yours cell matches,
 * both in grid order.
 */
export function litCells(
  card: Pick<ScratcherCard, 'winning' | 'cells'>,
  revealed: ScreenState['revealed'],
): ScreenState['lit'] {
  const yours: number[] = [];
  const winning = new Set<number>();
  card.cells.forEach((cell, index) => {
    if (
      !matchCalled(
        revealed.winning,
        revealed.yours[index] ?? false,
        cell.symbol,
        card.winning,
      )
    ) {
      return;
    }
    yours.push(index);
    card.winning.forEach((symbol, at) => {
      if (symbol === cell.symbol && revealed.winning[at]) winning.add(at);
    });
  });
  return { yours, winning: [...winning].sort((a, b) => a - b) };
}

/**
 * Per yours cell of `card`, in grid order, whether its box no longer waits
 * on its value with `revealed` as it is: the rules' `valueWaived`, decided
 * on what the player can see, as `litCells` is. Handed to the yours tray,
 * which counts such a value as read.
 */
export function waivedValues(
  card: Pick<ScratcherCard, 'winning' | 'cells'>,
  revealed: ScreenState['revealed'],
): boolean[] {
  return card.cells.map((cell, index) =>
    valueWaived(
      revealed.winning,
      revealed.yours[index] ?? false,
      cell.symbol,
      card.winning,
    ),
  );
}

const newIn = (now: readonly number[], before: readonly number[]): number[] =>
  now.filter((index) => !before.includes(index));

export type RevealStep = {
  state: ScreenState;
  /** The cells lit by this reveal, by tray. */
  lit: Readonly<Record<Tray, readonly number[]>>;
  /** The reveal burst is felt now: the attempt's first match. */
  burst: boolean;
};

/**
 * Cell `index` of `tray` revealed: what lights, and whether the burst is
 * due. Under Quick Scratch's sweep nothing lights as it clears: the cell is
 * revealed, and its match lights with the rest once both boxes are done
 * (`boxDone`), so nothing glows or pops while foil is still coming off.
 */
export function cellRevealed(
  state: ScreenState,
  card: Pick<ScratcherCard, 'winning' | 'cells'>,
  tray: Tray,
  index: number,
): RevealStep {
  const nothing = { state, lit: { winning: [], yours: [] }, burst: false };
  const cells = state.revealed[tray];
  if (index < 0 || index >= cells.length || cells[index]) return nothing;
  const revealed = {
    ...state.revealed,
    [tray]: cells.map((was, at) => was || at === index),
  };
  if (state.phase === 'sweeping') {
    return { ...nothing, state: { ...state, revealed } };
  }
  const lit = litCells(card, revealed);
  const newly = {
    yours: newIn(lit.yours, state.lit.yours),
    winning: newIn(lit.winning, state.lit.winning),
  };
  const burst = !state.burst && newly.yours.length > 0;
  return {
    state: { ...state, revealed, lit, burst: state.burst || burst },
    lit: newly,
    burst,
  };
}

/** Both boxes have reported done. */
export function bothDone(state: Pick<ScreenState, 'done'>): boolean {
  return state.done.winning && state.done.yours;
}

/**
 * The outcome is final: both boxes done and the claim reconciled. A closed
 * card stays closed: a claim answering after the close is handed over, not
 * shown.
 */
function finalIfDue(state: ScreenState): ScreenState {
  return bothDone(state) &&
    state.claim === 'reconciled' &&
    state.phase !== 'closed'
    ? { ...state, phase: 'revealed' }
    : state;
}

export type DoneStep = {
  state: ScreenState;
  /** The cells lit by this box, by tray: Quick Scratch's matches, once both boxes are done. */
  lit: Readonly<Record<Tray, readonly number[]>>;
  /**
   * The reveal burst is felt now: the reveal ended with nothing matched,
   * or Quick Scratch's first match lit with it.
   */
  burst: boolean;
  /** The outcome became final with this box. */
  final: boolean;
};

/**
 * `tray`'s box is done: every cell is revealed, and the burst is due if
 * nothing ever matched. Under Quick Scratch's sweep, both boxes done, every
 * match `card` shows lights now, all together, as `cellRevealed` held
 * them: the burst is due with the first.
 */
export function boxDone(
  state: ScreenState,
  tray: Tray,
  card: Pick<ScratcherCard, 'winning' | 'cells'>,
): DoneStep {
  const unlit = { winning: [], yours: [] };
  if (state.done[tray]) {
    return { state, lit: unlit, burst: false, final: false };
  }
  const done = { ...state.done, [tray]: true };
  const all = done.winning && done.yours;
  // Every cell is revealed once its box is: the trays tell the rest before
  // the box, but a reveal lost between threads must not leave a cell
  // covered for the screen reader.
  const revealed = {
    ...state.revealed,
    [tray]: state.revealed[tray].map(() => true),
  };
  const lit =
    all && state.phase === 'sweeping' ? litCells(card, revealed) : state.lit;
  const newly = {
    yours: newIn(lit.yours, state.lit.yours),
    winning: newIn(lit.winning, state.lit.winning),
  };
  const burst = all && !state.burst;
  const next = finalIfDue({
    ...state,
    done,
    revealed,
    lit,
    burst: state.burst || burst,
  });
  return { state: next, lit: newly, burst, final: next.phase === 'revealed' };
}

/** The claim answered and reconciled with the card. */
export function claimReconciled(
  state: ScreenState,
  outcome: ScratcherOutcome,
): { state: ScreenState; final: boolean } {
  const next = finalIfDue({ ...state, claim: 'reconciled', outcome });
  return { state: next, final: next.phase === 'revealed' };
}

/**
 * The host refused the claim before anything was awarded: the foil comes
 * back over the card as it was given, and the next scratch claims again.
 */
export function claimRefused(state: ScreenState): ScreenState {
  return {
    ...state,
    phase: 'failed',
    claim: 'failed',
    revealed: {
      winning: none(state.revealed.winning.length),
      yours: none(state.revealed.yours.length),
    },
    done: { winning: false, yours: false },
    lit: { winning: [], yours: [] },
    burst: false,
    restore: state.restore + 1,
    outcome: null,
  };
}

/** The claim failed in a way that may have paid out: the card locks as it is. */
export function claimLocked(state: ScreenState): ScreenState {
  return { ...state, phase: 'locked', claim: 'failed' };
}

/** Whether `outcome` pays anything, in any type. */
export function hasWin(outcome: ScratcherOutcome): boolean {
  return Object.values(outcome.totals).some((total) => (total ?? 0) > 0);
}

/**
 * Whether the card draws a win's result, as her win state does: every cell
 * with no part in the match darkened. From the moment the win is known,
 * both boxes done and the claim reconciled with an outcome that pays, which
 * is before its win screen shows, to the close. A card with no match keeps
 * its look as it ends.
 */
export function darkensUnmatched(
  state: Pick<ScreenState, 'claim' | 'done' | 'outcome'>,
): boolean {
  return (
    state.claim === 'reconciled' &&
    bothDone(state) &&
    state.outcome !== null &&
    hasWin(state.outcome)
  );
}

/**
 * The cells the card draws lit: those `state` has lit, and once a win's
 * result is drawn (`darkensUnmatched`), every cell of its match, all of
 * them revealed by then. The trays tell each cell before its box is done,
 * but one lost between threads must not leave its match darkened with the
 * rest.
 */
export function shownLit(
  state: ScreenState,
  card: Pick<ScratcherCard, 'winning' | 'cells'>,
): ScreenState['lit'] {
  return darkensUnmatched(state) ? litCells(card, state.revealed) : state.lit;
}

/**
 * The final outcome is shown: the win screen, or the no-win end with
 * COLLECT offered. A win's COLLECT waits for its screen to go.
 */
export function outcomeShown(state: ScreenState): ScreenState {
  if (state.phase !== 'revealed' || !state.outcome) return state;
  return hasWin(state.outcome)
    ? { ...state, phase: 'win' }
    : { ...state, phase: 'nowin', collect: 'offered' };
}

/**
 * A win's screen has gone: COLLECT is offered. Only over a shown outcome
 * not yet handed over: before the outcome shows, or once the reward has
 * gone, nothing changes.
 */
export function collectOffered(state: ScreenState): ScreenState {
  return OUTCOME.includes(state.phase) && state.collect === 'none'
    ? { ...state, collect: 'offered' }
    : state;
}

/**
 * The reward has gone to the host over a shown outcome: COLLECT was
 * pressed, or a timed hand-over came first. COLLECT is off from here.
 */
export function collected(state: ScreenState): ScreenState {
  return OUTCOME.includes(state.phase) && state.collect !== 'done'
    ? { ...state, collect: 'done' }
    : state;
}

/**
 * The card is closing. A shown outcome's reward is handed over with the
 * close, so its COLLECT is done, and still reads COLLECT as the card goes.
 */
export function closed(state: ScreenState): ScreenState {
  if (state.phase === 'closed') return state;
  return {
    ...state,
    phase: 'closed',
    collect: OUTCOME.includes(state.phase) ? 'done' : state.collect,
  };
}

/**
 * Whether the button reads COLLECT rather than QUICK SCRATCH: from the
 * outcome showing, the win's screen still over it or the no-win end, to
 * the close. The label changes once, when the outcome is final and shown.
 */
export function readsCollect(
  state: Pick<ScreenState, 'phase' | 'collect'>,
): boolean {
  return OUTCOME.includes(state.phase) || state.collect !== 'none';
}

/**
 * Whether COLLECT is off: not offered yet (a win's screen still plays),
 * pressed already, the card closed, or How To Play over it.
 */
export function collectDisabled(
  state: Pick<ScreenState, 'phase' | 'collect'>,
  { shown: isShown, overlay }: { shown: boolean; overlay: boolean },
): boolean {
  return !(
    isShown &&
    !overlay &&
    OUTCOME.includes(state.phase) &&
    state.collect === 'offered'
  );
}

/** The phases a scratch is under way in, from its claim to its outcome showing. */
const UNDER_WAY: readonly ScreenPhase[] = [
  'scratching',
  'sweeping',
  'revealed',
];

/**
 * The scratch the coin shower bakes ahead for. A bake plays only for the
 * scratch it was made for, and one for another is dropped and started
 * again from nothing, so the number holds from the claim until the shower
 * plays: at rest the next scratch's, which the claim makes this one's own,
 * and this one's through the scratch, the reveal and the landing, until
 * the win's own art comes in and the shower plays. After a refused claim
 * it is the next attempt's again, until a claim asked for again with
 * nothing scratched (`claimsAgain`) makes it this one's; a render between
 * a stroke and its claim starting, before the claim has counted the
 * scratch, already reads it.
 */
export function showerSeedAhead(
  state: Pick<ScreenState, 'phase' | 'claim' | 'scratch'>,
  { showering, textShown }: { showering: boolean; textShown: boolean },
): number {
  const underWay =
    (UNDER_WAY.includes(state.phase) || state.phase === 'failed') &&
    !needsClaim(state);
  return underWay || (showering && !textShown)
    ? state.scratch
    : state.scratch + 1;
}

/**
 * Whether a finger may scratch: the card is shown and offered, with nothing
 * over it and foil left on it. A sweep, the reveal, a win, a lock and the
 * close all take the card from the finger, and so do both boxes done while
 * the claim is still out, when there is nothing left to scratch or sweep; a
 * refused claim offers it again.
 */
export function traysEnabled(
  state: ScreenState,
  { shown: isShown, overlay }: { shown: boolean; overlay: boolean },
): boolean {
  return (
    isShown && !overlay && OFFERED.includes(state.phase) && !bothDone(state)
  );
}

/** Whether Quick Scratch is off: whenever a finger may not scratch. */
export function quickDisabled(
  state: ScreenState,
  context: { shown: boolean; overlay: boolean },
): boolean {
  return !traysEnabled(state, context);
}

/** How many of `tray`'s cells are still under their foil. */
export function coveredCount(state: ScreenState, tray: Tray): number {
  return state.revealed[tray].filter((revealed) => !revealed).length;
}
