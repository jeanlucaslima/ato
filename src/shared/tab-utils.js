// ATO Shared Tab Utilities
// Pure functions for tab management, shared between popup and service worker

/**
 * @typedef {Object} Tab
 * @property {number} id - The unique tab identifier
 * @property {string} [url] - The URL of the tab
 * @property {string} [title] - The title of the tab
 * @property {string} [favIconUrl] - The favicon URL
 * @property {number} [lastAccessed] - Timestamp of last access
 * @property {number} [windowId] - The window containing this tab
 */

/**
 * @typedef {Object} DomainGroup
 * @property {string} domain - The domain name
 * @property {Tab[]} tabs - Tabs belonging to this domain
 * @property {number} count - Number of tabs in this domain
 */

/**
 * Checks if a URL is an internal browser page that should be skipped.
 *
 * @param {string|null|undefined} url - The URL to check
 * @returns {boolean} True if the URL is internal or invalid
 */
function isInternalUrl(url) {
  return !url || url.startsWith('chrome://') || url.startsWith('edge://');
}

/**
 * Normalizes a URL based on the match mode setting.
 *
 * @param {string} url - The URL to normalize
 * @param {'exact'|'ignoreQuery'|'ignoreHash'|'ignoreQueryAndHash'} matchMode - How to normalize
 * @returns {string} The normalized URL
 * @example
 * normalizeUrl('https://example.com/page?foo=bar#section', 'ignoreQuery');
 * // Returns 'https://example.com/page#section'
 */
export function normalizeUrl(url, matchMode = 'exact') {
  if (!url || matchMode === 'exact') {
    return url;
  }

  try {
    const urlObj = new URL(url);

    if (matchMode === 'ignoreQuery' || matchMode === 'ignoreQueryAndHash') {
      urlObj.search = '';
    }

    if (matchMode === 'ignoreHash' || matchMode === 'ignoreQueryAndHash') {
      urlObj.hash = '';
    }

    return urlObj.toString();
  } catch (e) {
    return url;
  }
}

/**
 * Finds duplicate tabs based on URL matching.
 * The first occurrence of a URL is considered the "original",
 * subsequent occurrences are returned as duplicates.
 * Skips chrome:// and edge:// internal pages.
 *
 * @param {Tab[]} tabs - Array of tab objects to search
 * @param {'exact'|'ignoreQuery'|'ignoreHash'|'ignoreQueryAndHash'} [matchMode='exact'] - URL matching mode
 * @returns {Tab[]} Array of duplicate tabs (excludes first occurrence of each URL)
 * @example
 * const tabs = [
 *   { id: 1, url: 'https://example.com' },
 *   { id: 2, url: 'https://example.com' },
 *   { id: 3, url: 'https://other.com' }
 * ];
 * findDuplicates(tabs); // Returns [{ id: 2, url: 'https://example.com' }]
 */
export function findDuplicates(tabs, matchMode = 'exact') {
  const urlMap = new Map();
  const duplicates = [];

  tabs.forEach(tab => {
    if (isInternalUrl(tab.url)) {
      return;
    }

    const url = normalizeUrl(tab.url, matchMode);

    if (urlMap.has(url)) {
      duplicates.push(tab);
    } else {
      urlMap.set(url, tab);
    }
  });

  return duplicates;
}

/**
 * Extracts the hostname from a URL string.
 *
 * @param {string} url - The URL to extract domain from
 * @returns {string|null} The hostname, or null if URL is invalid
 * @example
 * extractDomain('https://www.example.com/path'); // Returns 'www.example.com'
 * extractDomain('not-a-url'); // Returns null
 */
export function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return null;
  }
}

/**
 * Counts how many tabs share each URL.
 * Excludes chrome:// and edge:// internal pages.
 *
 * @param {Tab[]} tabs - Array of tab objects
 * @param {'exact'|'ignoreQuery'|'ignoreHash'|'ignoreQueryAndHash'} [matchMode='exact'] - URL matching mode
 * @returns {Map<string, number>} Map of normalized URL to occurrence count
 * @example
 * const tabs = [
 *   { url: 'https://a.com' },
 *   { url: 'https://a.com' },
 *   { url: 'https://b.com' }
 * ];
 * countDuplicatesByUrl(tabs); // Returns Map { 'https://a.com' => 2, 'https://b.com' => 1 }
 */
export function countDuplicatesByUrl(tabs, matchMode = 'exact') {
  const urlCounts = new Map();

  tabs.forEach(tab => {
    if (isInternalUrl(tab.url)) {
      return;
    }

    const url = normalizeUrl(tab.url, matchMode);
    urlCounts.set(url, (urlCounts.get(url) || 0) + 1);
  });

  return urlCounts;
}

/**
 * Groups tabs by their domain and sorts by tab count (descending).
 * Excludes chrome:// and edge:// internal pages.
 *
 * @param {Tab[]} tabs - Array of tab objects
 * @returns {DomainGroup[]} Array of domain groups sorted by count (descending)
 * @example
 * const tabs = [
 *   { url: 'https://a.com/1' },
 *   { url: 'https://a.com/2' },
 *   { url: 'https://b.com' }
 * ];
 * groupTabsByDomain(tabs);
 * // Returns [{ domain: 'a.com', tabs: [...], count: 2 }, { domain: 'b.com', tabs: [...], count: 1 }]
 */
export function groupTabsByDomain(tabs) {
  const domainGroups = new Map();

  tabs.forEach(tab => {
    if (isInternalUrl(tab.url)) {
      return;
    }

    const domain = extractDomain(tab.url);
    if (!domain) return;

    if (!domainGroups.has(domain)) {
      domainGroups.set(domain, []);
    }
    domainGroups.get(domain).push(tab);
  });

  return Array.from(domainGroups.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([domain, tabs]) => ({ domain, tabs, count: tabs.length }));
}

/**
 * Formats a timestamp as a human-readable relative time.
 *
 * @param {number|null|undefined} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted string like "2m", "3h", "5d", or "now"
 * @example
 * formatTimeAgo(Date.now() - 120000); // Returns "2m"
 * formatTimeAgo(Date.now() - 7200000); // Returns "2h"
 * formatTimeAgo(null); // Returns "—"
 */
export function formatTimeAgo(timestamp) {
  if (!timestamp) return '—';

  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return 'now';
}

/**
 * Sorts tabs based on the specified sort option.
 * Does not mutate the original array.
 *
 * @param {Tab[]} tabs - Array of tabs to sort
 * @param {'default'|'title'|'title-desc'|'domain'|'age'|'duplicates'} sortBy - Sort option
 * @param {Map<string, number>} urlCounts - Map of URL to duplicate count (for 'duplicates' sort)
 * @param {'old'|'new'} [ageSortDirection='old'] - Direction for age sort ('old' = oldest first)
 * @returns {Tab[]} New sorted array
 * @example
 * const tabs = [{ title: 'Zebra' }, { title: 'Apple' }];
 * sortTabs(tabs, 'title', new Map()); // Returns [{ title: 'Apple' }, { title: 'Zebra' }]
 */
export function sortTabs(tabs, sortBy, urlCounts, ageSortDirection = 'old') {
  const sorted = [...tabs];

  switch (sortBy) {
    case 'title':
      return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    case 'title-desc':
      return sorted.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    case 'domain':
      return sorted.sort((a, b) => {
        const domainA = extractDomain(a.url) || '';
        const domainB = extractDomain(b.url) || '';
        return domainA.localeCompare(domainB);
      });
    case 'age':
      return sorted.sort((a, b) => {
        const ageA = a.lastAccessed || 0;
        const ageB = b.lastAccessed || 0;
        return ageSortDirection === 'old' ? ageA - ageB : ageB - ageA;
      });
    case 'duplicates':
      return sorted.sort((a, b) => {
        const countA = urlCounts.get(a.url) || 0;
        const countB = urlCounts.get(b.url) || 0;
        return countB - countA;
      });
    default:
      return sorted;
  }
}
