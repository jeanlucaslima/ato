import { describe, expect, it } from 'vitest';
import { domainOf, duplicateKey, formatAge, pathOf } from './tabs';

describe('domainOf', () => {
  it.each([
    ['https://www.youtube.com/watch?v=1', 'youtube.com'],
    ['https://youtube.com/', 'youtube.com'],
    ['https://news.ycombinator.com/', 'news.ycombinator.com'],
    ['about:blank', ''],
    ['not a url', ''],
  ])('%s → %s', (url, expected) => expect(domainOf(url)).toBe(expected));
});

describe('duplicateKey', () => {
  it('only considers web and file pages', () => {
    expect(duplicateKey({ url: 'https://a.test/' })).toBe('https://a.test/');
    expect(duplicateKey({ url: 'file:///x' })).toBe('file:///x');
    expect(duplicateKey({ url: 'chrome://settings' })).toBeNull();
    expect(duplicateKey({ url: '' })).toBeNull();
  });
});

describe('formatAge', () => {
  it.each([
    [0, 'now'],
    [59_000, 'now'],
    [12 * 60_000, '12m'],
    [3 * 3_600_000, '3h'],
    [5 * 86_400_000, '5d'],
    [21 * 86_400_000, '3w'],
  ])('%i ms → %s', (ms, expected) => expect(formatAge(ms)).toBe(expected));
});

describe('pathOf', () => {
  it.each([
    ['https://news.ycombinator.com/', '/'],
    ['https://news.ycombinator.com/item?id=4242', '/item?id=4242'],
    ['https://a.test/docs#intro', '/docs#intro'],
    ['not a url', ''],
  ])('%s → %s', (url, path) => expect(pathOf(url)).toBe(path));
});
