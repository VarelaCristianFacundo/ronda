import { describe, expect, it } from 'vitest';
import { formatMoney, formatPercent, parseAmount, parsePercent, spokenMoney, toInputValue } from './money';

describe('formatMoney', () => {
  it('formats ARS without zero cents and with es-AR grouping', () => {
    expect(formatMoney(6_240_000, 'ARS')).toBe('$ 62.400');
    expect(formatMoney(6_240_050, 'ARS')).toBe('$ 62.400,50');
    expect(formatMoney(1, 'ARS')).toBe('$ 0,01');
    expect(formatMoney(0, 'ARS')).toBe('$ 0');
  });

  it('always shows cents for USD and EUR', () => {
    expect(formatMoney(4_500, 'USD')).toBe('US$ 45,00');
    expect(formatMoney(4_250, 'EUR')).toBe('€ 42,50');
  });

  it('formats the absolute value (direction is conveyed in words)', () => {
    expect(formatMoney(-3_820_000, 'ARS')).toBe('$ 38.200');
  });

  it('rejects non-integer input', () => {
    expect(() => formatMoney(10.5, 'ARS')).toThrow();
  });

  it('builds spoken labels for screen readers', () => {
    expect(spokenMoney(6_240_000, 'ARS')).toBe('62.400 pesos');
  });
});

describe('parseAmount', () => {
  it.each([
    ['86500', 8_650_000],
    ['86.500', 8_650_000],
    ['1.234.567', 123_456_700],
    ['86.500,50', 8_650_050],
    ['86500,5', 8_650_050],
    ['86500.50', 8_650_050],
    ['12.5', 1_250],
    ['0,01', 1],
    [',5', 50],
    ['$ 1.234,5', 123_450],
    ['1,234.56', 123_456],
  ])('parses %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['', 'abc', '1,2,3', '12,345', '1.2.3', '86.50,5', '1,234,5', '0,001', '-5', '1e5'])(
    'rejects %s',
    (input) => {
      expect(parseAmount(input)).toBeNull();
    },
  );

  it('rejects amounts above the maximum', () => {
    expect(parseAmount('10000000000,01')).toBeNull();
    expect(parseAmount('10000000000')).toBe(1_000_000_000_000);
  });

  it('round-trips with toInputValue', () => {
    for (const v of [1, 99, 100, 8_650_050, 123_456_789]) {
      expect(parseAmount(toInputValue(v))).toBe(v);
    }
  });
});

describe('percent', () => {
  it('parses to basis points', () => {
    expect(parsePercent('30')).toBe(3000);
    expect(parsePercent('33,33')).toBe(3333);
    expect(parsePercent('12.5')).toBe(1250);
    expect(parsePercent('100')).toBe(10000);
    expect(parsePercent('100,01')).toBeNull();
    expect(parsePercent('1,234')).toBeNull();
  });

  it('formats basis points', () => {
    expect(formatPercent(3000)).toBe('30');
    expect(formatPercent(3333)).toBe('33,33');
    expect(formatPercent(1250)).toBe('12,5');
  });
});
