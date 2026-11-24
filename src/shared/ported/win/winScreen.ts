import type { WinTier } from '../engine';
import type { BoardBox, PlacedBox } from '../runtime/layout/fit';
import { formatFullAmount, groupThousands } from './formatAmount';
import type { WinArtTier } from './types';

/**
 * The win screen's pace, in milliseconds. It runs in three parts: at the
 * landing what the game lights starts; `textAtMs` later the dim comes up
 * with the win's own art, the lockup with its particles, the amount with its
 * coin, and the coin shower; and as the tier's lockup goes, `outAt` into its
 * animation (see `WinScreenArt`), everything plays out.
 */
export const WIN_SCREEN = {
  /** The dim comes up over the whole screen, with the win's own art. */
  dimMs: 250,
  /**
   * The dim, the lockup, its particles, the amount with its coin, and the
   * coin shower come in.
   */
  textAtMs: 750,
  /**
   * The amount and its coin rise `amountRise` board points into place as
   * they fade in over `amountInMs`, and sink back as they fade out, as the
   * lockup goes, from `outAt` to `goneAt`.
   */
  amountInMs: 1500,
  amountRise: 50,
  /** About 30 steps a second: smooth to the eye, one small render each. */
  countStepMs: 33,
  /**
   * The count lands at least this long before the win starts to go, so the
   * total sits on screen, still, before it sinks and fades out with the
   * lockup: 0.75 s of the export's own hold and the `LOCKUP_HOLD_FRAMES`
   * second the lockup holds beyond it, which leaves the count the time it
   * had before that hold.
   */
  totalHoldMs: 1750,
  /** What the landing lit, the dim and the glows, fades out as the lockup goes. */
  outMs: 1000,
  /**
   * The reward goes to the host, whose own screen takes over, this long after
   * the lockup starts to go: by then the out has played, and the shower,
   * which starts to thin out the lockup's held second before that, has its
   * last coins off a phone's screen. The hand-over comes when it did before
   * the lockup held longer.
   */
  handOverAfterOutMs: 1500,
  /** A win put away before its end, by a close or a new play. */
  fadeOutMs: 250,
} as const;

/**
 * From when the shower starts to thin out, as its lockup's export starts to
 * go, a second before the held lockup does, fewer and fewer coins launch over
 * this many seconds, until none do, and the last ones fall: it ends rather
 * than stops.
 */
export const SHOWER_TAPER_SECONDS = 1;

/** When the win starts to go, in milliseconds from the landing, `outAt` into its art. */
export function winOutMs(outAt: number): number {
  return WIN_SCREEN.textAtMs + outAt;
}

/** When the reward goes to the host, in milliseconds from the landing. */
export function handOverMs(outAt: number): number {
  return winOutMs(outAt) + WIN_SCREEN.handOverAfterOutMs;
}

/**
 * How long the coin shower emits when it starts to thin out `outAt` into the
 * win's art: in full from when that art comes in, `textAtMs` after the
 * landing, until then, then thinning out.
 */
export function showerSeconds(outAt: number): number {
  return outAt / 1000 + SHOWER_TAPER_SECONDS;
}

/**
 * When the coin beside the amount flips, in milliseconds into a count
 * `countMs` long: so a flip `flipMs` long ends as the count lands.
 */
export function coinFlipAt(flipMs: number, countMs: number): number {
  return Math.max(0, countMs - flipMs);
}

/** The engine's top tier is drawn as MAX WIN; the art has no JACKPOT lockup. */
export function winArtTier(tier: WinTier): WinArtTier {
  return tier === 'jackpot' ? 'max' : tier;
}

/**
 * How `tier`'s words show for `win`: `played` from its lockup's clock, where
 * the win was told at its landing that its lockup could play, while it is
 * drawn and the tier's lights, `lit`, are still mounted; `still`, at rest,
 * fading with the win's own art, where it was not; `hidden` for any other
 * tier, or with no win.
 */
export function lockupWords(
  tier: WinArtTier,
  win: { tier: WinTier; animated: { lockup: boolean } } | null,
  drawn: boolean,
  lit: WinArtTier | null,
): 'played' | 'still' | 'hidden' {
  if (!win || winArtTier(win.tier) !== tier) return 'hidden';
  if (!win.animated.lockup) return 'still';
  return drawn && lit === tier ? 'played' : 'hidden';
}

/**
 * `box` with its left and top edges on the nearest device pixel, at
 * `pixelRatio` of them a point, and its size as it was: a still drawn there at
 * rest is sampled pixel for pixel rather than half a pixel off.
 */
export function onDevicePixels(box: PlacedBox, pixelRatio: number): PlacedBox {
  const snap = (at: number) => Math.round(at * pixelRatio) / pixelRatio;
  return { ...box, left: snap(box.left), top: snap(box.top) };
}

/**
 * How fast the count moves as it lands, as a share of its average speed. It
 * starts at `2 - COUNT_LANDING_SPEED` and slows evenly, so it eases onto the
 * total without stalling short of it. An ease that slows to a stop spends
 * its last stretch on its last few values, and rounded down it leaves the
 * total less one on screen long enough to read.
 */
const COUNT_LANDING_SPEED = 0.5;

/**
 * At its slowest, as it lands, the count moves on by a unit of the amount's
 * last digit at least this often, and the counter, which steps every
 * `countStepMs`, shows it within a step: slow enough that a small amount is
 * seen counting up, value by value, and quick enough that no value short of
 * the total reads as stuck.
 */
const COUNT_SLOWEST_UNIT_MS = 150;

/** The amount spelled in full, and as a count of whole units of its last decimal. */
function countUnits(amount: number): {
  total: string;
  decimals: number;
  units: number;
} {
  const total = formatFullAmount(amount);
  if (total === '') return { total, decimals: 0, units: 0 };
  const point = total.indexOf('.');
  const decimals = point < 0 ? 0 : total.length - point - 1;
  // Whole units of the last decimal: fractions of a float would show noise
  // such as 0.30000000000000004.
  return { total, decimals, units: Math.round(amount * 10 ** decimals) };
}

/**
 * When the count of `amount` lands on the total, in milliseconds from when
 * the win's own art comes in, for a win that goes `outAt` after that: a
 * `totalHoldMs` before it goes. An amount with too few units to fill that
 * time without slowing past `COUNT_SLOWEST_UNIT_MS` a unit lands sooner, at
 * that pace, so even a few units are seen counting up.
 */
export function countLandsAt(amount: number, outAt: number): number {
  const slot = Math.max(0, outAt - WIN_SCREEN.totalHoldMs);
  // A unit takes the count's length over its units on average, and
  // 1 / COUNT_LANDING_SPEED times that as it lands: a count no longer than
  // this lands at a unit every COUNT_SLOWEST_UNIT_MS or quicker.
  const paced =
    countUnits(amount).units * COUNT_LANDING_SPEED * COUNT_SLOWEST_UNIT_MS;
  return Math.min(slot, paced);
}

/**
 * How far through a count `countMs` long the amount is, `ms` in: quick at
 * first, easing onto the total at `COUNT_LANDING_SPEED`.
 */
export function countUpProgress(ms: number, countMs: number): number {
  const t = Math.min(1, Math.max(0, ms / countMs));
  const s = COUNT_LANDING_SPEED;
  return (2 - s) * t - (1 - s) * t * t;
}

/**
 * The amount as the counter shows it `ms` into a count `countMs` long.
 * Rounded down, so the total shows only once the count is over, and with the
 * total's decimals throughout, so the digits do not jump about as it runs.
 */
export function countUpText(
  amount: number,
  ms: number,
  countMs: number,
): string {
  const { total, decimals, units: all } = countUnits(amount);
  if (ms >= countMs || total === '') return total;

  const unit = 10 ** decimals;
  const units = Math.floor(countUpProgress(ms, countMs) * all);
  const whole = groupThousands(Math.floor(units / unit));
  return decimals
    ? `${whole}.${String(units % unit).padStart(decimals, '0')}`
    : whole;
}

/**
 * How long after a step `ms` into a count `countMs` long the counter steps
 * again, or null once it has landed. The last step falls on the count's end
 * rather than up to a step past it, so the total is up for all of its hold.
 */
export function nextCountStep(ms: number, countMs: number): number | null {
  return ms < countMs ? Math.min(WIN_SCREEN.countStepMs, countMs - ms) : null;
}

/** Where a string's glyph images start and end, from its pen's start, in board points. */
export type TextInk = { left: number; right: number };

export type CounterRowArt = {
  /** The coin's canvas, square. */
  size: number;
  /** From the coin's canvas to the first glyph image. */
  gap: number;
  /** The coin's centre below the counter's line centre; above it when negative. */
  drop: number;
};

export type CounterRow = {
  coin: BoardBox;
  /** Where the first glyph image starts. */
  inkLeft: number;
  /** The top of the counter's line box. */
  top: number;
};

/**
 * The coin and the amount as one row, `[coin][gap][text]`, centred on the
 * counter's line centre, the text measured from its first glyph image to its
 * last. Laid out for the total, so the coin stays put while the amount counts
 * up after it. Board points; `lineHeight` is the counter's line box.
 */
export function counterRow(
  centre: readonly [number, number],
  coin: CounterRowArt,
  lineHeight: number,
  totalInk: TextInk,
): CounterRow {
  const width = coin.size + coin.gap + (totalInk.right - totalInk.left);
  const left = centre[0] - width / 2;
  return {
    coin: {
      centre: [left + coin.size / 2, centre[1] + coin.drop],
      size: [coin.size, coin.size],
    },
    inkLeft: left + coin.size + coin.gap,
    top: centre[1] - lineHeight / 2,
  };
}

export type WinHold = {
  /** Settles once the hold is over. Never rejects. */
  done: Promise<void>;
  /** Ends it now: a close must not keep the reward from the host. */
  end: () => void;
};

/** Holds for `ms`, or until `end` is called, whichever comes first. */
export function holdFor(ms: number): WinHold {
  let end = () => {};
  const done = new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    end = () => {
      clearTimeout(timer);
      resolve();
    };
  });
  return { done, end };
}

/**
 * Whether anything of win `id` is left to draw: it is up, or it has not yet
 * finished fading out. `fadedId` names the last win whose fade-out finished,
 * and -1 is no win at all. A win's id is new each time it goes up, so the
 * landing's own render already draws it, with no second render to say so.
 */
export function winDrawn(up: boolean, id: number, fadedId: number): boolean {
  return up || (id !== -1 && fadedId !== id);
}
