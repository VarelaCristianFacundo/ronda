// CSV export helpers. Amounts are written as plain decimals derived from integer minor units
// (e.g. 8650050 → "86500.50"), never via floating point.

export function minorToDecimal(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Quotes a cell per RFC 4180 and neutralizes spreadsheet formula injection: text starting
 * with = + - @ (or tab/CR) is prefixed with an apostrophe. Numeric amounts are passed as
 * `{ number: … }` so negative values are not mangled.
 */
export function cell(value: string | number | null | undefined | { number: string }): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return value.number;
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number | null | undefined | { number: string })[][]): string {
  const lines = [header.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))];
  // BOM so Excel opens UTF-8 (accents) correctly.
  return '﻿' + lines.join('\r\n') + '\r\n';
}
