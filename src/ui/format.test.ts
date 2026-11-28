import { describe, expect, it } from 'vitest';
import { describeKept, failure, keptTotal, num, plural, shortNum, tallyKept, whyFailed } from './format';

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

describe('kept tabs', () => {
  it('count by reason, and read in a fixed order', () => {
    const kept = tallyKept(['pinned', 'playing', 'pinned'], { current: 1 });
    expect(kept).toEqual({ current: 1, pinned: 2, playing: 1 });
    expect(keptTotal(kept)).toBe(4);
    expect(describeKept(kept)).toBe('the current tab, 1 playing, 2 pinned');
    expect(describeKept({ current: 2, split: 1, grouped: 3, copy: 1 })).toBe('2 current tabs, 1 in split view, 3 in groups, 1 last copy');
    expect(keptTotal({})).toBe(0);
  });
});

describe('failures', () => {
  it('say why when Chrome’s error has a plain answer', () => {
    expect(whyFailed(new Error('Tabs cannot be edited right now (user may be dragging a tab).'))).toBe('finish dragging the tab, then try again');
    expect(whyFailed('Error: No tab with id: 42.')).toBe('the tab is already closed');
    expect(whyFailed(new Error('something else'))).toBeUndefined();
    expect(failure('Couldn’t move tabs', 'the window is already closed')).toBe('Couldn’t move tabs: the window is already closed');
    expect(failure('Couldn’t move tabs')).toBe('Couldn’t move tabs. Try again.');
  });
});
