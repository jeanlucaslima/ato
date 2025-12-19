import { describe, it, expect } from 'vitest';
import {
  findDuplicates,
  extractDomain,
  countDuplicatesByUrl,
  groupTabsByDomain,
  formatTimeAgo,
  sortTabs
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

  it('skips chrome:// internal pages', () => {
    const tabs = [
      { id: 1, url: 'chrome://extensions' },
      { id: 2, url: 'chrome://extensions' }
    ];
    expect(findDuplicates(tabs)).toEqual([]);
  });

  it('skips edge:// internal pages', () => {
    const tabs = [
      { id: 1, url: 'edge://settings' },
      { id: 2, url: 'edge://settings' }
    ];
    expect(findDuplicates(tabs)).toEqual([]);
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

  it('skips chrome:// URLs', () => {
    const tabs = [{ url: 'chrome://extensions' }];
    const result = countDuplicatesByUrl(tabs);
    expect(result.size).toBe(0);
  });

  it('skips edge:// URLs', () => {
    const tabs = [{ url: 'edge://settings' }];
    const result = countDuplicatesByUrl(tabs);
    expect(result.size).toBe(0);
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

  it('skips chrome:// pages', () => {
    const tabs = [
      { url: 'chrome://extensions' },
      { url: 'https://example.com' }
    ];
    const groups = groupTabsByDomain(tabs);
    expect(groups).toHaveLength(1);
    expect(groups[0].domain).toBe('example.com');
  });

  it('skips edge:// pages', () => {
    const tabs = [
      { url: 'edge://settings' },
      { url: 'https://example.com' }
    ];
    const groups = groupTabsByDomain(tabs);
    expect(groups).toHaveLength(1);
    expect(groups[0].domain).toBe('example.com');
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
