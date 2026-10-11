import { expect, it } from 'vitest';
import { queryTabs, browseTabs, sortDomainGroups } from './queries.js';

it('preserves ranking, scoped aliases and highlighting data through engine queries', () => {
  const tabs = [
    { id: 9, title: 'My Github notes', url: 'https://notes.test' },
    { id: 3, title: 'GitHub', url: 'https://github.test' },
    { id: 4, title: 'Unrelated', url: 'https://github.test/docs' }
  ];
  const result = queryTabs(tabs, { query: 'git*', field: 'title' });
  expect(result.map(({ tab }) => tab.id)).toEqual([3, 9]);
  expect(result[0].match.matches.title.indices).toEqual([0, 1, 2]);
  expect(queryTabs(tabs, { query: 'intitle:git*' })).toEqual(result);
  expect(queryTabs(tabs, { query: 'inurl:github', mode: 'contains' }).map(({ tab }) => tab.id)).toEqual([3, 4]);
  expect(queryTabs(tabs, { query: '"git"', mode: 'exact' })).toEqual([]);
});

it('sorts normalized duplicates rather than losing counts for query variants', () => {
  const tabs = [
    { id: 1, url: 'https://unique.test/' },
    { id: 2, url: 'https://same.test/?a=1' },
    { id: 3, url: 'https://same.test/?a=2' },
    { id: 4, url: 'https://same.test/?a=3' }
  ];
  expect(browseTabs(tabs, { sort: 'duplicates', matchMode: 'ignoreQuery' }).map(tab => tab.id)).toEqual([2, 3, 4, 1]);
});

it('layers media ordering and last-accessed domain sorting without mutating input', () => {
  const tabs = [{ id: 1, url: 'https://z.test/', title: 'A' },
    { id: 2, url: 'https://a.test/', title: 'Z', audible: true }];
  expect(browseTabs(tabs, { sort: 'title' }).map(tab => tab.id)).toEqual([2, 1]);
  expect(tabs.map(tab => tab.id)).toEqual([1, 2]);
  expect(sortDomainGroups([{ domain: 'z.test', tabs: [{ lastAccessed: 20 }] },
    { domain: 'a.test', tabs: [{ lastAccessed: 10 }] }], { domainSection: 'recent' }).map(group => group.domain)).toEqual(['z.test', 'a.test']);
});
