// Bengali number formatting helpers. All on-screen numbers go through these.

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** Replace ASCII digits in any string with Bengali digits. */
export function toBnDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[d.charCodeAt(0) - 48]);
}

/**
 * Group an integer string South-Asian style: last 3 digits, then pairs.
 * 1234567 -> "12,34,567"
 */
function groupLakh(intDigits: string): string {
  if (intDigits.length <= 3) return intDigits;
  const last3 = intDigits.slice(-3);
  let rest = intDigits.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return `${parts.join(',')},${last3}`;
}

/**
 * Format a number with Bengali digits and lakh grouping.
 * @param decimals fixed number of fraction digits (default 0)
 */
export function formatBn(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(decimals);
  const [intPart, frac] = fixed.split('.');
  // toFixed can round "-0.4" to "0"; don't print "-০"
  const isZero = /^[0.]+$/.test(fixed);
  const body = groupLakh(intPart) + (frac ? `.${frac}` : '');
  return toBnDigits((negative && !isZero ? '-' : '') + body);
}

/** ৳ currency: formatTaka(12500) -> "৳১২,৫০০"; negatives -> "-৳৫০০". */
export function formatTaka(value: number, decimals = 0): string {
  const s = formatBn(value, decimals);
  return s.startsWith('-') ? `-৳${s.slice(1)}` : `৳${s}`;
}

/** Per-kg price, shows paisa when the value is not a whole taka: "৳২২.৫০/কেজি". */
export function formatTakaPerKg(value: number): string {
  const decimals = Math.abs(value - Math.round(value)) < 0.005 ? 0 : 2;
  return `${formatTaka(value, decimals)}/কেজি`;
}

export function formatKg(value: number): string {
  return `${formatBn(Math.round(value))} কেজি`;
}

export function formatKmh(value: number): string {
  return formatBn(Math.round(Math.abs(value)));
}

/** Distance: < 1000 m in metres, otherwise km with one decimal. */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${formatBn(Math.max(0, Math.round(metres)))} মিটার`;
  return `${formatBn(metres / 1000, 1)} কিমি`;
}

/** Seconds as m:ss in Bengali digits. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return toBnDigits(`${m}:${ss}`);
}
