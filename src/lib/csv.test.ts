import { describe, expect, it } from 'vitest';
import { cell, minorToDecimal, toCsv } from './csv';

describe('csv', () => {
  it('formats minor units as decimals without floats', () => {
    expect(minorToDecimal(8_650_050)).toBe('86500.50');
    expect(minorToDecimal(1)).toBe('0.01');
    expect(minorToDecimal(-250)).toBe('-2.50');
    expect(minorToDecimal(999_999_999_999)).toBe('9999999999.99');
  });

  it('quotes and escapes', () => {
    expect(cell('Cena, "El Boliche"')).toBe('"Cena, ""El Boliche"""');
    expect(cell('línea\nnueva')).toBe('"línea\nnueva"');
    expect(cell(null)).toBe('');
  });

  it('neutralizes formula injection but keeps numbers', () => {
    expect(cell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(cell('+54 11')).toBe("'+54 11");
    expect(cell({ number: '-2.50' })).toBe('-2.50');
  });

  it('adds a BOM and CRLF line endings', () => {
    expect(toCsv(['a', 'b'], [['1', { number: '2.00' }]])).toBe('﻿a,b\r\n1,2.00\r\n');
  });
});
