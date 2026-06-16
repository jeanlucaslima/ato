import { describe, it, expect } from 'vitest';
import {
  findDuplicates,
  extractDomain,
  countDuplicatesByUrl,
  groupTabsByDomain,
  formatTimeAgo,
  sortTabs,
  sortAudibleFirst,
  normalizeUrl,
  fuzzyMatch,
  fuzzySearchTab,
  exactWordMatch,
  substringMatch,
  parseSearchQuery,
  searchTab,
  highlightMatches,
  isLoadableFavicon
} from './tab-utils.js';

describe('findDuplicates', () => {
  it('returns empty array when no tabs provided', () => {
    expect(findDuplicates([])).toEqual([]);
  });

  it('returns empty array when all tabs have unique URLs', () => {
    const tabs = [
      { id: 1, url: 'https://example.com/page1' },
      { id: 2, url: 'https://example.com/page2' },
      { id: 3, url: 'https://other.com' }
    ];
    expect(findDuplicates(tabs)).toEqual([]);
  });

  it('identifies duplicate tabs with same URL', () => {
    const tabs = [
      { id: 1, url: 'https://example.com' },
      { id: 2, url: 'https://example.com' },
      { id: 3, url: 'https://other.com' }
    ];
    const duplicates = findDuplicates(tabs);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].id).toBe(2);
  });

  it('handles multiple duplicates of same URL', () => {
    const tabs = [
      { id: 1, url: 'https://example.com' },
      { id: 2, url: 'https://example.com' },
      { id: 3, url: 'https://example.com' }
    ];
    const duplicates = findDuplicates(tabs);
    expect(duplicates).toHaveLength(2);
    expect(duplicates.map(t => t.id)).toEqual([2, 3]);
  });

  it('detects chrome:// duplicates', () => {
    const tabs = [
      { id: 1, url: 'chrome://extensions' },
      { id: 2, url: 'chrome://extensions' }
    ];
    expect(findDuplicates(tabs)).toEqual([{ id: 2, url: 'chrome://extensions' }]);
  });

  it('detects edge:// duplicates', () => {
    const tabs = [
      { id: 1, url: 'edge://settings' },
      { id: 2, url: 'edge://settings' }
    ];
    expect(findDuplicates(tabs)).toEqual([{ id: 2, url: 'edge://settings' }]);
  });

  it('skips tabs with no URL', () => {
    const tabs = [
      { id: 1, url: null },
      { id: 2, url: undefined },
      { id: 3 }
    ];
    expect(findDuplicates(tabs)).toEqual([]);
  });

  it('treats URLs with different fragments as different', () => {
    const tabs = [
      { id: 1, url: 'https://example.com#section1' },
      { id: 2, url: 'https://example.com#section2' }
    ];
    expect(findDuplicates(tabs)).toEqual([]);
  });

  it('treats URLs with different query params as different', () => {
    const tabs = [
      { id: 1, url: 'https://example.com?page=1' },
      { id: 2, url: 'https://example.com?page=2' }
    ];
    expect(findDuplicates(tabs)).toEqual([]);
  });

  it('identifies duplicates across multiple duplicate URLs', () => {
    const tabs = [
      { id: 1, url: 'https://a.com' },
      { id: 2, url: 'https://b.com' },
      { id: 3, url: 'https://a.com' },
      { id: 4, url: 'https://b.com' }
    ];
    const duplicates = findDuplicates(tabs);
    expect(duplicates).toHaveLength(2);
    expect(duplicates.map(t => t.id)).toEqual([3, 4]);
  });
});

describe('extractDomain', () => {
  it('extracts hostname from valid URL', () => {
    expect(extractDomain('https://example.com/path')).toBe('example.com');
  });

  it('extracts hostname with www prefix', () => {
    expect(extractDomain('https://www.example.com')).toBe('www.example.com');
  });

  it('extracts hostname with subdomain', () => {
    expect(extractDomain('https://sub.example.com')).toBe('sub.example.com');
  });

  it('extracts hostname with port', () => {
    expect(extractDomain('https://localhost:3000/page')).toBe('localhost');
  });

  it('returns null for invalid URL', () => {
    expect(extractDomain('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractDomain('')).toBeNull();
  });

  it('handles http protocol', () => {
    expect(extractDomain('http://example.com')).toBe('example.com');
  });

  it('handles complex paths and query strings', () => {
    expect(extractDomain('https://example.com/path/to/page?query=value#hash')).toBe('example.com');
  });
});

describe('countDuplicatesByUrl', () => {
  it('returns empty map for empty array', () => {
    const result = countDuplicatesByUrl([]);
    expect(result.size).toBe(0);
  });

  it('counts single occurrence correctly', () => {
    const tabs = [{ url: 'https://example.com' }];
    const result = countDuplicatesByUrl(tabs);
    expect(result.get('https://example.com')).toBe(1);
  });

  it('counts multiple occurrences correctly', () => {
    const tabs = [
      { url: 'https://example.com' },
      { url: 'https://example.com' },
      { url: 'https://other.com' }
    ];
    const result = countDuplicatesByUrl(tabs);
    expect(result.get('https://example.com')).toBe(2);
    expect(result.get('https://other.com')).toBe(1);
  });

  it('counts chrome:// URLs', () => {
    const tabs = [{ url: 'chrome://extensions' }];
    const result = countDuplicatesByUrl(tabs);
    expect(result.size).toBe(1);
    expect(result.get('chrome://extensions')).toBe(1);
  });

  it('counts edge:// URLs', () => {
    const tabs = [{ url: 'edge://settings' }];
    const result = countDuplicatesByUrl(tabs);
    expect(result.size).toBe(1);
    expect(result.get('edge://settings')).toBe(1);
  });

  it('skips tabs with null/undefined URLs', () => {
    const tabs = [
      { url: null },
      { url: undefined },
      {}
    ];
    const result = countDuplicatesByUrl(tabs);
    expect(result.size).toBe(0);
  });
});

describe('groupTabsByDomain', () => {
  it('returns empty array for empty tabs', () => {
    expect(groupTabsByDomain([])).toEqual([]);
  });

  it('groups tabs by domain', () => {
    const tabs = [
      { url: 'https://example.com/page1' },
      { url: 'https://example.com/page2' },
      { url: 'https://other.com' }
    ];
    const groups = groupTabsByDomain(tabs);
    expect(groups).toHaveLength(2);
  });

  it('sorts groups by tab count descending', () => {
    const tabs = [
      { url: 'https://small.com' },
      { url: 'https://large.com/1' },
      { url: 'https://large.com/2' },
      { url: 'https://large.com/3' }
    ];
    const groups = groupTabsByDomain(tabs);
    expect(groups[0].domain).toBe('large.com');
    expect(groups[0].count).toBe(3);
    expect(groups[1].domain).toBe('small.com');
    expect(groups[1].count).toBe(1);
  });

  it('groups chrome:// pages by their path as domain', () => {
    const tabs = [
      { url: 'chrome://extensions' },
      { url: 'https://example.com' }
    ];
    const groups = groupTabsByDomain(tabs);
    expect(groups).toHaveLength(2);
    expect(groups.map(g => g.domain)).toContain('extensions');
    expect(groups.map(g => g.domain)).toContain('example.com');
  });

  it('groups edge:// pages by their path as domain', () => {
    const tabs = [
      { url: 'edge://settings' },
      { url: 'https://example.com' }
    ];
    const groups = groupTabsByDomain(tabs);
    expect(groups).toHaveLength(2);
    expect(groups.map(g => g.domain)).toContain('settings');
    expect(groups.map(g => g.domain)).toContain('example.com');
  });

  it('returns correct structure with domain, tabs, and count', () => {
    const tabs = [
      { id: 1, url: 'https://example.com/page1' },
      { id: 2, url: 'https://example.com/page2' }
    ];
    const groups = groupTabsByDomain(tabs);
    expect(groups[0]).toHaveProperty('domain', 'example.com');
    expect(groups[0]).toHaveProperty('count', 2);
    expect(groups[0]).toHaveProperty('tabs');
    expect(groups[0].tabs).toHaveLength(2);
  });

  it('skips tabs with invalid URLs', () => {
    const tabs = [
      { url: 'not-a-valid-url' },
      { url: 'https://example.com' }
    ];
    const groups = groupTabsByDomain(tabs);
    expect(groups).toHaveLength(1);
    expect(groups[0].domain).toBe('example.com');
  });
});

describe('formatTimeAgo', () => {
  it('returns dash for null timestamp', () => {
    expect(formatTimeAgo(null)).toBe('—');
  });

  it('returns dash for undefined timestamp', () => {
    expect(formatTimeAgo(undefined)).toBe('—');
  });

  it('returns dash for zero timestamp', () => {
    expect(formatTimeAgo(0)).toBe('—');
  });

  it('returns "now" for recent timestamp', () => {
    const now = Date.now();
    expect(formatTimeAgo(now)).toBe('now');
  });

  it('returns "now" for timestamp less than a minute ago', () => {
    const thirtySecondsAgo = Date.now() - 30000;
    expect(formatTimeAgo(thirtySecondsAgo)).toBe('now');
  });

  it('returns minutes for timestamps within an hour', () => {
    const thirtyMinsAgo = Date.now() - (30 * 60 * 1000);
    expect(formatTimeAgo(thirtyMinsAgo)).toBe('30m');
  });

  it('returns hours for timestamps within a day', () => {
    const fiveHoursAgo = Date.now() - (5 * 60 * 60 * 1000);
    expect(formatTimeAgo(fiveHoursAgo)).toBe('5h');
  });

  it('returns days for older timestamps', () => {
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(threeDaysAgo)).toBe('3d');
  });

  it('returns 1m for exactly one minute ago', () => {
    const oneMinuteAgo = Date.now() - 60000;
    expect(formatTimeAgo(oneMinuteAgo)).toBe('1m');
  });

  it('returns 1h for exactly one hour ago', () => {
    const oneHourAgo = Date.now() - 3600000;
    expect(formatTimeAgo(oneHourAgo)).toBe('1h');
  });

  it('returns 1d for exactly one day ago', () => {
    const oneDayAgo = Date.now() - 86400000;
    expect(formatTimeAgo(oneDayAgo)).toBe('1d');
  });
});

describe('sortTabs', () => {
  const mockTabs = [
    { id: 1, title: 'Zebra', url: 'https://zebra.com', lastAccessed: 1000 },
    { id: 2, title: 'Apple', url: 'https://apple.com', lastAccessed: 3000 },
    { id: 3, title: 'Mango', url: 'https://mango.com', lastAccessed: 2000 }
  ];

  it('returns original order for default sort', () => {
    const result = sortTabs(mockTabs, 'default', new Map());
    expect(result.map(t => t.id)).toEqual([1, 2, 3]);
  });

  it('sorts by title ascending', () => {
    const result = sortTabs(mockTabs, 'title', new Map());
    expect(result.map(t => t.title)).toEqual(['Apple', 'Mango', 'Zebra']);
  });

  it('sorts by title descending', () => {
    const result = sortTabs(mockTabs, 'title-desc', new Map());
    expect(result.map(t => t.title)).toEqual(['Zebra', 'Mango', 'Apple']);
  });

  it('sorts by domain', () => {
    const result = sortTabs(mockTabs, 'domain', new Map());
    expect(result.map(t => t.id)).toEqual([2, 3, 1]); // apple, mango, zebra
  });

  it('sorts by age oldest first (default direction)', () => {
    const result = sortTabs(mockTabs, 'age', new Map(), 'old');
    expect(result.map(t => t.id)).toEqual([1, 3, 2]); // 1000, 2000, 3000
  });

  it('sorts by age newest first', () => {
    const result = sortTabs(mockTabs, 'age', new Map(), 'new');
    expect(result.map(t => t.id)).toEqual([2, 3, 1]); // 3000, 2000, 1000
  });

  it('sorts by duplicates count', () => {
    const urlCounts = new Map([
      ['https://zebra.com', 1],
      ['https://apple.com', 3],
      ['https://mango.com', 2]
    ]);
    const result = sortTabs(mockTabs, 'duplicates', urlCounts);
    expect(result.map(t => t.id)).toEqual([2, 3, 1]); // 3, 2, 1 duplicates
  });

  it('does not mutate original array', () => {
    const original = [...mockTabs];
    sortTabs(mockTabs, 'title', new Map());
    expect(mockTabs).toEqual(original);
  });

  it('handles tabs with empty titles', () => {
    const tabsWithEmptyTitles = [
      { id: 1, title: '', url: 'https://a.com' },
      { id: 2, title: 'Apple', url: 'https://b.com' },
      { id: 3, title: null, url: 'https://c.com' }
    ];
    const result = sortTabs(tabsWithEmptyTitles, 'title', new Map());
    expect(result.map(t => t.id)).toEqual([1, 3, 2]); // empty strings come first
  });

  it('handles tabs with missing lastAccessed', () => {
    const tabsWithMissingAge = [
      { id: 1, url: 'https://a.com', lastAccessed: 1000 },
      { id: 2, url: 'https://b.com' }, // missing lastAccessed
      { id: 3, url: 'https://c.com', lastAccessed: 2000 }
    ];
    const result = sortTabs(tabsWithMissingAge, 'age', new Map(), 'old');
    expect(result.map(t => t.id)).toEqual([2, 1, 3]); // 0 (default), 1000, 2000
  });

  it('handles unknown sort option', () => {
    const result = sortTabs(mockTabs, 'unknown', new Map());
    expect(result.map(t => t.id)).toEqual([1, 2, 3]); // returns copy of original
  });

  it('handles empty tabs array', () => {
    const result = sortTabs([], 'title', new Map());
    expect(result).toEqual([]);
  });
});

describe('sortAudibleFirst', () => {
  it('floats audible tabs to the top', () => {
    const tabs = [
      { id: 1 },
      { id: 2, audible: true },
      { id: 3 },
      { id: 4, audible: true }
    ];
    const result = sortAudibleFirst(tabs);
    expect(result.map(t => t.id)).toEqual([2, 4, 1, 3]);
  });

  it('preserves relative order within audible and non-audible groups (stable)', () => {
    const tabs = [
      { id: 1, audible: false },
      { id: 2, audible: false },
      { id: 3, audible: true }
    ];
    const result = sortAudibleFirst(tabs);
    expect(result.map(t => t.id)).toEqual([3, 1, 2]);
  });

  it('does not mutate the original array', () => {
    const tabs = [{ id: 1 }, { id: 2, audible: true }];
    sortAudibleFirst(tabs);
    expect(tabs.map(t => t.id)).toEqual([1, 2]);
  });

  it('returns tabs unchanged when none are audible', () => {
    const tabs = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = sortAudibleFirst(tabs);
    expect(result.map(t => t.id)).toEqual([1, 2, 3]);
  });

  it('handles empty tabs array', () => {
    expect(sortAudibleFirst([])).toEqual([]);
  });
});

describe('normalizeUrl', () => {
  it('returns original URL for exact mode', () => {
    const url = 'https://example.com/page?foo=bar#section';
    expect(normalizeUrl(url, 'exact')).toBe(url);
  });

  it('removes query string for ignoreQuery mode', () => {
    const url = 'https://example.com/page?foo=bar#section';
    expect(normalizeUrl(url, 'ignoreQuery')).toBe('https://example.com/page#section');
  });

  it('removes hash for ignoreHash mode', () => {
    const url = 'https://example.com/page?foo=bar#section';
    expect(normalizeUrl(url, 'ignoreHash')).toBe('https://example.com/page?foo=bar');
  });

  it('removes both query and hash for ignoreQueryAndHash mode', () => {
    const url = 'https://example.com/page?foo=bar#section';
    expect(normalizeUrl(url, 'ignoreQueryAndHash')).toBe('https://example.com/page');
  });

  it('returns original URL if matchMode is not provided', () => {
    const url = 'https://example.com/page?foo=bar';
    expect(normalizeUrl(url)).toBe(url);
  });

  it('returns original URL for invalid URL', () => {
    expect(normalizeUrl('not-a-url', 'ignoreQuery')).toBe('not-a-url');
  });

  it('returns empty/null URL as-is', () => {
    expect(normalizeUrl(null, 'ignoreQuery')).toBe(null);
    expect(normalizeUrl('', 'ignoreQuery')).toBe('');
  });

  it('handles URL with only query string', () => {
    const url = 'https://example.com?foo=bar';
    expect(normalizeUrl(url, 'ignoreQuery')).toBe('https://example.com/');
  });

  it('handles URL with only hash', () => {
    const url = 'https://example.com#section';
    expect(normalizeUrl(url, 'ignoreHash')).toBe('https://example.com/');
  });
});

describe('findDuplicates with matchMode', () => {
  it('treats URLs with different query params as different in exact mode', () => {
    const tabs = [
      { id: 1, url: 'https://example.com?page=1' },
      { id: 2, url: 'https://example.com?page=2' }
    ];
    expect(findDuplicates(tabs, 'exact')).toEqual([]);
  });

  it('treats URLs with different query params as duplicates in ignoreQuery mode', () => {
    const tabs = [
      { id: 1, url: 'https://example.com?page=1' },
      { id: 2, url: 'https://example.com?page=2' }
    ];
    const duplicates = findDuplicates(tabs, 'ignoreQuery');
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].id).toBe(2);
  });

  it('treats URLs with different hashes as different in exact mode', () => {
    const tabs = [
      { id: 1, url: 'https://example.com#section1' },
      { id: 2, url: 'https://example.com#section2' }
    ];
    expect(findDuplicates(tabs, 'exact')).toEqual([]);
  });

  it('treats URLs with different hashes as duplicates in ignoreHash mode', () => {
    const tabs = [
      { id: 1, url: 'https://example.com#section1' },
      { id: 2, url: 'https://example.com#section2' }
    ];
    const duplicates = findDuplicates(tabs, 'ignoreHash');
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].id).toBe(2);
  });

  it('treats URLs with different query and hash as duplicates in ignoreQueryAndHash mode', () => {
    const tabs = [
      { id: 1, url: 'https://example.com?a=1#s1' },
      { id: 2, url: 'https://example.com?b=2#s2' }
    ];
    const duplicates = findDuplicates(tabs, 'ignoreQueryAndHash');
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].id).toBe(2);
  });
});

describe('countDuplicatesByUrl with matchMode', () => {
  it('counts using normalized URLs in ignoreQuery mode', () => {
    const tabs = [
      { url: 'https://example.com?page=1' },
      { url: 'https://example.com?page=2' },
      { url: 'https://other.com' }
    ];
    const result = countDuplicatesByUrl(tabs, 'ignoreQuery');
    expect(result.get('https://example.com/')).toBe(2);
    expect(result.get('https://other.com/')).toBe(1);
  });

  it('counts using normalized URLs in ignoreHash mode', () => {
    const tabs = [
      { url: 'https://example.com#s1' },
      { url: 'https://example.com#s2' },
      { url: 'https://example.com#s3' }
    ];
    const result = countDuplicatesByUrl(tabs, 'ignoreHash');
    expect(result.get('https://example.com/')).toBe(3);
  });
});

// =============================================================================
// Fuzzy Search Tests
// =============================================================================

describe('fuzzyMatch', () => {
  it('returns null for empty pattern', () => {
    expect(fuzzyMatch('', 'hello')).toBeNull();
  });

  it('returns null for empty text', () => {
    expect(fuzzyMatch('hello', '')).toBeNull();
  });

  it('returns null for null inputs', () => {
    expect(fuzzyMatch(null, 'hello')).toBeNull();
    expect(fuzzyMatch('hello', null)).toBeNull();
  });

  it('returns null when pattern is longer than text', () => {
    expect(fuzzyMatch('hello world', 'hello')).toBeNull();
  });

  it('matches exact substring at start', () => {
    const result = fuzzyMatch('hello', 'hello world');
    expect(result).not.toBeNull();
    expect(result.indices).toEqual([0, 1, 2, 3, 4]);
  });

  it('matches non-consecutive characters', () => {
    const result = fuzzyMatch('hlo', 'hello');
    expect(result).not.toBeNull();
    expect(result.indices).toEqual([0, 2, 4]);
  });

  it('is case insensitive', () => {
    const result = fuzzyMatch('HELLO', 'hello world');
    expect(result).not.toBeNull();
    expect(result.indices).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns null when pattern cannot be matched', () => {
    expect(fuzzyMatch('xyz', 'hello')).toBeNull();
  });

  it('returns null when pattern order cannot be satisfied', () => {
    expect(fuzzyMatch('ba', 'ab')).toBeNull();
  });

  it('scores consecutive matches higher than non-consecutive', () => {
    const consecutive = fuzzyMatch('abc', 'abcdef');
    const nonConsecutive = fuzzyMatch('abc', 'axbxcx');
    expect(consecutive.score).toBeGreaterThan(nonConsecutive.score);
  });

  it('scores word boundary matches higher', () => {
    const boundary = fuzzyMatch('fb', 'foo-bar');
    const nonBoundary = fuzzyMatch('fb', 'foobar');
    expect(boundary.score).toBeGreaterThan(nonBoundary.score);
  });

  it('scores start of string matches highest', () => {
    const atStart = fuzzyMatch('h', 'hello');
    const notAtStart = fuzzyMatch('e', 'hello');
    expect(atStart.score).toBeGreaterThan(notAtStart.score);
  });

  it('gives bonus for exact case match', () => {
    const exactCase = fuzzyMatch('Hello', 'Hello');
    const differentCase = fuzzyMatch('hello', 'Hello');
    expect(exactCase.score).toBeGreaterThan(differentCase.score);
  });

  it('handles word boundaries with various separators', () => {
    expect(fuzzyMatch('fb', 'foo bar')).not.toBeNull(); // space
    expect(fuzzyMatch('fb', 'foo/bar')).not.toBeNull(); // slash
    expect(fuzzyMatch('fb', 'foo-bar')).not.toBeNull(); // dash
    expect(fuzzyMatch('fb', 'foo_bar')).not.toBeNull(); // underscore
    expect(fuzzyMatch('fb', 'foo.bar')).not.toBeNull(); // dot
  });

  it('penalizes gaps between matches', () => {
    const small_gap = fuzzyMatch('ac', 'abc');
    const large_gap = fuzzyMatch('ac', 'axxxxc');
    expect(small_gap.score).toBeGreaterThan(large_gap.score);
  });

  it('strongly prefers word matches over scattered matches', () => {
    // "git" should match "GitHub" much better than "magazine times"
    const wordMatch = fuzzyMatch('git', 'GitHub');
    const scatteredMatch = fuzzyMatch('git', 'magazine times');
    expect(wordMatch).not.toBeNull();
    expect(scatteredMatch).not.toBeNull();
    // Word match should score at least 2x higher
    expect(wordMatch.score).toBeGreaterThan(scatteredMatch.score * 2);
  });

  it('gives bonus for full word match at start', () => {
    // "tab" as full word at start vs mid-text
    const fullWord = fuzzyMatch('go', 'go lang');
    const partOfWord = fuzzyMatch('go', 'google');
    expect(fullWord).not.toBeNull();
    expect(partOfWord).not.toBeNull();
    expect(fullWord.score).toBeGreaterThan(partOfWord.score);
  });

  it('penalizes mid-word match starts', () => {
    // Match at word boundary vs match starting mid-word
    const wordStart = fuzzyMatch('hub', 'Hub site');
    const midWord = fuzzyMatch('hub', 'rehub');
    expect(wordStart).not.toBeNull();
    expect(midWord).not.toBeNull();
    expect(wordStart.score).toBeGreaterThan(midWord.score);
  });
});

describe('fuzzySearchTab', () => {
  it('returns null for empty pattern', () => {
    const tab = { title: 'Hello', url: 'https://example.com' };
    expect(fuzzySearchTab('', tab)).toBeNull();
  });

  it('returns null for null tab', () => {
    expect(fuzzySearchTab('hello', null)).toBeNull();
  });

  it('searches title field', () => {
    const tab = { title: 'GitHub Repository', url: 'https://example.com' };
    const result = fuzzySearchTab('git', tab);
    expect(result).not.toBeNull();
    expect(result.matches).toHaveProperty('title');
  });

  it('searches URL field', () => {
    const tab = { title: 'Example', url: 'https://github.com/user/repo' };
    const result = fuzzySearchTab('github', tab);
    expect(result).not.toBeNull();
    expect(result.matches).toHaveProperty('url');
  });

  it('searches domain field', () => {
    const tab = { title: 'Example', url: 'https://github.com/user/repo' };
    const result = fuzzySearchTab('github', tab);
    expect(result).not.toBeNull();
    expect(result.matches).toHaveProperty('domain');
  });

  it('searches across all fields simultaneously', () => {
    const tab = {
      title: 'GitHub - My Repository',
      url: 'https://github.com/user/repo'
    };
    const result = fuzzySearchTab('git', tab);
    expect(result).not.toBeNull();
    expect(result.matches).toHaveProperty('title');
    expect(result.matches).toHaveProperty('url');
    expect(result.matches).toHaveProperty('domain');
  });

  it('returns null for no matches across any field', () => {
    const tab = { title: 'Hello World', url: 'https://example.com' };
    expect(fuzzySearchTab('xyz123', tab)).toBeNull();
  });

  it('returns best score from all matching fields', () => {
    const tab = {
      title: 'git',  // exact match should score higher
      url: 'https://github.com/user/repo'
    };
    const result = fuzzySearchTab('git', tab);
    expect(result).not.toBeNull();
    // The title match should give the best score (start of string + consecutive)
    expect(result.score).toBe(result.matches.title.score);
  });

  it('handles tabs with missing title', () => {
    const tab = { url: 'https://github.com' };
    const result = fuzzySearchTab('git', tab);
    expect(result).not.toBeNull();
    expect(result.matches).not.toHaveProperty('title');
    expect(result.matches).toHaveProperty('url');
  });

  it('handles tabs with invalid URL for domain extraction', () => {
    const tab = { title: 'Test', url: 'not-a-valid-url' };
    const result = fuzzySearchTab('test', tab);
    expect(result).not.toBeNull();
    expect(result.matches).toHaveProperty('title');
    expect(result.matches).not.toHaveProperty('domain');
  });
});

describe('exactWordMatch', () => {
  it('returns null for empty pattern or text', () => {
    expect(exactWordMatch('', 'hello')).toBeNull();
    expect(exactWordMatch('hello', '')).toBeNull();
  });

  it('matches a standalone word', () => {
    const result = exactWordMatch('burger', 'tasty burger here');
    expect(result).not.toBeNull();
    expect(result.indices).toEqual([6, 7, 8, 9, 10, 11]);
  });

  it('matches the whole word case-insensitively', () => {
    const result = exactWordMatch('burger', 'Best BURGER ever');
    expect(result).not.toBeNull();
    expect(result.indices).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it('matches a word at start of string', () => {
    const result = exactWordMatch('burger', 'burger time');
    expect(result.indices).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('matches a word at end of string', () => {
    const result = exactWordMatch('burger', 'i want burger');
    expect(result.indices).toEqual([7, 8, 9, 10, 11, 12]);
  });

  it('matches a word delimited by URL separators', () => {
    const result = exactWordMatch('burger', 'https://shop.com/burger/menu');
    expect(result).not.toBeNull();
  });

  it('does not match a subset of a longer word', () => {
    expect(exactWordMatch('burger', 'hamburger')).toBeNull();
    expect(exactWordMatch('burger', 'burgers')).toBeNull();
    expect(exactWordMatch('bu', 'burger')).toBeNull();
  });

  it('does not match a split pattern', () => {
    expect(exactWordMatch('burger', 'bu rger')).toBeNull();
  });

  it('highlights all whole-word occurrences', () => {
    const result = exactWordMatch('burger', 'burger and burger');
    expect(result.indices).toEqual([0, 1, 2, 3, 4, 5, 11, 12, 13, 14, 15, 16]);
  });

  it('returns null when pattern longer than text', () => {
    expect(exactWordMatch('burger', 'bun')).toBeNull();
  });
});

describe('parseSearchQuery', () => {
  it('detects exact mode for quoted query', () => {
    expect(parseSearchQuery('"burger"')).toEqual({ term: 'burger', exact: true, wildcard: false });
  });

  it('treats unquoted query as fuzzy', () => {
    expect(parseSearchQuery('burger')).toEqual({ term: 'burger', exact: false, wildcard: false });
  });

  it('trims whitespace around and inside quotes', () => {
    expect(parseSearchQuery('  "  burger  "  ')).toEqual({ term: 'burger', exact: true, wildcard: false });
  });

  it('handles empty quoted query', () => {
    expect(parseSearchQuery('""')).toEqual({ term: '', exact: true, wildcard: false });
  });

  it('handles non-string input', () => {
    expect(parseSearchQuery(null)).toEqual({ term: '', exact: false, wildcard: false });
    expect(parseSearchQuery(undefined)).toEqual({ term: '', exact: false, wildcard: false });
  });

  it('does not treat a lone quote as exact mode', () => {
    expect(parseSearchQuery('"')).toEqual({ term: '"', exact: false, wildcard: false });
  });

  // --- wildcard mode ---

  it('detects wildcard mode for a trailing asterisk', () => {
    expect(parseSearchQuery('insta*')).toEqual({ term: 'insta', exact: false, wildcard: true });
  });

  it('detects wildcard mode for a leading asterisk', () => {
    expect(parseSearchQuery('*insta')).toEqual({ term: 'insta', exact: false, wildcard: true });
  });

  it('treats leading and trailing asterisks identically (position-independent)', () => {
    expect(parseSearchQuery('*insta*')).toEqual({ term: 'insta', exact: false, wildcard: true });
  });

  it('strips all leading and trailing asterisks', () => {
    expect(parseSearchQuery('**insta**')).toEqual({ term: 'insta', exact: false, wildcard: true });
  });

  it('keeps an internal asterisk as a literal character', () => {
    expect(parseSearchQuery('git*hub')).toEqual({ term: 'git*hub', exact: false, wildcard: true });
  });

  it('reduces a lone asterisk to an empty core', () => {
    expect(parseSearchQuery('*')).toEqual({ term: '', exact: false, wildcard: true });
  });

  it('reduces multiple asterisks to an empty core', () => {
    expect(parseSearchQuery('**')).toEqual({ term: '', exact: false, wildcard: true });
  });

  it('trims whitespace around the stripped core', () => {
    expect(parseSearchQuery('  insta *  ')).toEqual({ term: 'insta', exact: false, wildcard: true });
  });

  it('lets quotes win over an asterisk (literal star, exact mode)', () => {
    expect(parseSearchQuery('"insta*"')).toEqual({ term: 'insta*', exact: true, wildcard: false });
  });
});

describe('substringMatch', () => {
  it('returns null for empty pattern or text', () => {
    expect(substringMatch('', 'hello')).toBeNull();
    expect(substringMatch('hello', '')).toBeNull();
  });

  it('returns null for null inputs', () => {
    expect(substringMatch(null, 'hello')).toBeNull();
    expect(substringMatch('hello', null)).toBeNull();
  });

  it('returns null when pattern is longer than text', () => {
    expect(substringMatch('burger', 'bun')).toBeNull();
  });

  it('returns null when the substring is not present', () => {
    expect(substringMatch('xyz', 'hello')).toBeNull();
  });

  it('matches a contiguous substring at the start', () => {
    const result = substringMatch('insta', 'instagram');
    expect(result).not.toBeNull();
    expect(result.indices).toEqual([0, 1, 2, 3, 4]);
  });

  it('matches a contiguous substring mid-word (no boundary required)', () => {
    const result = substringMatch('insta', 'businstall');
    expect(result).not.toBeNull();
    expect(result.indices).toEqual([3, 4, 5, 6, 7]);
  });

  it('matches mid-word for a "suffix-style" query (position-independent)', () => {
    // 'gram' appears inside 'programmer' (proGRAMmer)
    const result = substringMatch('gram', 'programmer');
    expect(result).not.toBeNull();
    expect(result.indices).toEqual([3, 4, 5, 6]);
  });

  it('is case-insensitive', () => {
    const result = substringMatch('INSTA', 'My Instagram');
    expect(result).not.toBeNull();
    expect(result.indices).toEqual([3, 4, 5, 6, 7]);
  });

  it('highlights all occurrences', () => {
    const result = substringMatch('ab', 'abxab');
    expect(result).not.toBeNull();
    expect(result.indices).toEqual([0, 1, 3, 4]);
  });

  it('does not require a whole-word match (unlike exactWordMatch)', () => {
    expect(substringMatch('burger', 'hamburger')).not.toBeNull();
    expect(exactWordMatch('burger', 'hamburger')).toBeNull();
  });

  it('treats an internal asterisk as a literal character to match', () => {
    expect(substringMatch('git*hub', 'github')).toBeNull();
    expect(substringMatch('git*hub', 'see git*hub docs')).not.toBeNull();
  });

  it('scores a start match higher than a mid-word match', () => {
    const atStart = substringMatch('insta', 'instagram');
    const midWord = substringMatch('insta', 'businstall');
    expect(atStart.score).toBeGreaterThan(midWord.score);
  });

  it('scores a word-boundary match higher than a mid-word match', () => {
    const atBoundary = substringMatch('gram', 'tele gram');
    const midWord = substringMatch('gram', 'programmer');
    expect(atBoundary.score).toBeGreaterThan(midWord.score);
  });

  it('scores more occurrences higher than fewer', () => {
    const twice = substringMatch('ab', 'abab');
    const once = substringMatch('ab', 'abxx');
    expect(twice.score).toBeGreaterThan(once.score);
  });
});

describe('searchTab', () => {
  it('returns null for empty query', () => {
    expect(searchTab('', { title: 'Hello' })).toBeNull();
    expect(searchTab('""', { title: 'Hello' })).toBeNull();
  });

  it('returns null for null tab', () => {
    expect(searchTab('hello', null)).toBeNull();
  });

  it('uses fuzzy matching for unquoted query', () => {
    const tab = { title: 'GitHub Repository', url: 'https://example.com' };
    const result = searchTab('gthb', tab);
    expect(result).not.toBeNull();
    expect(result.matches).toHaveProperty('title');
  });

  it('uses exact whole-word matching for quoted query', () => {
    const tab = { title: 'tasty burger spot', url: 'https://example.com' };
    const result = searchTab('"burger"', tab);
    expect(result).not.toBeNull();
    expect(result.matches.title.indices).toEqual([6, 7, 8, 9, 10, 11]);
  });

  it('exact mode rejects subset matches that fuzzy would accept', () => {
    const tab = { title: 'hamburger menu', url: 'https://example.com' };
    expect(searchTab('"burger"', tab)).toBeNull();
    // but fuzzy still finds it
    expect(searchTab('burger', tab)).not.toBeNull();
  });

  it('exact mode matches across url and domain', () => {
    const tab = { title: 'Food', url: 'https://burger.com/menu' };
    const result = searchTab('"burger"', tab);
    expect(result).not.toBeNull();
    expect(result.matches).toHaveProperty('domain');
  });

  it('uses substring matching for a wildcard query', () => {
    const tab = { title: 'My Instagram Feed', url: 'https://example.com' };
    const result = searchTab('insta*', tab);
    expect(result).not.toBeNull();
    expect(result.matches.title.indices).toEqual([3, 4, 5, 6, 7]);
  });

  it('wildcard mode matches a substring that exact mode rejects', () => {
    const tab = { title: 'hamburger menu', url: 'https://example.com' };
    expect(searchTab('burger*', tab)).not.toBeNull();
    expect(searchTab('"burger"', tab)).toBeNull();
  });

  it('wildcard mode rejects scattered matches that fuzzy accepts', () => {
    const tab = { title: 'GitHub Repository', url: 'https://example.com' };
    expect(searchTab('gthb', tab)).not.toBeNull();   // fuzzy matches scattered g-t-h-b
    expect(searchTab('gthb*', tab)).toBeNull();        // wildcard needs contiguous "gthb"
  });

  it('wildcard mode is position-independent', () => {
    const tab = { title: 'telegram', url: 'https://example.com' };
    expect(searchTab('*gram', tab)).not.toBeNull();
    expect(searchTab('gram*', tab)).not.toBeNull();
    expect(searchTab('*gram*', tab)).not.toBeNull();
  });

  it('wildcard mode matches across url and domain', () => {
    const tab = { title: 'Food', url: 'https://burger.com/menu' };
    const result = searchTab('burg*', tab);
    expect(result).not.toBeNull();
    expect(result.matches).toHaveProperty('domain');
  });

  it('returns null for a lone asterisk (empty core)', () => {
    expect(searchTab('*', { title: 'anything' })).toBeNull();
  });
});

describe('highlightMatches', () => {
  it('returns escaped text for empty indices', () => {
    expect(highlightMatches('hello', [])).toBe('hello');
  });

  it('returns escaped text for null indices', () => {
    expect(highlightMatches('hello', null)).toBe('hello');
  });

  it('returns empty string for null text', () => {
    expect(highlightMatches(null, [0])).toBe('');
  });

  it('returns empty string for empty text', () => {
    expect(highlightMatches('', [0])).toBe('');
  });

  it('wraps single matched character in span', () => {
    const result = highlightMatches('hello', [0]);
    expect(result).toBe('<span class="fuzzy-match">h</span>ello');
  });

  it('wraps multiple non-consecutive matches in separate spans', () => {
    const result = highlightMatches('hello', [0, 2, 4]);
    expect(result).toBe('<span class="fuzzy-match">h</span>e<span class="fuzzy-match">l</span>l<span class="fuzzy-match">o</span>');
  });

  it('groups consecutive matches into single span', () => {
    const result = highlightMatches('hello', [0, 1, 2]);
    expect(result).toBe('<span class="fuzzy-match">hel</span>lo');
  });

  it('handles match at end of string', () => {
    const result = highlightMatches('hello', [4]);
    expect(result).toBe('hell<span class="fuzzy-match">o</span>');
  });

  it('handles all characters matched', () => {
    const result = highlightMatches('hi', [0, 1]);
    expect(result).toBe('<span class="fuzzy-match">hi</span>');
  });

  it('escapes HTML special characters in unmatched text', () => {
    const result = highlightMatches('<script>', []);
    expect(result).toBe('&lt;script&gt;');
  });

  it('escapes HTML special characters in matched text', () => {
    const result = highlightMatches('<b>', [0, 1, 2]);
    expect(result).toBe('<span class="fuzzy-match">&lt;b&gt;</span>');
  });

  it('escapes ampersand correctly', () => {
    const result = highlightMatches('a&b', [0]);
    expect(result).toBe('<span class="fuzzy-match">a</span>&amp;b');
  });

  it('escapes quotes correctly', () => {
    const result = highlightMatches('"test\'s"', []);
    expect(result).toBe('&quot;test&#39;s&quot;');
  });

  it('handles mixed consecutive and non-consecutive matches', () => {
    const result = highlightMatches('abcdef', [0, 1, 3, 4]);
    expect(result).toBe('<span class="fuzzy-match">ab</span>c<span class="fuzzy-match">de</span>f');
  });
});

describe('isLoadableFavicon', () => {
  it('returns false for missing URL', () => {
    expect(isLoadableFavicon(undefined)).toBe(false);
    expect(isLoadableFavicon(null)).toBe(false);
    expect(isLoadableFavicon('')).toBe(false);
  });

  it('returns false for chrome:// favicons', () => {
    expect(isLoadableFavicon('chrome://favicon/https://example.com')).toBe(false);
  });

  it('returns true for http(s) favicon URLs', () => {
    expect(isLoadableFavicon('https://example.com/favicon.ico')).toBe(true);
    expect(isLoadableFavicon('http://example.com/favicon.ico')).toBe(true);
  });

  it('returns true for data: favicon URLs', () => {
    expect(isLoadableFavicon('data:image/png;base64,AAAA')).toBe(true);
  });
});
