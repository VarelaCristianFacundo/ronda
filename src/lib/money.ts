// Money helpers. All amounts are integer minor units (cents). Never use floats for money:
// parsing and formatting here are done with string/integer arithmetic only.

export const CURRENCIES = {
  ARS: { symbol: '$', name: 'Peso argentino', spoken: 'pesos', hideZeroCents: true },
  USD: { symbol: 'US$', name: 'Dólar estadounidense', spoken: 'dólares', hideZeroCents: false },
  EUR: { symbol: '€', name: 'Euro', spoken: 'euros', hideZeroCents: false },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

/** Upper bound for a single amount: 10.000.000.000,00 — far below Number.MAX_SAFE_INTEGER. */
export const MAX_AMOUNT_MINOR = 1_000_000_000_000;

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && value in CURRENCIES;
}

export function assertMinor(value: number): void {
  if (!Number.isSafeInteger(value)) throw new Error(`Invalid minor amount: ${value}`);
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Formats the absolute value, e.g. 6240000 ARS → "$ 62.400", 4250 EUR → "€ 42,50". */
export function formatMoney(
  minor: number,
  currency: CurrencyCode,
  opts: { symbol?: boolean; cents?: 'auto' | 'always' | 'never' } = {},
): string {
  assertMinor(minor);
  const { symbol = true, cents = 'auto' } = opts;
  const abs = Math.abs(minor);
  const whole = Math.trunc(abs / 100);
  const frac = abs % 100;
  const info = CURRENCIES[currency];
  const showCents =
    cents === 'always' || (cents === 'auto' && (frac !== 0 || !info.hideZeroCents));
  const body = groupThousands(String(whole)) + (showCents ? ',' + String(frac).padStart(2, '0') : '');
  return symbol ? `${info.symbol} ${body}` : body;
}

/** Screen-reader friendly amount, e.g. "62.400 pesos" or "42,50 euros". */
export function spokenMoney(minor: number, currency: CurrencyCode): string {
  return `${formatMoney(minor, currency, { symbol: false })} ${CURRENCIES[currency].spoken}`;
}

/**
 * Parses user input in es-AR or plain notation into minor units.
 * Accepted: "86500", "86.500", "86.500,50", "86500,5", "86500.50", "$ 1.234,5".
 * Rules: if both "." and "," appear, the last one is the decimal separator. A lone "," is decimal.
 * A lone "." is a thousands separator when every group after it has exactly 3 digits,
 * otherwise it is decimal. At most 2 decimals. Returns null when invalid or out of range.
 */
export function parseAmount(input: string): number | null {
  const s = input.replace(/[\s$€]|US\$|ARS|USD|EUR/gi, '');
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let intPart: string;
  let fracPart = '';

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalIdx = Math.max(lastDot, lastComma);
    const thousandsSep = decimalIdx === lastDot ? ',' : '.';
    intPart = s.slice(0, decimalIdx);
    fracPart = s.slice(decimalIdx + 1);
    if (intPart.includes(s[decimalIdx])) return null;
    if (!isValidGrouping(intPart, thousandsSep)) return null;
    intPart = intPart.split(thousandsSep).join('');
  } else if (lastComma !== -1) {
    const parts = s.split(',');
    if (parts.length !== 2) return null;
    [intPart, fracPart] = parts;
  } else if (lastDot !== -1) {
    const parts = s.split('.');
    const looksLikeThousands = parts.length > 1 && parts.slice(1).every((p) => p.length === 3) && parts[0].length > 0;
    if (looksLikeThousands) {
      intPart = parts.join('');
    } else if (parts.length === 2) {
      [intPart, fracPart] = parts;
    } else {
      return null;
    }
  } else {
    intPart = s;
  }

  if (intPart === '') intPart = '0';
  if (!/^\d+$/.test(intPart) || !/^\d{0,2}$/.test(fracPart)) return null;
  if (intPart.length > 13) return null;

  const minor = Number(intPart) * 100 + Number(fracPart.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor > MAX_AMOUNT_MINOR) return null;
  return minor;
}

function isValidGrouping(intPart: string, sep: string): boolean {
  if (!intPart.includes(sep)) return /^\d*$/.test(intPart);
  const groups = intPart.split(sep);
  return /^\d{1,3}$/.test(groups[0]) && groups.slice(1).every((g) => /^\d{3}$/.test(g));
}

/** Value for an editable input, e.g. 8650050 → "86.500,50", 8650000 → "86.500". */
export function toInputValue(minor: number | null): string {
  if (minor === null) return '';
  return formatMoney(minor, 'ARS', { symbol: false });
}

/** Percent in basis points (100 % = 10000). Parses "30", "33,33", "12.5". */
export function parsePercent(input: string): number | null {
  const s = input.replace(/[\s%]/g, '').replace(',', '.');
  if (!/^\d{1,3}(\.\d{0,2})?$/.test(s)) return null;
  const [i, f = ''] = s.split('.');
  const bp = Number(i) * 100 + Number(f.padEnd(2, '0'));
  return bp <= 10000 ? bp : null;
}

export function formatPercent(bp: number): string {
  const whole = Math.trunc(bp / 100);
  const frac = bp % 100;
  return frac === 0 ? String(whole) : `${whole},${String(frac).padStart(2, '0').replace(/0$/, '')}`;
}

export function sumMinor(values: readonly number[]): number {
  let total = 0;
  for (const v of values) {
    assertMinor(v);
    total += v;
  }
  assertMinor(total);
  return total;
}
