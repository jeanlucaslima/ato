import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('System is Daylight on a light OS and Graphite on a dark one; a named theme is itself', () => {
    expect(resolveTheme('system', true)).toBe('daylight');
    expect(resolveTheme('system', false)).toBe('graphite');
    expect(resolveTheme('paper', false)).toBe('paper');
  });
});
