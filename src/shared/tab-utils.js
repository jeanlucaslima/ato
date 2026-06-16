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

/**
 * Reorders tabs so that tabs playing media (`audible === true`) come first.
 * The sort is stable: the relative order of tabs within the audible group and
 * within the non-audible group is preserved, so this can be layered on top of
 * any existing ordering without scrambling it.
 *
 * @param {Tab[]} tabs - Array of tabs to reorder
 * @returns {Tab[]} New array with audible tabs floated to the top
 * @example
 * sortAudibleFirst([{ id: 1 }, { id: 2, audible: true }, { id: 3 }]);
 * // Returns [{ id: 2, audible: true }, { id: 1 }, { id: 3 }]
 */
export function sortAudibleFirst(tabs) {
  return [...tabs].sort((a, b) => (b.audible ? 1 : 0) - (a.audible ? 1 : 0));
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
 * Checks if a character is a word boundary separator.
 *
 * @param {string} char - The character to check
 * @returns {boolean} True if the character is a word separator
 */
function isWordBoundary(char) {
  return ' /-_.:@#?&='.includes(char);
}

/**
 * Performs fuzzy matching of a pattern against text.
 * Characters must appear in order but not necessarily consecutively.
 * Prioritizes word matches over scattered letter matches.
 *
 * Scoring:
 * - +1 per matched character (base)
 * - +5 bonus for consecutive matches
 * - +10 bonus for word boundary matches (after space, /, -, _, ., etc.)
 * - +15 bonus for start of string match
 * - +8 bonus for word prefix match (consecutive chars at word start)
 * - +1 bonus for exact case match
 * - -2 penalty per gap character between matches (stronger penalty)
 * - -3 penalty for match starting mid-word (not at boundary)
 *
 * @param {string} pattern - The search pattern
 * @param {string} text - The text to search within
 * @returns {{score: number, indices: number[]}|null} Match result or null if no match
 * @example
 * fuzzyMatch('git', 'GitHub'); // High score (word prefix)
 * fuzzyMatch('git', 'magazine times'); // Low score (scattered)
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
  let consecutiveAtWordStart = 0;
  let matchStartedAtBoundary = false;

  for (let textIdx = 0; textIdx < textLen && patternIdx < patternLen; textIdx++) {
    if (textLower[textIdx] === patternLower[patternIdx]) {
      indices.push(textIdx);
      score += 1; // Base score per match

      const isAtStart = textIdx === 0;
      const isAtWordBoundary = isAtStart || isWordBoundary(text[textIdx - 1]);
      const isFirstMatch = patternIdx === 0;
      // Consecutive only if not first match and follows previous
      const isConsecutive = !isFirstMatch && prevMatchIdx === textIdx - 1;

      // Track if this is the first match
      if (isFirstMatch) {
        matchStartedAtBoundary = isAtWordBoundary;
        consecutiveAtWordStart = 0;
      }

      // Consecutive match bonus
      if (isConsecutive) {
        score += 5;
        // Track consecutive matches at word start for prefix bonus
        if (matchStartedAtBoundary) {
          consecutiveAtWordStart++;
        }
      } else if (!isFirstMatch) {
        // Gap in matches (not first match) - reset consecutive counter
        consecutiveAtWordStart = 0;
        matchStartedAtBoundary = isAtWordBoundary;
      }

      // Word boundary bonus
      if (isAtStart) {
        score += 15; // Start of string
      } else if (isAtWordBoundary) {
        score += 10; // Word boundary
      } else if (isFirstMatch) {
        // First match is mid-word - penalty
        score -= 3;
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

  // Bonus for word prefix match (all chars consecutive at word boundary)
  if (consecutiveAtWordStart === patternLen - 1 && matchStartedAtBoundary) {
    score += 8; // Word prefix bonus

    // Extra bonus if it matches end of a word too (full word match)
    const lastMatchIdx = indices[indices.length - 1];
    const nextCharIdx = lastMatchIdx + 1;
    if (nextCharIdx >= textLen || isWordBoundary(text[nextCharIdx])) {
      score += 12; // Full word match bonus
    }
  }

  // Penalize gaps between matches (stronger penalty)
  if (indices.length > 1) {
    const totalGap = indices[indices.length - 1] - indices[0] - (indices.length - 1);
    score -= totalGap * 2; // Double penalty for gaps
  }

  return { score, indices };
}

/**
 * Performs an exact whole-word match of a pattern against text.
 * Unlike fuzzyMatch, the pattern must appear as a complete word (or phrase),
 * delimited by word boundaries (start/end of string or a separator character).
 * Matching is case-insensitive. All whole-word occurrences are highlighted.
 *
 * "burger" matches "tasty burger here" and "shop/burger" but NOT "burgers",
 * "hamburger", or scattered subsets like "bu rger".
 *
 * @param {string} pattern - The exact word (or phrase) to match
 * @param {string} text - The text to search within
 * @returns {{score: number, indices: number[]}|null} Match result or null if no whole-word match
 * @example
 * exactWordMatch('burger', 'tasty burger'); // { score: ..., indices: [6,7,8,9,10,11] }
 * exactWordMatch('burger', 'hamburger');     // null (not a whole word)
 */
export function exactWordMatch(pattern, text) {
  if (!pattern || !text) return null;

  const patternLower = pattern.toLowerCase();
  const textLower = text.toLowerCase();
  const patternLen = patternLower.length;
  const textLen = textLower.length;

  if (patternLen === 0 || patternLen > textLen) return null;

  const indices = [];
  let occurrences = 0;
  let searchFrom = 0;

  while (searchFrom <= textLen - patternLen) {
    const idx = textLower.indexOf(patternLower, searchFrom);
    if (idx === -1) break;

    const endIdx = idx + patternLen;
    const boundaryBefore = idx === 0 || isWordBoundary(text[idx - 1]);
    const boundaryAfter = endIdx >= textLen || isWordBoundary(text[endIdx]);

    if (boundaryBefore && boundaryAfter) {
      for (let i = idx; i < endIdx; i++) {
        indices.push(i);
      }
      occurrences++;
    }

    searchFrom = idx + 1;
  }

  if (occurrences === 0) return null;

  // High base score so exact matches outrank fuzzy ones, plus a bonus per hit.
  const score = 100 + occurrences * 10;
  return { score, indices };
}

/**
 * Performs a literal substring ("contains") match of a pattern against text.
 * Unlike {@link fuzzyMatch}, the pattern must appear as a contiguous run of
 * characters; unlike {@link exactWordMatch}, it need not be a whole word and
 * may appear anywhere (mid-word included). Matching is case-insensitive and
 * every occurrence is highlighted. This backs wildcard (asterisk) search.
 *
 * Scoring (ranks matches within a wildcard search):
 * - 50 base (sits between fuzzy and exact whole-word matches)
 * - +15 if the best occurrence starts the string
 * - +10 else if the best occurrence starts at a word boundary
 * - +1 per occurrence
 *
 * @param {string} pattern - The literal substring to match
 * @param {string} text - The text to search within
 * @returns {{score: number, indices: number[]}|null} Match result or null if the substring is absent
 * @example
 * substringMatch('insta', 'My Instagram'); // { score: ..., indices: [3,4,5,6,7] }
 * substringMatch('gram', 'programmer');     // matches mid-word (proGRAMmer)
 */
export function substringMatch(pattern, text) {
  if (!pattern || !text) return null;

  const patternLower = pattern.toLowerCase();
  const textLower = text.toLowerCase();
  const patternLen = patternLower.length;
  const textLen = textLower.length;

  if (patternLen > textLen) return null;

  const indices = [];
  let occurrences = 0;
  let positionBonus = 0;
  let searchFrom = 0;

  while (searchFrom <= textLen - patternLen) {
    const idx = textLower.indexOf(patternLower, searchFrom);
    if (idx === -1) break;

    const endIdx = idx + patternLen;
    for (let i = idx; i < endIdx; i++) {
      indices.push(i);
    }
    occurrences++;

    if (idx === 0) {
      positionBonus = Math.max(positionBonus, 15);
    } else if (isWordBoundary(text[idx - 1])) {
      positionBonus = Math.max(positionBonus, 10);
    }

    // Advance past this occurrence so matches never overlap.
    searchFrom = endIdx;
  }

  if (occurrences === 0) return null;

  const score = 50 + positionBonus + occurrences;
  return { score, indices };
}

/**
 * Parses a raw search query, detecting exact whole-word and wildcard modes.
 *
 * - A query wrapped in double quotes (e.g. `"burger"`) requests an exact
 *   whole-word match (quotes win, so any `*` inside is treated literally).
 * - Otherwise, a query containing an asterisk requests a wildcard (literal
 *   substring) match. Leading/trailing asterisks are stripped — their position
 *   does not matter — while an internal `*` is kept as a literal character.
 * - Any other query is treated as a fuzzy search.
 *
 * @param {string} query - The raw search query
 * @returns {{term: string, exact: boolean, wildcard: boolean}} The cleaned term and which mode is requested
 * @example
 * parseSearchQuery('"burger"'); // { term: 'burger', exact: true,  wildcard: false }
 * parseSearchQuery('insta*');   // { term: 'insta',  exact: false, wildcard: true }
 * parseSearchQuery('burger');   // { term: 'burger', exact: false, wildcard: false }
 */
export function parseSearchQuery(query) {
  if (typeof query !== 'string') {
    return { term: '', exact: false, wildcard: false };
  }

  const trimmed = query.trim();

  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return { term: trimmed.slice(1, -1).trim(), exact: true, wildcard: false };
  }

  if (trimmed.includes('*')) {
    const term = trimmed.replace(/^\*+/, '').replace(/\*+$/, '').trim();
    return { term, exact: false, wildcard: true };
  }

  return { term: trimmed, exact: false, wildcard: false };
}

/**
 * Searches a tab across title, URL, and domain fields.
 * Returns the best match result or null if no match found.
 *
 * Supports three modes, selected by {@link parseSearchQuery}:
 * - Fuzzy (default): characters match in order, scored by proximity.
 * - Exact (query wrapped in double quotes, e.g. `"burger"`): whole-word match only.
 * - Wildcard (query containing an asterisk, e.g. `insta*`): literal substring match.
 *
 * @param {string} query - The raw search query (quoted for exact, `*` for wildcard)
 * @param {Tab} tab - The tab object to search
 * @returns {{score: number, matches: {title?: {score: number, indices: number[]}, url?: {score: number, indices: number[]}, domain?: {score: number, indices: number[]}}}|null}
 * @example
 * searchTab('git', { title: 'GitHub' });        // fuzzy match
 * searchTab('"git"', { title: 'GitHub - git' }); // exact whole-word match
 * searchTab('insta*', { title: 'Instagram' });   // wildcard substring match
 */
export function searchTab(query, tab) {
  if (!tab) return null;

  const { term, exact, wildcard } = parseSearchQuery(query);
  if (!term) return null;

  const matcher = exact ? exactWordMatch : wildcard ? substringMatch : fuzzyMatch;
  const matches = {};
  let bestScore = 0;

  // Search title
  if (tab.title) {
    const titleMatch = matcher(term, tab.title);
    if (titleMatch) {
      matches.title = titleMatch;
      bestScore = Math.max(bestScore, titleMatch.score);
    }
  }

  // Search URL
  if (tab.url) {
    const urlMatch = matcher(term, tab.url);
    if (urlMatch) {
      matches.url = urlMatch;
      bestScore = Math.max(bestScore, urlMatch.score);
    }
  }

  // Search domain
  const domain = extractDomain(tab.url);
  if (domain) {
    const domainMatch = matcher(term, domain);
    if (domainMatch) {
      matches.domain = domainMatch;
      bestScore = Math.max(bestScore, domainMatch.score);
    }
  }

  if (Object.keys(matches).length === 0) return null;

  return { score: bestScore, matches };
}

/**
 * Searches a tab across title, URL, and domain fields using fuzzy matching.
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

/**
 * Decide whether a tab's favIconUrl is worth attempting to load as an <img>.
 * Returns false for missing URLs and `chrome://` favicons (which a
 * chrome-extension:// origin cannot load), in which case callers should render
 * the placeholder directly. A `true` result is not a loadability guarantee —
 * cross-origin/CORP/404 failures are still handled by the <img> error fallback.
 *
 * @param {string} [favIconUrl] - The tab's favicon URL
 * @returns {boolean} True if the URL should be set as the <img> src
 */
export function isLoadableFavicon(favIconUrl) {
  return Boolean(favIconUrl) && !favIconUrl.startsWith('chrome://');
}
