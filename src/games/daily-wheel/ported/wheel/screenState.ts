import type { WheelSector } from '../../../../shared/ported/engine';
import { EVENTS } from './events';
/** MiniGames' `HostCalls['report']`: tells the host of an event. */
type HostCalls = {
  report: (event: string, error: unknown, context?: Record<string, unknown>) => void;
};

export type ScreenInputs = {
  latestSectors: readonly WheelSector[];
  /** The sectors the spin controller holds for a spin in play. */
  heldSectors: readonly WheelSector[] | undefined;
  spinning: boolean;
  celebrating: boolean;
  failed: boolean;
  retryable: boolean;
  /** The host offers a spin: `spinAvailable`. True unless said. */
  available?: boolean;
};

export type ScreenState = {
  sectors: readonly WheelSector[];
  spinDisabled: boolean;
};

export function screenState({
  latestSectors,
  heldSectors,
  spinning,
  celebrating,
  failed,
  retryable,
  available = true,
}: ScreenInputs): ScreenState {
  // A new list drawn under a landing that is already decided would bring a
  // wedge showing a different amount to rest under the pointer.
  const sectors = heldSectors ?? latestSectors;
  const locked = failed && !retryable;
  return {
    sectors,
    spinDisabled:
      spinning || celebrating || locked || !available || !isPlayable(sectors),
  };
}

/**
 * Whether a finger may take the wheel: the host turned the drag on, the
 * wheel is shown, and Spin is offered, which a spin, its win, a lock, a host
 * that offers no spin and a wheel that cannot pay out all take away. A
 * refused claim's coast offers Spin again once its popup is put away, so a
 * finger may catch it then.
 */
export function dragAllowed({
  dragToSpin,
  shown,
  spinDisabled,
}: {
  dragToSpin: boolean;
  shown: boolean;
  spinDisabled: boolean;
}): boolean {
  return dragToSpin && shown && !spinDisabled;
}

/**
 * What the open keeps from the player until the static wheel is shown. With
 * the loading cover, the default, the art is hidden under it and only the
 * top row shows; without it the art shows as it loads. Either way a screen
 * reader is kept from the prize list, the title and Spin until it is shown,
 * as Spin and the drag answer nothing before then: the player can use none
 * of it yet. The top row works from the start, so it is covered only while
 * the cover is drawn. A coin loader over the cover (`loading`) stays until it
 * has filled and faded, past the moment the wheel is shown under it: until
 * it has gone the top row is covered, and while it holds the game back
 * (`holding`, until the wheel is ready) the wheel stays out of a screen
 * reader's reach.
 */
export function openCover({
  showLoadingCover,
  shown,
  loading = false,
  holding = loading,
}: {
  showLoadingCover: boolean;
  shown: boolean;
  loading?: boolean;
  /** The loader holds the game back: see `OpenLoader.blocks`. */
  holding?: boolean;
}): {
  /** The opaque cover is drawn over the art, under the top row. */
  drawn: boolean;
  /** The prize list, the title and Spin are out of a screen reader's reach. */
  hidden: boolean;
  /** The top row is drawn over the cover or the loader: see `WheelTopRow.covered`. */
  rowCovered: boolean;
} {
  const drawn = showLoadingCover && !shown;
  return { drawn, hidden: !shown || holding, rowCovered: drawn || loading };
}

/** Ids of the sectors whose prize is negative, not finite or not a number at all. */
export function invalidPrizeIds(sectors: readonly WheelSector[]): number[] {
  return sectors
    .filter(({ winAmount }) => !(Number.isFinite(winAmount) && winAmount >= 0))
    .map(({ id }) => id);
}

export function isPlayable(sectors: readonly WheelSector[]): boolean {
  return sectors.length > 0 && invalidPrizeIds(sectors).length === 0;
}

/** Reports a wheel with no sectors once per screen, however often the check re-runs. */
export function createEmptyWheelCheck(
  report: HostCalls['report'],
): (sectorCount: number) => void {
  let reported = false;
  return (sectorCount) => {
    if (sectorCount > 0 || reported) return;
    reported = true;
    report(EVENTS.noSectors, new Error('The wheel has no sectors to land on'), {
      sectors: 0,
    });
  };
}

/** Reports the sectors at fault once per screen, however often the check re-runs. */
export function createInvalidPrizeCheck(
  report: HostCalls['report'],
): (sectors: readonly WheelSector[]) => void {
  let reported = false;
  return (sectors) => {
    if (reported) return;
    const sectorIds = invalidPrizeIds(sectors);
    if (sectorIds.length === 0) return;
    reported = true;
    report(
      EVENTS.invalidPrize,
      new Error(`No valid prize amount on sector id ${sectorIds.join(', ')}`),
      { sectors: sectors.length, sectorIds },
    );
  };
}
