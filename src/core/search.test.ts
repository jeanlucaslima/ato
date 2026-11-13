import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { findRanges, parseQuery, searchTabs } from './search';
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

describe('searchTabs', () => {
  const tabs = [tab(1, 'Hacker News', 'https://news.ycombinator.com/'), tab(2, 'chrome.tabs API', 'https://developer.chrome.com/tabs')];

  it('requires every term', () => {
    expect(searchTabs(tabs, parseQuery('chrome tabs')).map((h) => h.tab.id)).toEqual([2]);
    expect(searchTabs(tabs, parseQuery('chrome news'))).toEqual([]);
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
