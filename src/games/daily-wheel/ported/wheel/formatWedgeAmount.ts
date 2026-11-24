import { formatFullAmount } from '../../../../shared/ported/win/formatAmount';

/** A prize amount as its wedge draws it: `3K`, `1.5M`, else `100,500` in full. */
// No `B` for billions - on this sheet `B` is the Betty coin mark.
export function formatWedgeAmount(amount: number): string {
  const full = formatFullAmount(amount);
  if (full === '') {
    console.error(
      `[minigames] wedge amount must be a non-negative number: ${String(amount)}`,
    );
    return '';
  }
  // An amount with decimals is never abbreviated.
  if (full.includes('.')) return full;
  return abbreviate(Number(full.replace(/,/g, ''))) ?? full;
}

function abbreviate(whole: number): string | undefined {
  if (whole < 1_000) return undefined;
  const [unit, suffix] = whole < 1_000_000 ? [1_000, 'K'] : [1_000_000, 'M'];

  if (whole < 10 * unit) {
    // Whole tenths rather than whole / unit, which is not exact in binary.
    const tenth = unit / 10;
    if (whole % tenth !== 0) return undefined;
    const tenths = whole / tenth;
    const decimal = tenths % 10;
    return `${Math.floor(tenths / 10)}${decimal ? `.${decimal}` : ''}${suffix}`;
  }

  return whole % unit === 0 ? `${digits(whole / unit)}${suffix}` : undefined;
}

/** Every digit of a whole number, where `String` would switch to exponent form. */
const digits = (whole: number): string => BigInt(whole).toString();
