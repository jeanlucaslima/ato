import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { findRanges, joinField, parseQuery, searchTabs, splitField } from './search';
import type { Tab } from './types';

const tab = (id: number, title: string, url: string): Tab => ({
  id,
  windowId: 1,
  index: id,
  title,
  url,
  active: false,
  pinned: false,
  audible: false,
  discarded: false,
  groupId: -1,
  lastAccessed: id,
});

describe('parseQuery', () => {
  it.each([
    ['chrome tabs', { mode: 'contains', field: 'all', terms: ['chrome', 'tabs'] }],
    ['"Chrome Tabs"', { mode: 'exact', field: 'all', terms: ['chrome tabs'] }],
    ['"open quote', { mode: 'exact', field: 'all', terms: ['open quote'] }],
    ['url: github', { mode: 'contains', field: 'url', terms: ['github'] }],
    ['title:"a b"', { mode: 'exact', field: 'title', terms: ['a b'] }],
    ['   ', { mode: 'contains', field: 'all', terms: [] }],
  ])('%s', (raw, expected) => expect(parseQuery(raw)).toEqual(expected));
});

describe('splitField', () => {
  it.each([
    ['url:', { field: 'url', rest: '' }],
    ['URL: github', { field: 'url', rest: 'github' }],
    ['  title:"a b"', { field: 'title', rest: '"a b"' }],
    ['url:title:x', { field: 'url', rest: 'title:x' }],
    ['github url:', { field: null, rest: 'github url:' }],
    ['urls: x', { field: null, rest: 'urls: x' }],
  ])('%s', (raw, expected) => expect(splitField(raw)).toEqual(expected));

  it('chip + text always search for what was typed', () => {
    const typed = fc.oneof(fc.string(), fc.tuple(fc.constantFrom('url:', 'title:', 'URL: ', ' title:  '), fc.string()).map(([p, s]) => p + s));
    fc.assert(
      fc.property(typed, (raw) => {
        const { field, rest } = splitField(raw);
        expect(parseQuery(joinField(field, rest))).toEqual(parseQuery(raw));
      }),
    );
  });

  it('splits back what was joined', () => {
    const rest = fc.string().filter((s) => !/^\s/.test(s));
    fc.assert(
      fc.property(fc.constantFrom('url' as const, 'title' as const, 'dupe' as const, null), rest, (field, text) => {
        const back = splitField(joinField(field, text));
        return field === null ? back.rest === joinField(field, text) : back.field === field && back.rest === text;
      }),
    );
  });
});

describe('searchTabs', () => {
  const tabs = [tab(1, 'Hacker News', 'https://news.ycombinator.com/'), tab(2, 'chrome.tabs API', 'https://developer.chrome.com/tabs')];

  it('requires every term', () => {
    expect(searchTabs(tabs, parseQuery('chrome tabs')).map((h) => h.tab.id)).toEqual([2]);
    expect(searchTabs(tabs, parseQuery('chrome news'))).toEqual([]);
  });

  it('dupe: lists only tabs open more than once, biggest sets first, and narrows by any field', () => {
    const dup = [
      ...tabs,
      tab(3, 'Hacker News', 'https://news.ycombinator.com/'),
      tab(4, 'Lofi', 'https://youtube.com/watch?v=a'),
      tab(5, 'Lofi', 'https://youtube.com/watch?v=a'),
      tab(6, 'Lofi', 'https://youtube.com/watch?v=a'),
    ];
    expect(searchTabs(dup, parseQuery('dupe:')).map((h) => h.tab.id)).toEqual([6, 5, 4, 3, 1]);
    expect(searchTabs(dup, parseQuery('dupe: ycombinator')).map((h) => h.tab.id).sort()).toEqual([1, 3]);
    expect(searchTabs(dup, parseQuery('dupe: chrome'))).toEqual([]);
  });

  it('scopes to a field', () => {
    expect(searchTabs(tabs, parseQuery('title: ycombinator'))).toEqual([]);
    expect(searchTabs(tabs, parseQuery('url: ycombinator')).map((h) => h.tab.id)).toEqual([1]);
  });

  it('returns ranges that point at the terms', () => {
    fc.assert(
      fc.property(fc.string(), fc.string({ minLength: 1, maxLength: 3 }), (text, term) => {
        const t = term.toLowerCase();
        return findRanges(text, [t]).every(([s, e]) => text.slice(s, e).toLowerCase() === t);
      }),
    );
  });
});
