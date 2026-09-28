import { describe, expect, it } from 'vitest';
import { inboxUrl, isValidEmail, suggestEmail } from './email';
import { safeNext } from './nav';

describe('email', () => {
  it('validates', () => {
    expect(isValidEmail('sofi.benitez@gmail.com')).toBe(true);
    expect(isValidEmail('sofi.benitez@gmail')).toBe(false);
    expect(isValidEmail('sofi@@gmail.com')).toBe(false);
    expect(isValidEmail('a@b.c')).toBe(false);
  });

  it('suggests the design example', () => {
    expect(suggestEmail('sofi.benitez@gmail')).toBe('sofi.benitez@gmail.com');
  });

  it('suggests close domains and ignores correct ones', () => {
    expect(suggestEmail('x@gmial.com')).toBe('x@gmail.com');
    expect(suggestEmail('x@hotmial.com')).toBe('x@hotmail.com');
    expect(suggestEmail('x@gmail.com')).toBeNull();
    expect(suggestEmail('x@empresa.com.ar')).toBeNull();
    expect(suggestEmail('nope')).toBeNull();
  });

  it('knows a few inboxes', () => {
    expect(inboxUrl('a@gmail.com')).toContain('mail.google.com');
    expect(inboxUrl('a@empresa.com')).toBeNull();
  });
});

describe('safeNext', () => {
  it('allows only same-origin relative paths', () => {
    expect(safeNext('/grupos/abc')).toBe('/grupos/abc');
    expect(safeNext('/u/tok?x=1')).toBe('/u/tok?x=1');
    expect(safeNext('//evil.com')).toBe('/grupos');
    expect(safeNext('/\\evil.com')).toBe('/grupos');
    expect(safeNext('https://evil.com')).toBe('/grupos');
    expect(safeNext(null)).toBe('/grupos');
    expect(safeNext('/entrar')).toBe('/grupos');
  });
});
