/** A double carries fifteen digits exactly at any magnitude; past that is noise. */
const SIGNIFICANT_DIGITS = 15;

const MAX_FRACTION_DIGITS = 6;

/** Below this an amount is written in full; from it on, to three significant digits. */
const ABBREVIATE_FROM = 1_000;

/**
 * The scale each magnitude is written at, so three significant digits show:
 * hundredths of a thousand from 1K, tenths from 10K, whole thousands from
 * 100K, hundredths of a million from 1M, and so on. There is no `B`: on the
 * prize sheet `B` is the Betty coin mark, so a thousand million is `1000M`.
 */
const BANDS = [
  { from: 1_000, step: 10, decimals: 2, suffix: 'K' },
  { from: 10_000, step: 100, decimals: 1, suffix: 'K' },
  { from: 100_000, step: 1_000, decimals: 0, suffix: 'K' },
  { from: 1_000_000, step: 10_000, decimals: 2, suffix: 'M' },
  { from: 10_000_000, step: 100_000, decimals: 1, suffix: 'M' },
  { from: 100_000_000, step: 1_000_000, decimals: 0, suffix: 'M' },
] as const;

/**
 * A prize amount as a cell prints it under its symbol: in full below a
 * thousand (`500`), from there always shortened, rounded to three
 * significant digits with a K or M suffix and no trailing zeros (`1K`,
 * `1.23K`, `12.3K`, `123K`, `1.23M`; 9,999 reads `10K`). A cell has no room
 * for `1,234,567`, so from a thousand up the label is the nearest reading of
 * the prize rather than the prize itself; the win screen counts the exact
 * amount, and a screen reader hears it. Empty, with an error reported, for
 * one that is not a non-negative number.
 */
export function formatPrizeAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) {
    reportError(
      `[minigames] prize amount must be a non-negative number: ${String(amount)}`,
    );
    return '';
  }

  const meant = withoutFloatNoise(amount);
  if (meant < ABBREVIATE_FROM) {
    return inFull(Math.trunc(meant), fractionDigits(meant));
  }
  return abbreviate(meant);
}

function abbreviate(amount: number, index = bandFor(amount)): string {
  const band = BANDS[index]!;
  const next = BANDS[index + 1];
  const steps = Math.round(amount / band.step);
  // Rounding can fill a band: 99,950 is 100K, not 100.0K, and 999,999 is 1M.
  if (next && steps * band.step >= next.from) {
    return abbreviate(amount, index + 1);
  }
  return `${withDecimals(steps, band.decimals)}${band.suffix}`;
}

// The last band the amount reaches; a loop rather than findLastIndex, which
// React Native's TypeScript config does not know (its lib stops at ES2022).
const bandFor = (amount: number): number => {
  let index = -1;
  for (let i = 0; i < BANDS.length; i += 1) {
    if (amount >= BANDS[i]!.from) index = i;
  }
  return index;
};

/**
 * `steps` counted in units of `10^-decimals`, the fraction's trailing zeros
 * dropped: 123 at one decimal is `12.3`, 100 at two is `1`.
 */
function withDecimals(steps: number, decimals: number): string {
  const scale = 10 ** decimals;
  const whole = digits(Math.floor(steps / scale));
  const fraction = String(steps % scale)
    .padStart(decimals, '0')
    .replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

// The wheel's `formatWedgeAmount` carries the same noise and digit helpers.
// They are copied rather than shared: a game imports no other game, and the
// two schemes only look alike, a wedge being abbreviated only where that is
// exact and a cell rounded to three digits.

function inFull(whole: number, fraction: string): string {
  const grouped = digits(whole).replace(/\B(?=(\d{3})+$)/g, ',');
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/**
 * `amount` to the fifteen digits a double carries exactly, where the order
 * its parts were added in no longer shows: 0.1 + 0.2 is 0.3.
 */
export function withoutFloatNoise(amount: number): number {
  // From 1e15 up, fifteen digits stop short of the units.
  return amount < 1e15
    ? Number(amount.toPrecision(SIGNIFICANT_DIGITS))
    : amount;
}

/** Cut rather than rounded, so 999.9999999 cannot read as `1,000`. */
function fractionDigits(amount: number): string {
  const text = String(amount);
  // Exponent form: 1.5e-7 would otherwise slice a fraction of `5e-7`.
  if (text.includes('e')) return '';
  const point = text.indexOf('.');
  if (point < 0) return '';
  return text
    .slice(point + 1, point + 1 + MAX_FRACTION_DIGITS)
    .replace(/0+$/, '');
}

/** Every digit of a whole number, where `String` would switch to exponent form. */
const digits = (whole: number): string => BigInt(whole).toString();

/** The console every platform provides, reached through `globalThis` so the rules need no platform's types. */
function reportError(message: string): void {
  const platform = globalThis as { console?: { error: (m: string) => void } };
  platform.console?.error(message);
}
