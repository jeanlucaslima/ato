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
 * Checks if a URL is empty or invalid (tab still loading).
 *
 * @param {string|null|undefined} url - The URL to check
 * @returns {boolean} True if the URL is empty or invalid
 */
function isEmptyUrl(url) {
  return !url;
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
 * Skips tabs with empty URLs (still loading).
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
    if (isEmptyUrl(tab.url)) {
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
 * Excludes tabs with empty URLs.
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
    if (isEmptyUrl(tab.url)) {
      return;
    }

    const url = normalizeUrl(tab.url, matchMode);
    urlCounts.set(url, (urlCounts.get(url) || 0) + 1);
  });

  return urlCounts;
}

/**
 * Groups tabs by their domain and sorts by tab count (descending).
 * Excludes tabs with empty URLs.
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
    if (isEmptyUrl(tab.url)) {
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

// =============================================================================
// Fuzzy Search Utilities
// =============================================================================

/**
 * Escapes HTML special characters to prevent XSS.
 *
 * @param {string} text - The text to escape
 * @returns {string} The escaped text
 */
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return text.replace(/[&<>"']/g, c => map[c]);
}

/**
 * Performs fuzzy matching of a pattern against text.
 * Characters must appear in order but not necessarily consecutively.
 *
 * Scoring:
 * - +1 per matched character
 * - +5 bonus for consecutive matches
 * - +10 bonus for word boundary matches (after space, /, -, _, .)
 * - +15 bonus for start of string match
 * - +1 bonus for exact case match
 * - -1 penalty per gap character between matches
 *
 * @param {string} pattern - The search pattern
 * @param {string} text - The text to search within
 * @returns {{score: number, indices: number[]}|null} Match result or null if no match
 * @example
 * fuzzyMatch('fb', 'foo-bar'); // { score: 23, indices: [0, 4] }
 * fuzzyMatch('xyz', 'hello'); // null
 */
export function fuzzyMatch(pattern, text) {
  if (!pattern || !text) return null;

  const patternLower = pattern.toLowerCase();
  const textLower = text.toLowerCase();
  const patternLen = patternLower.length;
  const textLen = textLower.length;

  if (patternLen > textLen) return null;

  const indices = [];
  let score = 0;
  let patternIdx = 0;
  let prevMatchIdx = -1;

  for (let textIdx = 0; textIdx < textLen && patternIdx < patternLen; textIdx++) {
    if (textLower[textIdx] === patternLower[patternIdx]) {
      indices.push(textIdx);
      score += 1; // Base score per match

      // Consecutive match bonus
      if (prevMatchIdx === textIdx - 1) {
        score += 5;
      }

      // Word boundary bonus
      if (textIdx === 0) {
        score += 15; // Start of string
      } else {
        const prevChar = text[textIdx - 1];
        if (' /-_.'.includes(prevChar)) {
          score += 10; // Word boundary
        }
      }

      // Case match bonus
      if (text[textIdx] === pattern[patternIdx]) {
        score += 1;
      }

      prevMatchIdx = textIdx;
      patternIdx++;
    }
  }

  // Return null if pattern not fully matched
  if (patternIdx !== patternLen) return null;

  // Penalize gaps between matches
  if (indices.length > 1) {
    const totalGap = indices[indices.length - 1] - indices[0] - (indices.length - 1);
    score -= totalGap;
  }

  return { score, indices };
}

/**
 * Searches a tab across title, URL, and domain fields.
 * Returns the best match result or null if no match found.
 *
 * @param {string} pattern - The search pattern
 * @param {Tab} tab - The tab object to search
 * @returns {{score: number, matches: {title?: {score: number, indices: number[]}, url?: {score: number, indices: number[]}, domain?: {score: number, indices: number[]}}}|null}
 * @example
 * fuzzySearchTab('git', { title: 'GitHub', url: 'https://github.com' });
 * // { score: 19, matches: { title: {...}, url: {...}, domain: {...} } }
 */
export function fuzzySearchTab(pattern, tab) {
  if (!pattern || !tab) return null;

  const matches = {};
  let bestScore = 0;

  // Search title
  if (tab.title) {
    const titleMatch = fuzzyMatch(pattern, tab.title);
    if (titleMatch) {
      matches.title = titleMatch;
      bestScore = Math.max(bestScore, titleMatch.score);
    }
  }

  // Search URL
  if (tab.url) {
    const urlMatch = fuzzyMatch(pattern, tab.url);
    if (urlMatch) {
      matches.url = urlMatch;
      bestScore = Math.max(bestScore, urlMatch.score);
    }
  }

  // Search domain
  const domain = extractDomain(tab.url);
  if (domain) {
    const domainMatch = fuzzyMatch(pattern, domain);
    if (domainMatch) {
      matches.domain = domainMatch;
      bestScore = Math.max(bestScore, domainMatch.score);
    }
  }

  if (Object.keys(matches).length === 0) return null;

  return { score: bestScore, matches };
}

/**
 * Highlights matched characters in text by wrapping them in span elements.
 * Consecutive matches are grouped into a single span for cleaner output.
 *
 * @param {string} text - The original text
 * @param {number[]} indices - Array of character indices to highlight
 * @returns {string} HTML string with <span class="fuzzy-match"> wrappers
 * @example
 * highlightMatches('hello', [0, 2, 4]);
 * // '<span class="fuzzy-match">h</span>e<span class="fuzzy-match">l</span>l<span class="fuzzy-match">o</span>'
 *
 * highlightMatches('hello', [0, 1, 2]);
 * // '<span class="fuzzy-match">hel</span>lo'
 */
export function highlightMatches(text, indices) {
  if (!text || !indices || indices.length === 0) {
    return escapeHtml(text || '');
  }

  const indexSet = new Set(indices);
  let result = '';
  let inHighlight = false;

  for (let i = 0; i < text.length; i++) {
    const shouldHighlight = indexSet.has(i);

    if (shouldHighlight && !inHighlight) {
      result += '<span class="fuzzy-match">';
      inHighlight = true;
    } else if (!shouldHighlight && inHighlight) {
      result += '</span>';
      inHighlight = false;
    }

    result += escapeHtml(text[i]);
  }

  if (inHighlight) {
    result += '</span>';
  }

  return result;
}
