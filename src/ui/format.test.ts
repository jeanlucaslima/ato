import { describe, expect, it } from 'vitest';
import { num, plural, shortNum } from './format';

describe('counts', () => {
  it('group thousands, and shorten only where space is tight', () => {
    expect(num(1102)).toBe('1,102');
    expect(plural(12345, 'duplicate')).toBe('12,345 duplicates');
    expect(shortNum(999)).toBe('999');
    expect(shortNum(1240)).toBe('1.2k');
    expect(shortNum(6000)).toBe('6k');
    expect(shortNum(12345)).toBe('12.3k');
    expect(shortNum(123456)).toBe('123k');
  });
});
