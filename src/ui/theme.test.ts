import { describe, expect, it } from 'vitest';
import { CHOICES } from '../core/settings';
import { pickerOrder, resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('System is Daylight on a light OS and Graphite on a dark one; a named theme is itself', () => {
    expect(resolveTheme('system', true)).toBe('daylight');
    expect(resolveTheme('system', false)).toBe('graphite');
    expect(resolveTheme('paper', false)).toBe('paper');
    expect(resolveTheme('missing-link', false)).toBe('missing-link');
  });
});

describe('pickerOrder', () => {
  it('lists what is new first, then every theme as listed, each once', () => {
    const order = pickerOrder(CHOICES.theme);
    expect(order[0]).toBe('missing-link');
    expect([...order].sort()).toEqual([...CHOICES.theme].sort());
    expect(order.slice(1)).toEqual(CHOICES.theme.filter((t) => t !== 'missing-link'));
  });
});
