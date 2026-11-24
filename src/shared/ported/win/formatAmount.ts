/** A double carries fifteen digits exactly at any magnitude; past that is noise. */
const SIGNIFICANT_DIGITS = 15;

const MAX_FRACTION_DIGITS = 6;

/** An amount with every digit: `10,000`, `1.5`. Empty for one that is not a non-negative number. */
export function formatFullAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return '';
  const meant = withoutFloatNoise(amount);
  const grouped = groupThousands(Math.trunc(meant));
  const fraction = fractionDigits(meant);
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/** A whole number grouped in thousands: `100,500`. */
export function groupThousands(whole: number): string {
  return digits(whole).replace(/\B(?=(\d{3})+$)/g, ',');
}

function withoutFloatNoise(amount: number): number {
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
