import fc from 'fast-check';
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

describe('duplicateKey match modes', () => {
  const key = (url: string, match: Parameters<typeof duplicateKey>[1]) => duplicateKey({ url }, match);
  it('ignores the #hash and/or ?query as asked; never mixes different pages', () => {
    expect(key('https://a.test/p?x=1#top', 'exact')).toBe('https://a.test/p?x=1#top');
    expect(key('https://a.test/p?x=1#top', 'ignoreHash')).toBe('https://a.test/p?x=1');
    expect(key('https://a.test/p?x=1#top', 'ignoreQuery')).toBe('https://a.test/p#top');
    expect(key('https://a.test/p?x=1#top', 'ignoreBoth')).toBe('https://a.test/p');
    expect(key('https://a.test/p?x=1', 'ignoreBoth')).not.toBe(key('https://a.test/q?x=1', 'ignoreBoth'));
    expect(key('chrome://settings/', 'ignoreBoth')).toBeNull();
  });
});

describe('duplicateKey match modes (properties)', () => {
  const word = fc.stringMatching(/^[a-z0-9]{1,8}$/);
  const page = fc.record({ host: word, path: word });
  const pair = fc.tuple(word, word).filter(([a, b]) => a !== b);
  const url = (host: string, path: string, q: string, h: string) => `https://${host}.test/${path}?q=${q}#${h}`;
  const same = (a: string, b: string, m: Parameters<typeof duplicateKey>[1]) => duplicateKey({ url: a }, m) === duplicateKey({ url: b }, m);

  it('URLs differing only in their ?query: one key under ignoreQuery and ignoreBoth, never under exact or ignoreHash', () => {
    fc.assert(
      fc.property(page, pair, word, ({ host, path }, [q1, q2], h) => {
        const a = url(host, path, q1, h);
        const b = url(host, path, q2, h);
        return same(a, b, 'ignoreQuery') && same(a, b, 'ignoreBoth') && !same(a, b, 'exact') && !same(a, b, 'ignoreHash');
      }),
    );
  });

  it('URLs differing only in their #hash: one key under ignoreHash and ignoreBoth, never under exact or ignoreQuery', () => {
    fc.assert(
      fc.property(page, pair, word, ({ host, path }, [h1, h2], q) => {
        const a = url(host, path, q, h1);
        const b = url(host, path, q, h2);
        return same(a, b, 'ignoreHash') && same(a, b, 'ignoreBoth') && !same(a, b, 'exact') && !same(a, b, 'ignoreQuery');
      }),
    );
  });
});
