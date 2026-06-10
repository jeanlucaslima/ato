// ATO Popup Script
// Displays duplicate tabs and handles user actions

import {
  findDuplicates,
  extractDomain,
  countDuplicatesByUrl,
  groupTabsByDomain,
  formatTimeAgo,
  sortTabs,
  sortAudibleFirst,
  normalizeUrl,
  searchTab,
  highlightMatches
} from '../shared/tab-utils.js';
import { applyFont } from '../shared/font-config.js';
import { initLogger, log, error } from '../shared/logger.js';

log('🎨 ATO popup loaded');

// DOM Elements
const totalTabsEl = document.getElementById('total-tabs');
const duplicateCountEl = document.getElementById('duplicate-count');
const domainCountEl = document.getElementById('domain-count');
const duplicateListEl = document.getElementById('duplicate-list');
const allTabsListEl = document.getElementById('all-tabs-list');
const emptyStateEl = document.getElementById('empty-state');
const closeAllBtn = document.getElementById('close-all-btn');
const domainFilterInputEl = document.getElementById('domain-filter-input');
const domainFilterClearEl = document.getElementById('domain-filter-clear');
const domainFilterDropdownEl = document.getElementById('domain-filter-dropdown');
const sortButtonsEl = document.getElementById('sort-buttons');
const duplicatesSortButtonsEl = document.getElementById('duplicates-sort-buttons');
const undoDuplicatesBtn = document.getElementById('undo-duplicates-btn');
const pinnedWarningEl = document.getElementById('pinned-warning');
const pinnedSkipCountEl = document.getElementById('pinned-skip-count');
const browserWarningEl = document.getElementById('browser-warning');
const browserSkipCountEl = document.getElementById('browser-skip-count');
const optionsBtn = document.getElementById('options-btn');
const scopeBtn = document.getElementById('scope-btn');
const scopeIconAll = document.getElementById('scope-icon-all');
const scopeIconCurrent = document.getElementById('scope-icon-current');
const scopeLabel = document.getElementById('scope-label');

// Global search elements
const globalSearchInputEl = document.getElementById('global-search-input');
const globalSearchClearEl = document.getElementById('global-search-clear');
const searchResultsCountEl = document.getElementById('search-results-count');

// Collapsible section elements
const mediaContainerEl = document.getElementById('media-container');
const mediaHeaderEl = document.getElementById('media-header');
const mediaContentEl = document.getElementById('media-content');
const mediaSectionCountEl = document.getElementById('media-section-count');
const mediaListEl = document.getElementById('media-list');
const duplicatesHeaderEl = document.getElementById('duplicates-header');
const duplicatesContentEl = document.getElementById('duplicates-content');
const duplicatesSectionCountEl = document.getElementById('duplicates-section-count');
const allTabsHeaderEl = document.getElementById('all-tabs-header');
const allTabsContentEl = document.getElementById('all-tabs-content');
const allTabsSectionCountEl = document.getElementById('all-tabs-section-count');
const domainSectionsContainer = document.getElementById('domain-sections-container');
const domainSortBarEl = document.getElementById('domain-sort-bar');
const domainSortButtonsEl = document.getElementById('domain-sort-buttons');

// Search results section elements
const searchResultsContainerEl = document.getElementById('search-results-container');
const searchResultsListEl = document.getElementById('search-results-list');
const searchResultsSectionCountEl = document.getElementById('search-results-section-count');
const searchEmptyStateEl = document.getElementById('search-empty-state');
const closeSearchResultsBtn = document.getElementById('close-search-results-btn');

// Settings (loaded from chrome.storage.sync)
let settings = {
  theme: 'dark',
  fontFamily: 'titillium',
  protectPinned: true,
  protectGroups: false,
  advancedMode: false,
  showMergeButton: false,
  keepTab: 'oldest',
  matchMode: 'exact',
  currentWindowOnly: false
};

// State
let activeDomain = null;
let activeSort = 'default';
let duplicateSortOrder = 'default'; // Sort order for duplicates section
let domainSectionSort = 'name'; // Sort order for domain sections
let domainNameDirection = 'az'; // 'az' or 'za' - toggles on click
let domainCountDirection = 'most'; // 'most' or 'few' - toggles on click
let allDomainGroups = []; // Store domain groups for filtering
let highlightedOptionIndex = -1; // Track highlighted option in dropdown
let ageSortDirection = 'old'; // 'old' or 'new' - toggles on each click
let sectionStates = {
  media: true,      // expanded by default
  duplicates: true, // expanded by default
  allTabs: true     // expanded by default
};
let domainSectionStates = {}; // Track collapse state per domain

// Search state
let searchQuery = '';
let searchResults = null; // Map<tabId, matchResult> when searching, null otherwise
let searchDebounceTimer = null;
const SEARCH_DEBOUNCE_MS = 150;
let highlightedResultIndex = -1; // Currently highlighted search result
let searchResultTabIds = []; // Array of tab IDs in display order for navigation

// Undo state
let lastClosedCount = 0;        // Number of tabs closed (for undo)
let undoContext = null;         // 'duplicates', 'domain', or specific domain name
let pinnedDuplicatesSkipped = 0; // Track count of pinned duplicates skipped
let groupedDuplicatesSkipped = 0; // Track count of grouped duplicates skipped
let browserTabsSkipped = 0;     // Track count of browser tabs (chrome://, edge://) skipped

// Render cache for single-pass computation
let renderCache = {
  tabs: null,
  tabsLength: 0,
  urlCounts: null,
  domainMap: null,
  matchMode: null
};

/**
 * Computes render data in a single pass through the tabs array.
 * Caches results to avoid redundant computation on re-renders.
 *
 * @param {Object[]} tabs - Array of tab objects
 * @returns {Object} Computed render data with urlCounts and domainMap
 */
function computeRenderData(tabs) {
  // Check if cache is valid (same tabs array and settings)
  if (renderCache.tabs === tabs &&
      renderCache.tabsLength === tabs.length &&
      renderCache.matchMode === settings.matchMode) {
    return renderCache;
  }

  const urlCounts = new Map();
  const domainMap = new Map();

  // Single pass through all tabs
  for (const tab of tabs) {
    if (!tab.url) continue;

    // Count by normalized URL
    const normalizedUrl = normalizeUrl(tab.url, settings.matchMode);
    urlCounts.set(normalizedUrl, (urlCounts.get(normalizedUrl) || 0) + 1);

    // Group by domain
    const domain = extractDomain(tab.url);
    if (domain) {
      if (!domainMap.has(domain)) domainMap.set(domain, []);
      domainMap.get(domain).push(tab);
    }
  }

  // Update cache
  renderCache = {
    tabs,
    tabsLength: tabs.length,
    urlCounts,
    domainMap,
    matchMode: settings.matchMode
  };

  return renderCache;
}

/**
 * Clears the render cache. Call when tabs are modified.
 */
function clearRenderCache() {
  renderCache = {
    tabs: null,
    tabsLength: 0,
    urlCounts: null,
    domainMap: null,
    matchMode: null
  };
}

// =============================================================================
// Search Functions
// =============================================================================

/**
 * Performs fuzzy search across all tabs.
 * Updates searchResults map with matching tabs.
 *
 * @param {string} query - Search query
 * @param {Object[]} tabs - All tabs
 * @returns {Map<number, Object>|null} Map of tabId -> matchResult, or null if no query
 */
function performSearch(query, tabs) {
  if (!query || query.trim().length === 0) {
    return null;
  }

  const results = new Map();

  for (const tab of tabs) {
    const match = searchTab(query, tab);
    if (match) {
      results.set(tab.id, match);
    }
  }

  return results;
}

/**
 * Handles search input changes with debouncing.
 */
function handleSearchInput(e) {
  const query = e.target.value;

  // Show/hide clear button
  globalSearchClearEl.classList.toggle('hidden', !query);

  // Debounce the search
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    searchQuery = query;
    loadAndRender();
  }, SEARCH_DEBOUNCE_MS);
}

/**
 * Clears the search and resets results.
 */
function clearSearch() {
  searchQuery = '';
  searchResults = null;
  searchResultTabIds = [];
  highlightedResultIndex = -1;
  globalSearchInputEl.value = '';
  globalSearchClearEl.classList.add('hidden');
  searchResultsCountEl.classList.add('hidden');
  document.body.classList.remove('search-active');
  loadAndRender();
}

/**
 * Updates the highlighted search result.
 * @param {number} newIndex - The new index to highlight
 */
function updateHighlightedSearchResult(newIndex) {
  if (searchResultTabIds.length === 0) return;

  // Remove previous highlight
  const prevHighlighted = searchResultsListEl.querySelector('.tab-item.highlighted');
  if (prevHighlighted) {
    prevHighlighted.classList.remove('highlighted');
  }

  // Clamp index to valid range (wrap around)
  if (newIndex < 0) newIndex = searchResultTabIds.length - 1;
  if (newIndex >= searchResultTabIds.length) newIndex = 0;

  highlightedResultIndex = newIndex;

  // Add highlight to new item
  const items = searchResultsListEl.querySelectorAll('.tab-item');
  if (items[highlightedResultIndex]) {
    items[highlightedResultIndex].classList.add('highlighted');
    items[highlightedResultIndex].scrollIntoView({ block: 'nearest' });
  }
}

/**
 * Switches to the currently highlighted search result tab.
 */
function switchToHighlightedResult() {
  if (highlightedResultIndex >= 0 && highlightedResultIndex < searchResultTabIds.length) {
    const tabId = searchResultTabIds[highlightedResultIndex];
    const item = searchResultsListEl.querySelector(`[data-tab-id="${tabId}"]`);
    if (item) {
      const windowId = parseInt(item.dataset.windowId, 10);
      switchToTab(tabId, windowId);
    }
  }
}

/**
 * Updates the search results count display.
 *
 * @param {number} count - Number of matching tabs
 * @param {number} total - Total number of tabs
 */
function updateSearchResultsCount(count, total) {
  if (!searchQuery) {
    searchResultsCountEl.classList.add('hidden');
    searchResultsCountEl.classList.remove('no-results');
    return;
  }

  searchResultsCountEl.classList.remove('hidden');
  if (count === 0) {
    searchResultsCountEl.textContent = 'No results found';
    searchResultsCountEl.classList.add('no-results');
  } else {
    searchResultsCountEl.textContent = `${count} of ${total} tabs`;
    searchResultsCountEl.classList.remove('no-results');
  }
}

/**
 * Loads and applies section collapse states from Chrome storage.
 * Restores user preferences for which sections are expanded/collapsed.
 *
 * @async
 * @returns {Promise<void>}
 */
async function loadSectionStates() {
  try {
    const result = await chrome.storage.local.get(['sectionStates', 'domainSectionStates']);
    if (result.sectionStates) {
      // Merge so newly added sections (e.g. media) keep their default state
      sectionStates = { ...sectionStates, ...result.sectionStates };
    }
    if (result.domainSectionStates) {
      domainSectionStates = result.domainSectionStates;
    }
    applySectionStates();
  } catch (err) {
    error('Error loading section states:', err);
  }
}

/**
 * Apply theme to document
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Loads user settings from Chrome storage.
 *
 * @async
 * @returns {Promise<void>}
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get({
      theme: 'dark',
      fontFamily: 'titillium',
      protectPinned: true,
      protectGroups: false,
      advancedMode: false,
      showMergeButton: false,
      keepTab: 'oldest',
      matchMode: 'exact',
      currentWindowOnly: false
    });
    settings = result;

    // Apply theme and font
    applyTheme(settings.theme);
    applyFont(settings.fontFamily);
  } catch (err) {
    error('Error loading settings:', err);
  }
}

/**
 * Saves current section collapse states to Chrome storage.
 *
 * @async
 * @returns {Promise<void>}
 */
async function saveSectionStates() {
  try {
    await chrome.storage.local.set({ sectionStates, domainSectionStates });
  } catch (err) {
    error('Error saving section states:', err);
  }
}

// Apply current section states to the DOM
function applySectionStates() {
  // Playing Media section
  mediaHeaderEl.setAttribute('aria-expanded', sectionStates.media);
  mediaContentEl.classList.toggle('collapsed', !sectionStates.media);

  // Duplicates section
  duplicatesHeaderEl.setAttribute('aria-expanded', sectionStates.duplicates);
  duplicatesContentEl.classList.toggle('collapsed', !sectionStates.duplicates);

  // All Tabs section
  allTabsHeaderEl.setAttribute('aria-expanded', sectionStates.allTabs);
  allTabsContentEl.classList.toggle('collapsed', !sectionStates.allTabs);
}

// Toggle section visibility
function toggleSection(section) {
  sectionStates[section] = !sectionStates[section];
  applySectionStates();
  saveSectionStates();
}

// Toggle domain section visibility
function toggleDomainSection(domain) {
  // Default to expanded (true) if not set
  const currentState = domainSectionStates[domain] !== false;
  domainSectionStates[domain] = !currentState;

  // Update DOM
  const header = document.querySelector(`[data-domain="${domain}"]`);
  const content = document.getElementById(`domain-content-${domain}`);
  if (header && content) {
    header.setAttribute('aria-expanded', !currentState);
    content.classList.toggle('collapsed', currentState);
  }

  saveSectionStates();
}

// Enable undo button based on context
function showUndoButton(context) {
  // Enable the undo button
  undoDuplicatesBtn.disabled = false;
}

// Disable undo button
function hideAllUndoButtons() {
  undoDuplicatesBtn.disabled = true;
}

// Undo the last close action
async function undoClose() {
  if (lastClosedCount === 0) {
    log('⚠️ No tabs to restore');
    return;
  }

  log(`🔄 Sending undo request for ${lastClosedCount} tabs to background...`);

  // Send message to background service worker to restore tabs
  // (popup may close when tabs are restored, so background handles it)
  chrome.runtime.sendMessage({
    action: 'undoCloseTabs',
    count: lastClosedCount
  });

  // Clear undo state
  lastClosedCount = 0;
  undoContext = null;

  // Hide undo buttons
  hideAllUndoButtons();
}

/**
 * Closes all tabs from a specific domain (except the active tab).
 * Used by domain section "Close all from domain" buttons.
 *
 * @async
 * @param {string} domain - The domain to close tabs from
 * @returns {Promise<void>}
 */
async function closeTabsFromDomain(domain) {
  try {
    const tabs = await chrome.tabs.query({});
    const domainTabs = tabs.filter(tab => {
      const tabDomain = extractDomain(tab.url);
      return tabDomain === domain;
    });

    // Get active tab to avoid closing it
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTabId = activeTabs[0]?.id;

    // Filter out active tab and pinned tabs (if protection enabled)
    const tabsToClose = domainTabs
      .filter(tab => tab.id !== activeTabId)
      .filter(tab => !settings.protectPinned || !tab.pinned)
      .map(tab => tab.id);

    if (tabsToClose.length > 0) {
      const closedCount = tabsToClose.length;
      await chrome.tabs.remove(tabsToClose);
      log(`✅ Closed ${closedCount} tabs from ${domain}`);

      // Store count for undo
      lastClosedCount = closedCount;
      undoContext = domain;

      // Refresh the list first (domain section may disappear)
      await loadAndRender();

      // Show undo button in action bar (domain section may no longer exist)
      showUndoButton('domain');
      return; // Already refreshed
    }

    // Refresh the list
    await loadAndRender();
  } catch (err) {
    error('❌ Error closing domain tabs:', err);
  }
}

/**
 * Moves all tabs from a specific domain to a new window.
 * Used by domain section "Merge" buttons (advanced mode only).
 *
 * @async
 * @param {string} domain - The domain to merge tabs from
 * @returns {Promise<void>}
 */
async function mergeTabsFromDomain(domain) {
  try {
    const tabs = await chrome.tabs.query({});
    const domainTabs = tabs.filter(tab => {
      const tabDomain = extractDomain(tab.url);
      return tabDomain === domain;
    });

    if (domainTabs.length === 0) return;

    // Create new window with first tab
    const newWindow = await chrome.windows.create({
      tabId: domainTabs[0].id
    });

    // Move remaining tabs to new window
    if (domainTabs.length > 1) {
      const remainingTabIds = domainTabs.slice(1).map(t => t.id);
      await chrome.tabs.move(remainingTabIds, {
        windowId: newWindow.id,
        index: -1
      });
    }

    log(`✅ Merged ${domainTabs.length} tabs from ${domain} to new window`);

    // Refresh the list
    await loadAndRender();
  } catch (err) {
    error('❌ Error merging domain tabs:', err);
  }
}

// Create a domain section element
function createDomainSection(domain, tabs, urlCounts) {
  // Explicitly set state if not already set (prevents undefined state issues)
  if (domainSectionStates[domain] === undefined) {
    domainSectionStates[domain] = true; // Default to expanded
  }
  const isExpanded = domainSectionStates[domain];

  const section = document.createElement('div');
  section.className = 'domain-section';

  // Create header (same structure as main section headers)
  const header = document.createElement('button');
  header.className = 'section-header';
  header.setAttribute('data-domain', domain);
  header.setAttribute('aria-expanded', isExpanded);
  header.onclick = () => toggleDomainSection(domain);

  // Arrow
  const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  arrow.setAttribute('class', 'fold-arrow');
  arrow.setAttribute('width', '12');
  arrow.setAttribute('height', '12');
  arrow.setAttribute('viewBox', '0 0 12 12');
  arrow.setAttribute('fill', 'currentColor');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M4 2l4 4-4 4V2z');
  arrow.appendChild(path);

  // Domain name (styled as section title)
  const domainName = document.createElement('h2');
  domainName.className = 'section-title';
  domainName.textContent = domain;

  // Count badge
  const count = document.createElement('span');
  count.className = 'section-count';
  count.textContent = tabs.length;

  header.appendChild(arrow);
  header.appendChild(domainName);
  header.appendChild(count);

  // Create content container
  const content = document.createElement('div');
  content.className = 'section-content';
  content.id = `domain-content-${domain}`;
  if (!isExpanded) {
    content.classList.add('collapsed');
  }

  // Inner wrapper for grid animation
  const contentInner = document.createElement('div');
  contentInner.className = 'section-content-inner';

  // Action bar with buttons
  const actionBar = document.createElement('div');
  actionBar.className = 'domain-action-bar';

  // Merge button (only shown when advanced mode + showMergeButton are enabled)
  if (settings.advancedMode && settings.showMergeButton) {
    const mergeBtn = document.createElement('button');
    mergeBtn.className = 'btn-action btn-accent btn-small';
    mergeBtn.title = `Move all tabs from ${domain} to new window`;
    mergeBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="9" y1="3" x2="9" y2="21"/>
      </svg>
      <span>Merge</span>
    `;
    mergeBtn.onclick = (e) => {
      e.stopPropagation();
      mergeTabsFromDomain(domain);
    };
    actionBar.appendChild(mergeBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn-action btn-danger btn-small';
  closeBtn.title = `Close all tabs from ${domain}`;
  closeBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
    </svg>
    <span>Close all from ${domain}</span>
  `;
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    closeTabsFromDomain(domain);
  };

  actionBar.appendChild(closeBtn);

  // Tab list container
  const tabList = document.createElement('div');
  tabList.className = 'domain-tabs-list';

  // Add tabs, floating any tab playing media to the top of the group
  sortAudibleFirst(tabs).forEach((tab, index) => {
    const dupCount = urlCounts.get(tab.url) || 0;
    const item = createTabItem(tab, dupCount, index, null);
    tabList.appendChild(item);
  });

  contentInner.appendChild(actionBar);
  contentInner.appendChild(tabList);
  content.appendChild(contentInner);
  section.appendChild(header);
  section.appendChild(content);

  return section;
}

/**
 * Creates a "playing media" indicator icon for an audible tab.
 *
 * @returns {HTMLSpanElement} A span containing a speaker SVG icon
 */
function createMediaIcon() {
  const span = document.createElement('span');
  span.className = 'tab-media-icon';
  span.title = 'Playing media';
  span.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4V5z"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    </svg>
  `;
  return span;
}

/**
 * Creates a DOM element for a grouped duplicate row.
 * Shows one row per URL with count badge and close button to close all duplicates.
 * Supports fuzzy match highlighting when matchResult is provided.
 *
 * @param {Object} group - The grouped duplicate data
 * @param {string} group.url - The duplicate URL
 * @param {Object[]} group.tabs - Array of duplicate tabs
 * @param {Object} group.representative - Representative tab for display
 * @param {number} group.totalCount - Total tabs with this URL
 * @param {number} [index=0] - Index for staggered animation
 * @param {Object} [matchResult=null] - Fuzzy match result for highlighting
 * @returns {HTMLDivElement} The grouped duplicate item element
 */
function createGroupedDuplicateItem(group, index = 0, matchResult = null) {
  const { url, tabs: duplicateTabs, representative, totalCount } = group;

  const item = document.createElement('div');
  item.className = 'tab-item';
  item.dataset.url = url;
  item.dataset.tabId = representative.id;
  item.dataset.windowId = representative.windowId;
  item.style.setProperty('--item-index', index);

  // Favicon
  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  if (representative.favIconUrl && !representative.favIconUrl.startsWith('chrome://')) {
    favicon.src = representative.favIconUrl;
    favicon.loading = 'lazy';
  } else {
    favicon.className = 'tab-favicon placeholder';
    favicon.alt = '';
  }

  // Tab info container
  const info = document.createElement('div');
  info.className = 'tab-info';

  // Title - with optional highlighting
  const title = document.createElement('div');
  title.className = 'tab-title';
  const titleText = representative.title || 'Untitled';
  if (matchResult?.matches?.title) {
    title.innerHTML = highlightMatches(titleText, matchResult.matches.title.indices);
  } else {
    title.textContent = titleText;
  }
  title.title = titleText;

  // URL - with optional highlighting
  const urlEl = document.createElement('div');
  urlEl.className = 'tab-url';
  if (matchResult?.matches?.url) {
    urlEl.innerHTML = highlightMatches(url, matchResult.matches.url.indices);
  } else {
    urlEl.textContent = url;
  }
  urlEl.title = url;

  info.appendChild(title);
  info.appendChild(urlEl);

  // Count badge (shows total tabs with this URL)
  const badge = document.createElement('span');
  badge.className = 'duplicate-badge';
  badge.textContent = `×${totalCount}`;
  badge.title = `${totalCount} tabs with this URL`;

  // Close button (handled via event delegation)
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-close';
  closeBtn.textContent = '×';
  closeBtn.title = `Close ${duplicateTabs.length} duplicate(s)`;

  item.appendChild(favicon);
  item.appendChild(info);

  // Media indicator if any tab sharing this URL is playing media
  if (duplicateTabs.some(t => t.audible)) {
    item.appendChild(createMediaIcon());
  }

  item.appendChild(badge);
  item.appendChild(closeBtn);

  return item;
}

/**
 * Closes all duplicate tabs of a specific URL, keeping one original.
 *
 * @async
 * @param {string} url - The URL to close duplicates of
 * @returns {Promise<void>}
 */
async function closeDuplicatesOfUrl(url) {
  try {
    // Query current tabs
    const queryOptions = settings.currentWindowOnly ? { currentWindow: true } : {};
    const allTabs = await chrome.tabs.query(queryOptions);

    // Normalize the URL for comparison based on matchMode
    const normalizedUrl = normalizeUrl(url, settings.matchMode);
    let tabsWithUrl = allTabs.filter(tab => normalizeUrl(tab.url, settings.matchMode) === normalizedUrl);
    if (tabsWithUrl.length <= 1) return;

    // Get active tab to avoid closing it
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTabId = activeTabs[0]?.id;

    // Sort by age based on keepTab setting
    if (settings.keepTab === 'newest') {
      // Sort newest first (highest id = newest)
      tabsWithUrl = [...tabsWithUrl].sort((a, b) => b.id - a.id);
    } else {
      // Sort oldest first (lowest id = oldest) - default
      tabsWithUrl = [...tabsWithUrl].sort((a, b) => a.id - b.id);
    }

    // Keep the first tab (based on sort order) or the active tab if it has this URL
    let tabsToClose = tabsWithUrl.slice(1); // Keep first based on sort

    // If active tab has this URL, keep it instead
    if (tabsWithUrl.some(t => t.id === activeTabId)) {
      tabsToClose = tabsWithUrl.filter(t => t.id !== activeTabId);
    }

    // Filter out pinned tabs if protection is enabled
    if (settings.protectPinned) {
      const beforeCount = tabsToClose.length;
      tabsToClose = tabsToClose.filter(tab => !tab.pinned);
      const skipped = beforeCount - tabsToClose.length;
      if (skipped > 0) {
        pinnedDuplicatesSkipped = skipped;
      }
    }

    // Filter out grouped tabs if protection is enabled
    if (settings.protectGroups) {
      const beforeCount = tabsToClose.length;
      tabsToClose = tabsToClose.filter(tab => tab.groupId === -1 || tab.groupId === undefined);
      const skipped = beforeCount - tabsToClose.length;
      if (skipped > 0) {
        groupedDuplicatesSkipped = skipped;
      }
    }

    // Filter out browser tabs (chrome://, edge://) - they can't be closed by extensions
    {
      const beforeCount = tabsToClose.length;
      tabsToClose = tabsToClose.filter(tab => !isBrowserUrl(tab.url));
      const skipped = beforeCount - tabsToClose.length;
      if (skipped > 0) {
        browserTabsSkipped = skipped;
      }
    }

    const tabIdsToClose = tabsToClose.map(tab => tab.id);

    if (tabIdsToClose.length > 0) {
      // Animate the row
      const rowEl = document.querySelector(`[data-url="${CSS.escape(url)}"]`);
      if (rowEl) {
        rowEl.classList.add('closing');
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      await chrome.tabs.remove(tabIdsToClose);
      log(`✅ Closed ${tabIdsToClose.length} duplicates of ${url}`);
    }

    // Show browser warning if tabs were skipped
    if (browserTabsSkipped > 0) {
      browserSkipCountEl.textContent = browserTabsSkipped;
      browserWarningEl.classList.remove('hidden');
    }

    await loadAndRender();
  } catch (err) {
    error('❌ Error closing duplicates:', err);
  }
}

/**
 * Creates a DOM element for a single tab item.
 * Includes favicon, title, URL, age indicator, duplicate badge, and close button.
 * Supports fuzzy match highlighting when matchResult is provided.
 *
 * @param {Object} tab - The tab data from Chrome API
 * @param {number} tab.id - Tab identifier
 * @param {string} [tab.url] - Tab URL
 * @param {string} [tab.title] - Tab title
 * @param {string} [tab.favIconUrl] - Favicon URL
 * @param {number} [tab.lastAccessed] - Last accessed timestamp
 * @param {number} [tab.windowId] - Window containing this tab
 * @param {number} [duplicateCount=0] - Number of tabs with this URL
 * @param {number} [index=0] - Index for staggered animation
 * @param {Object} [matchResult=null] - Fuzzy match result for highlighting
 * @returns {HTMLDivElement} The tab item element
 */
function createTabItem(tab, duplicateCount = 0, index = 0, matchResult = null) {
  const item = document.createElement('div');
  item.className = 'tab-item';
  item.dataset.tabId = tab.id;
  item.dataset.windowId = tab.windowId;
  item.style.setProperty('--item-index', index);

  // Favicon
  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) {
    favicon.src = tab.favIconUrl;
    // Use CSS fallback for broken images
    favicon.loading = 'lazy';
  } else {
    favicon.className = 'tab-favicon placeholder';
    favicon.alt = '';
  }

  // Tab info container
  const info = document.createElement('div');
  info.className = 'tab-info';

  // Title - with optional highlighting
  const title = document.createElement('div');
  title.className = 'tab-title';
  const titleText = tab.title || 'Untitled';
  if (matchResult?.matches?.title) {
    title.innerHTML = highlightMatches(titleText, matchResult.matches.title.indices);
  } else {
    title.textContent = titleText;
  }
  title.title = titleText;

  // URL - with optional highlighting
  const url = document.createElement('div');
  url.className = 'tab-url';
  if (matchResult?.matches?.url) {
    url.innerHTML = highlightMatches(tab.url || '', matchResult.matches.url.indices);
  } else {
    url.textContent = tab.url;
  }
  url.title = tab.url;

  info.appendChild(title);
  info.appendChild(url);

  // Close button (handled via event delegation)
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-close';
  closeBtn.textContent = '×';
  closeBtn.title = 'Close this tab';

  item.appendChild(favicon);
  item.appendChild(info);

  // Media indicator if this tab is playing media
  if (tab.audible) {
    item.appendChild(createMediaIcon());
  }

  // Age indicator
  const age = document.createElement('span');
  age.className = 'tab-age';
  age.textContent = formatTimeAgo(tab.lastAccessed);
  age.title = tab.lastAccessed ? new Date(tab.lastAccessed).toLocaleString() : 'Unknown';
  item.appendChild(age);

  // Duplicate count badge (if count > 1)
  if (duplicateCount > 1) {
    const badge = document.createElement('span');
    badge.className = 'duplicate-badge';
    badge.textContent = `×${duplicateCount}`;
    badge.title = `${duplicateCount} tabs with this URL`;
    item.appendChild(badge);
  }

  item.appendChild(closeBtn);

  return item;
}

// Switch to a tab
function switchToTab(tabId, windowId) {
  chrome.tabs.update(tabId, { active: true }, () => {
    chrome.windows.update(windowId, { focused: true });
  });
}

/**
 * Checks if a URL is a browser internal page (chrome://, edge://).
 * These pages cannot be closed by extensions due to Chrome security restrictions.
 *
 * @param {string} url - The URL to check
 * @returns {boolean} True if the URL is a browser internal page
 */
function isBrowserUrl(url) {
  return url && (url.startsWith('chrome://') || url.startsWith('edge://'));
}

// Close a single tab with animation
async function closeTab(tabId) {
  try {
    // Get tab info to check if it's a browser URL
    const tab = await chrome.tabs.get(tabId);

    if (isBrowserUrl(tab.url)) {
      // Show warning - browser tabs can't be closed by extensions
      browserTabsSkipped = 1;
      browserSkipCountEl.textContent = '1';
      browserWarningEl.classList.remove('hidden');

      // Auto-hide warning after 3 seconds
      setTimeout(() => {
        browserWarningEl.classList.add('hidden');
        browserTabsSkipped = 0;
      }, 3000);

      log(`⚠️ Cannot close browser tab: ${tab.url}`);
      return;
    }

    // Find the tab-item element in DOM and animate it
    const tabItem = document.querySelector(`[data-tab-id="${tabId}"]`);

    if (tabItem) {
      // Add closing class to trigger animation
      tabItem.classList.add('closing');

      // Wait for animation to complete (400ms)
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    // Now remove the tab from Chrome
    await chrome.tabs.remove(tabId);
    log(`✅ Closed tab ${tabId}`);

    // Refresh the list
    await loadAndRender();
  } catch (err) {
    error('❌ Error closing tab:', err);
  }
}

/**
 * Closes all duplicate tabs, keeping one instance of each URL.
 * Preserves the active tab if it's a duplicate (closes other instances instead).
 * Stores closed count for undo functionality.
 *
 * @async
 * @returns {Promise<void>}
 */
async function closeAllDuplicates() {
  try {
    const tabs = await chrome.tabs.query({});
    const duplicates = findDuplicates(tabs, settings.matchMode);

    if (duplicates.length === 0) {
      return;
    }

    // Get active tab to avoid closing it
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = activeTabs[0];
    const activeTabId = activeTab?.id;
    const activeTabUrl = activeTab?.url;

    // Build a map of normalized URL -> all tabs with that URL
    const urlToTabs = new Map();
    tabs.forEach(tab => {
      if (!tab.url) return;
      const normalizedTabUrl = normalizeUrl(tab.url, settings.matchMode);
      if (!urlToTabs.has(normalizedTabUrl)) {
        urlToTabs.set(normalizedTabUrl, []);
      }
      urlToTabs.get(normalizedTabUrl).push(tab);
    });

    // For each URL with duplicates, decide which tab to keep based on setting
    let tabsToClose = [];
    urlToTabs.forEach((tabsWithUrl, url) => {
      if (tabsWithUrl.length <= 1) return;

      // Sort by age based on keepTab setting
      let sorted;
      if (settings.keepTab === 'newest') {
        sorted = [...tabsWithUrl].sort((a, b) => b.id - a.id); // newest first
      } else {
        sorted = [...tabsWithUrl].sort((a, b) => a.id - b.id); // oldest first
      }

      // Check if active tab is in this group
      const activeInGroup = sorted.some(t => t.id === activeTabId);

      if (activeInGroup) {
        // Keep active tab, close all others
        sorted.forEach(tab => {
          if (tab.id !== activeTabId) {
            tabsToClose.push(tab);
          }
        });
      } else {
        // Keep the first (based on sort), close the rest
        sorted.slice(1).forEach(tab => tabsToClose.push(tab));
      }
    });

    // Filter out pinned tabs if protection is enabled
    let skippedPinnedCount = 0;
    if (settings.protectPinned) {
      const beforeCount = tabsToClose.length;
      tabsToClose = tabsToClose.filter(tab => !tab.pinned);
      skippedPinnedCount = beforeCount - tabsToClose.length;
    }

    // Filter out grouped tabs if protection is enabled
    let skippedGroupedCount = 0;
    if (settings.protectGroups) {
      const beforeCount = tabsToClose.length;
      tabsToClose = tabsToClose.filter(tab => tab.groupId === -1 || tab.groupId === undefined);
      skippedGroupedCount = beforeCount - tabsToClose.length;
    }

    // Filter out browser tabs (chrome://, edge://) - they can't be closed by extensions
    let skippedBrowserCount = 0;
    {
      const beforeCount = tabsToClose.length;
      tabsToClose = tabsToClose.filter(tab => !isBrowserUrl(tab.url));
      skippedBrowserCount = beforeCount - tabsToClose.length;
    }

    // Track count of skipped duplicates
    pinnedDuplicatesSkipped = skippedPinnedCount;
    groupedDuplicatesSkipped = skippedGroupedCount;
    browserTabsSkipped = skippedBrowserCount;

    // Get tab IDs to close
    const tabIdsToClose = tabsToClose.map(tab => tab.id);

    if (tabIdsToClose.length > 0) {
      const closedCount = tabIdsToClose.length;
      await chrome.tabs.remove(tabIdsToClose);
      log(`✅ Closed ${closedCount} duplicate tabs`);

      // Store count for undo
      lastClosedCount = closedCount;
      undoContext = 'duplicates';

      // Show undo button
      showUndoButton('duplicates');
    }

    // Refresh the list
    await loadAndRender();
  } catch (err) {
    error('❌ Error closing duplicates:', err);
  }
}

/**
 * Closes all tabs currently shown in the search results.
 * Honors protectPinned / protectGroups, never closes the active tab,
 * and skips browser-internal URLs that Chrome won't let extensions close.
 */
async function closeAllSearchResults() {
  try {
    if (!searchResultTabIds || searchResultTabIds.length === 0) return;

    const idSet = new Set(searchResultTabIds);
    const allTabs = await chrome.tabs.query({});
    let tabsToClose = allTabs.filter(tab => idSet.has(tab.id));

    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTabId = activeTabs[0]?.id;
    tabsToClose = tabsToClose.filter(tab => tab.id !== activeTabId);

    if (settings.protectPinned) {
      tabsToClose = tabsToClose.filter(tab => !tab.pinned);
    }
    if (settings.protectGroups) {
      tabsToClose = tabsToClose.filter(tab => tab.groupId === -1 || tab.groupId === undefined);
    }
    tabsToClose = tabsToClose.filter(tab => !isBrowserUrl(tab.url));

    const tabIdsToClose = tabsToClose.map(tab => tab.id);
    if (tabIdsToClose.length === 0) {
      await loadAndRender();
      return;
    }

    const closedCount = tabIdsToClose.length;
    await chrome.tabs.remove(tabIdsToClose);
    log(`✅ Closed ${closedCount} search-result tabs`);

    lastClosedCount = closedCount;
    undoContext = 'search';
    showUndoButton('search');

    await loadAndRender();
  } catch (err) {
    error('❌ Error closing search results:', err);
  }
}

// Render domain filter
function renderDomainFilter(tabs) {
  allDomainGroups = groupTabsByDomain(tabs);

  // Update input value if domain is selected
  if (activeDomain) {
    const selectedGroup = allDomainGroups.find(g => g.domain === activeDomain);
    if (selectedGroup) {
      domainFilterInputEl.value = `${selectedGroup.domain} (${selectedGroup.count})`;
      domainFilterClearEl.classList.remove('hidden');
    }
  } else {
    domainFilterInputEl.value = '';
    domainFilterClearEl.classList.add('hidden');
  }
}

// Render dropdown options based on search query
function renderDomainDropdownOptions(query = '') {
  domainFilterDropdownEl.innerHTML = '';
  highlightedOptionIndex = -1; // Reset highlight

  const filteredDomains = allDomainGroups.filter(({ domain }) =>
    domain.toLowerCase().includes(query.toLowerCase())
  );

  if (filteredDomains.length === 0) {
    const noResults = document.createElement('div');
    noResults.className = 'domain-filter-no-results';
    noResults.textContent = 'No domains found';
    domainFilterDropdownEl.appendChild(noResults);
    return;
  }

  // Add "All Domains" option at the top
  const allOption = document.createElement('div');
  allOption.className = 'domain-filter-option' + (activeDomain === null ? ' selected' : '');
  allOption.dataset.index = '0';
  allOption.dataset.domain = '';
  allOption.dataset.count = '';
  allOption.textContent = 'All Domains';
  allOption.onclick = () => selectDomain(null);
  domainFilterDropdownEl.appendChild(allOption);

  // Add filtered domain options
  filteredDomains.forEach(({ domain, count }, index) => {
    const option = document.createElement('div');
    option.className = 'domain-filter-option' + (domain === activeDomain ? ' selected' : '');
    option.dataset.index = String(index + 1); // +1 because "All Domains" is index 0
    option.dataset.domain = domain;
    option.dataset.count = String(count);
    option.innerHTML = `${domain} <span class="domain-count">(${count})</span>`;
    option.onclick = () => selectDomain(domain, count);
    domainFilterDropdownEl.appendChild(option);
  });
}

// Update highlighted option in dropdown
function updateHighlightedOption(newIndex) {
  const options = domainFilterDropdownEl.querySelectorAll('.domain-filter-option');
  if (options.length === 0) return;

  // Remove previous highlight
  options.forEach(opt => opt.classList.remove('highlighted'));

  // Clamp index to valid range
  if (newIndex < 0) newIndex = options.length - 1;
  if (newIndex >= options.length) newIndex = 0;

  highlightedOptionIndex = newIndex;

  // Add highlight to new option
  const highlightedOption = options[highlightedOptionIndex];
  if (highlightedOption) {
    highlightedOption.classList.add('highlighted');
    // Scroll into view if needed
    highlightedOption.scrollIntoView({ block: 'nearest' });
  }
}

// Select the currently highlighted option
function selectHighlightedOption() {
  const options = domainFilterDropdownEl.querySelectorAll('.domain-filter-option');
  if (highlightedOptionIndex >= 0 && highlightedOptionIndex < options.length) {
    const option = options[highlightedOptionIndex];
    const domain = option.dataset.domain || null;
    const count = option.dataset.count ? parseInt(option.dataset.count) : null;
    selectDomain(domain, count);
  }
}

// Select a domain and update filter
function selectDomain(domain, count = null) {
  activeDomain = domain;

  if (domain) {
    domainFilterInputEl.value = `${domain} (${count})`;
    domainFilterClearEl.classList.remove('hidden');
  } else {
    domainFilterInputEl.value = '';
    domainFilterClearEl.classList.add('hidden');
  }

  hideDomainDropdown();
  loadAndRender();
}

// Clear the domain filter
function clearDomainFilter() {
  activeDomain = null;
  domainFilterInputEl.value = '';
  domainFilterClearEl.classList.add('hidden');
  hideDomainDropdown();
  loadAndRender();
}

// Show dropdown
function showDomainDropdown() {
  const query = activeDomain ? '' : domainFilterInputEl.value;
  renderDomainDropdownOptions(query);
  domainFilterDropdownEl.classList.remove('hidden');
}

// Hide dropdown
function hideDomainDropdown() {
  domainFilterDropdownEl.classList.add('hidden');
}

/**
 * Renders the complete popup UI.
 * Updates stats, domain filter, duplicate list, all tabs list, and domain sections.
 *
 * @param {Object[]} tabs - All tabs from Chrome API
 * @param {Object[]} duplicates - Duplicate tabs only
 */
function render(tabs, duplicates) {
  // Save scroll positions before re-rendering
  const scrollPositions = {
    duplicates: duplicatesContentEl.scrollTop,
    allTabs: allTabsContentEl.scrollTop,
    domainSections: domainSectionsContainer.scrollTop
  };

  // Perform search if query exists
  if (searchQuery) {
    searchResults = performSearch(searchQuery, tabs);
    document.body.classList.add('search-active');
    document.body.classList.add('searching');
  } else {
    searchResults = null;
    document.body.classList.remove('search-active');
    document.body.classList.remove('searching');
  }

  // Update search results count
  updateSearchResultsCount(
    searchResults ? searchResults.size : 0,
    tabs.length
  );

  // Handle search results section
  if (searchResults && searchResults.size > 0) {
    searchResultsContainerEl.classList.remove('hidden');
    searchEmptyStateEl.classList.add('hidden');
    searchResultsListEl.innerHTML = '';
    searchResultsSectionCountEl.textContent = searchResults.size;
    closeSearchResultsBtn.classList.remove('hidden');

    // Use cached single-pass computation
    const { urlCounts } = computeRenderData(tabs);

    // Sort results by score (descending - best matches first)
    const sortedResults = [...searchResults.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .map(([tabId, match]) => ({
        tab: tabs.find(t => t.id === tabId),
        match
      }))
      .filter(r => r.tab);

    // Track tab IDs for keyboard navigation
    searchResultTabIds = sortedResults.map(r => r.tab.id);

    // Render search results
    sortedResults.forEach(({ tab, match }, index) => {
      const count = urlCounts.get(tab.url) || 0;
      const item = createTabItem(tab, count, index, match);
      // Apply highlight if this is the highlighted result
      if (index === highlightedResultIndex) {
        item.classList.add('highlighted');
      }
      searchResultsListEl.appendChild(item);
    });
  } else if (searchQuery && (!searchResults || searchResults.size === 0)) {
    // Show empty state for search
    searchResultsContainerEl.classList.remove('hidden');
    searchEmptyStateEl.classList.remove('hidden');
    searchResultsListEl.innerHTML = '';
    searchResultsSectionCountEl.textContent = '0';
    searchResultTabIds = [];
    highlightedResultIndex = -1;
    closeSearchResultsBtn.classList.add('hidden');
  } else {
    // Hide search results section when not searching
    searchResultsContainerEl.classList.add('hidden');
    searchResultTabIds = [];
    highlightedResultIndex = -1;
    closeSearchResultsBtn.classList.add('hidden');
  }

  // Use cached single-pass computation
  const { urlCounts, domainMap } = computeRenderData(tabs);

  // Convert domainMap to sorted array for compatibility
  const domainGroups = Array.from(domainMap.entries())
    .map(([domain, domainTabs]) => ({ domain, tabs: domainTabs, count: domainTabs.length }))
    .sort((a, b) => b.count - a.count);

  // Update stats
  totalTabsEl.textContent = tabs.length;
  duplicateCountEl.textContent = duplicates.length;
  domainCountEl.textContent = domainGroups.length;

  // Render Playing Media section (tabs currently producing sound)
  const audibleTabs = tabs.filter(tab => tab.audible);
  mediaSectionCountEl.textContent = audibleTabs.length;
  mediaListEl.innerHTML = '';
  if (audibleTabs.length > 0) {
    mediaContainerEl.classList.remove('hidden');
    audibleTabs.forEach((tab, index) => {
      const count = urlCounts.get(tab.url) || 0;
      const item = createTabItem(tab, count, index, null);
      mediaListEl.appendChild(item);
    });
  } else {
    mediaContainerEl.classList.add('hidden');
  }

  // Update section counts - show total tabs involved in duplicate groups (including originals)
  const duplicateNormalizedUrls = new Set(duplicates.map(tab => normalizeUrl(tab.url, settings.matchMode)));
  const totalTabsInDuplicateGroups = tabs.filter(tab => duplicateNormalizedUrls.has(normalizeUrl(tab.url, settings.matchMode))).length;
  duplicatesSectionCountEl.textContent = totalTabsInDuplicateGroups;

  // Render domain filter
  renderDomainFilter(tabs);

  // Enable/disable close all duplicates button
  closeAllBtn.disabled = duplicates.length === 0;

  // Update sort button active states
  sortButtonsEl.querySelectorAll('.btn-toggle').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === activeSort);
  });

  // Update duplicate sort button active states
  duplicatesSortButtonsEl.querySelectorAll('.btn-toggle').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === duplicateSortOrder);
  });

  // Clear lists
  duplicateListEl.innerHTML = '';
  allTabsListEl.innerHTML = '';

  // Render duplicates section
  if (duplicates.length === 0) {
    // Show empty state
    duplicateListEl.style.display = 'none';
    emptyStateEl.style.display = 'block';
    pinnedWarningEl.classList.add('hidden');
    browserWarningEl.classList.add('hidden');
    pinnedDuplicatesSkipped = 0;
    groupedDuplicatesSkipped = 0;
    browserTabsSkipped = 0;
  } else {
    // Show duplicates
    duplicateListEl.style.display = 'flex';
    emptyStateEl.style.display = 'none';

    // Show warning if there are protected tabs (pinned or grouped) in duplicate groups
    const hasSkippedTabs = pinnedDuplicatesSkipped > 0 || groupedDuplicatesSkipped > 0;
    if (hasSkippedTabs) {
      // Count all protected tabs that are part of duplicate URLs
      const duplicateNormalizedUrlsForWarning = new Set(duplicates.map(tab => normalizeUrl(tab.url, settings.matchMode)));
      const allTabsInDuplicateGroups = tabs.filter(tab => duplicateNormalizedUrlsForWarning.has(normalizeUrl(tab.url, settings.matchMode)));
      const pinnedCount = settings.protectPinned ? allTabsInDuplicateGroups.filter(tab => tab.pinned).length : 0;
      const groupedCount = settings.protectGroups ? allTabsInDuplicateGroups.filter(tab => tab.groupId !== -1 && tab.groupId !== undefined).length : 0;

      if (pinnedCount > 0 || groupedCount > 0) {
        // Build warning message
        const parts = [];
        if (pinnedCount > 0) parts.push(`${pinnedCount} pinned`);
        if (groupedCount > 0) parts.push(`${groupedCount} grouped`);
        pinnedSkipCountEl.textContent = parts.join(', ');
        pinnedWarningEl.classList.remove('hidden');
      } else {
        pinnedWarningEl.classList.add('hidden');
      }
    } else {
      pinnedWarningEl.classList.add('hidden');
    }

    // Show warning if browser tabs were skipped
    if (browserTabsSkipped > 0) {
      browserSkipCountEl.textContent = browserTabsSkipped;
      browserWarningEl.classList.remove('hidden');
    } else {
      browserWarningEl.classList.add('hidden');
    }

    // Group duplicates by normalized URL
    const duplicatesByUrl = new Map();
    duplicates.forEach(tab => {
      const normalizedTabUrl = normalizeUrl(tab.url, settings.matchMode);
      if (!duplicatesByUrl.has(normalizedTabUrl)) {
        duplicatesByUrl.set(normalizedTabUrl, []);
      }
      duplicatesByUrl.get(normalizedTabUrl).push(tab);
    });

    // Convert to array and sort
    let groupedDuplicates = Array.from(duplicatesByUrl.entries()).map(([normalizedUrl, dupes]) => ({
      url: normalizedUrl,
      tabs: dupes,
      // Use first duplicate as representative
      representative: dupes[0],
      totalCount: urlCounts.get(normalizedUrl) || dupes.length + 1
    }));

    // Sort groups based on duplicateSortOrder
    if (duplicateSortOrder === 'title') {
      groupedDuplicates.sort((a, b) =>
        (a.representative.title || '').localeCompare(b.representative.title || '')
      );
    } else if (duplicateSortOrder === 'domain') {
      groupedDuplicates.sort((a, b) =>
        extractDomain(a.url).localeCompare(extractDomain(b.url))
      );
    }

    // Render each grouped duplicate
    let duplicateIndex = 0;
    groupedDuplicates.forEach((group) => {
      const item = createGroupedDuplicateItem(group, duplicateIndex, null);
      duplicateListEl.appendChild(item);
      duplicateIndex++;
    });
  }

  // Render all tabs section
  // Filter out chrome:// and edge:// pages
  let visibleTabs = tabs.filter(tab =>
    tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')
  );

  // Apply domain filter if active
  if (activeDomain) {
    visibleTabs = visibleTabs.filter(tab => {
      const domain = extractDomain(tab.url);
      return domain === activeDomain;
    });
  }

  // Apply sorting, then float any tab playing media to the top
  visibleTabs = sortAudibleFirst(sortTabs(visibleTabs, activeSort, urlCounts, ageSortDirection));

  // Update all tabs section count
  allTabsSectionCountEl.textContent = visibleTabs.length;

  // Render all tabs as flat list (sortable)
  visibleTabs.forEach((tab, index) => {
    const count = urlCounts.get(tab.url) || 0;
    const item = createTabItem(tab, count, index, null);
    allTabsListEl.appendChild(item);
  });

  // Render domain sections (for domains with 3+ tabs)
  domainSectionsContainer.innerHTML = '';

  // Group all tabs by domain (not filtered)
  const allVisibleTabs = tabs.filter(tab =>
    tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')
  );

  const sectionDomainMap = new Map();
  allVisibleTabs.forEach(tab => {
    const domain = extractDomain(tab.url);
    if (!domain) return;
    if (!sectionDomainMap.has(domain)) {
      sectionDomainMap.set(domain, []);
    }
    sectionDomainMap.get(domain).push(tab);
  });

  // Get domains with 3+ tabs
  const largeDomains = [];
  sectionDomainMap.forEach((domainTabs, domain) => {
    if (domainTabs.length >= 3) {
      largeDomains.push({ domain, tabs: domainTabs });
    }
  });

  // Sort domain sections based on selected sort order
  largeDomains.sort((a, b) => {
    const domainA = a.domain.replace(/^www\./, '');
    const domainB = b.domain.replace(/^www\./, '');
    switch (domainSectionSort) {
      case 'name':
        return domainNameDirection === 'az'
          ? domainA.localeCompare(domainB)
          : domainB.localeCompare(domainA);
      case 'count': {
        const diff = domainCountDirection === 'most'
          ? b.tabs.length - a.tabs.length
          : a.tabs.length - b.tabs.length;
        return diff || domainA.localeCompare(domainB);
      }
      case 'recent': {
        const recentA = a.tabs.reduce((max, t) => Math.max(max, t.lastAccessed || 0), 0);
        const recentB = b.tabs.reduce((max, t) => Math.max(max, t.lastAccessed || 0), 0);
        return recentB - recentA || domainA.localeCompare(domainB);
      }
      default:
        return domainA.localeCompare(domainB);
    }
  });

  // Show/hide domain sort bar based on whether there are domain sections
  domainSortBarEl.classList.toggle('hidden', largeDomains.length === 0);

  // Update active state and labels on domain sort buttons
  domainSortButtonsEl.querySelectorAll('.btn-toggle').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === domainSectionSort);
    if (btn.dataset.sort === 'name') {
      btn.textContent = domainNameDirection === 'az' ? 'A-Z' : 'Z-A';
    } else if (btn.dataset.sort === 'count') {
      btn.textContent = domainCountDirection === 'most' ? 'Most' : 'Few';
    }
  });

  // Render each domain section
  largeDomains.forEach(({ domain, tabs: domainTabs }) => {
    const section = createDomainSection(domain, domainTabs, urlCounts);
    domainSectionsContainer.appendChild(section);
  });

  // Restore scroll positions after DOM updates
  requestAnimationFrame(() => {
    duplicatesContentEl.scrollTop = scrollPositions.duplicates;
    allTabsContentEl.scrollTop = scrollPositions.allTabs;
    domainSectionsContainer.scrollTop = scrollPositions.domainSections;
  });
}

/**
 * Loads all tabs from Chrome and renders the popup UI.
 * Main entry point for UI updates, called on init and after tab changes.
 *
 * @async
 * @returns {Promise<void>}
 */
async function loadAndRender() {
  try {
    // Clear cache since we're fetching fresh data
    clearRenderCache();

    const queryOptions = settings.currentWindowOnly ? { currentWindow: true } : {};
    const tabs = await chrome.tabs.query(queryOptions);
    const duplicates = findDuplicates(tabs, settings.matchMode);

    log(`📊 Loaded ${tabs.length} tabs (${settings.currentWindowOnly ? 'current window' : 'all windows'}), ${duplicates.length} duplicates`);

    render(tabs, duplicates);
  } catch (err) {
    error('❌ Error loading tabs:', err);
  }
}

// Event Listeners
closeAllBtn.addEventListener('click', closeAllDuplicates);
closeSearchResultsBtn.addEventListener('click', closeAllSearchResults);

// Global search event listeners
globalSearchInputEl.addEventListener('input', handleSearchInput);
globalSearchClearEl.addEventListener('click', clearSearch);

// Keyboard shortcuts for search
document.addEventListener('keydown', (e) => {
  // Focus search with '/' key (when not in an input)
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    globalSearchInputEl.focus();
    globalSearchInputEl.select();
  }

  // Focus search with Ctrl+F / Cmd+F
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    globalSearchInputEl.focus();
    globalSearchInputEl.select();
  }

  // Clear search with Escape (when search is focused)
  if (e.key === 'Escape' && document.activeElement === globalSearchInputEl) {
    if (searchQuery) {
      e.preventDefault();
      clearSearch();
    }
    globalSearchInputEl.blur();
  }

  // Arrow navigation for search results (when search input is focused and has results)
  if (document.activeElement === globalSearchInputEl && searchResultTabIds.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      updateHighlightedSearchResult(highlightedResultIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateHighlightedSearchResult(highlightedResultIndex - 1);
    } else if (e.key === 'Enter' && highlightedResultIndex >= 0) {
      e.preventDefault();
      switchToHighlightedResult();
    }
  }
});

// Delegated event listeners for tab lists (performance optimization)
// Handles clicks on tab items and close buttons without per-item handlers

duplicateListEl.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('.tab-close');
  const item = e.target.closest('.tab-item');

  if (closeBtn && item) {
    e.stopPropagation();
    const url = item.dataset.url;
    if (url) closeDuplicatesOfUrl(url);
    return;
  }

  if (item) {
    const tabId = parseInt(item.dataset.tabId, 10);
    const windowId = parseInt(item.dataset.windowId, 10);
    if (tabId) switchToTab(tabId, windowId);
  }
});

allTabsListEl.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('.tab-close');
  const item = e.target.closest('.tab-item');

  if (closeBtn && item) {
    e.stopPropagation();
    const tabId = parseInt(item.dataset.tabId, 10);
    if (tabId) closeTab(tabId);
    return;
  }

  if (item) {
    const tabId = parseInt(item.dataset.tabId, 10);
    const windowId = parseInt(item.dataset.windowId, 10);
    if (tabId) switchToTab(tabId, windowId);
  }
});

mediaListEl.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('.tab-close');
  const item = e.target.closest('.tab-item');

  if (closeBtn && item) {
    e.stopPropagation();
    const tabId = parseInt(item.dataset.tabId, 10);
    if (tabId) closeTab(tabId);
    return;
  }

  if (item) {
    const tabId = parseInt(item.dataset.tabId, 10);
    const windowId = parseInt(item.dataset.windowId, 10);
    if (tabId) switchToTab(tabId, windowId);
  }
});

domainSectionsContainer.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('.tab-close');
  const item = e.target.closest('.tab-item');

  if (closeBtn && item) {
    e.stopPropagation();
    const tabId = parseInt(item.dataset.tabId, 10);
    if (tabId) closeTab(tabId);
    return;
  }

  if (item) {
    const tabId = parseInt(item.dataset.tabId, 10);
    const windowId = parseInt(item.dataset.windowId, 10);
    if (tabId) switchToTab(tabId, windowId);
  }
});

searchResultsListEl.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('.tab-close');
  const item = e.target.closest('.tab-item');

  if (closeBtn && item) {
    e.stopPropagation();
    const tabId = parseInt(item.dataset.tabId, 10);
    if (tabId) closeTab(tabId);
    return;
  }

  if (item) {
    const tabId = parseInt(item.dataset.tabId, 10);
    const windowId = parseInt(item.dataset.windowId, 10);
    if (tabId) switchToTab(tabId, windowId);
  }
});

// Domain filter event listeners
domainFilterInputEl.addEventListener('focus', () => {
  // Clear input if a domain is selected, so user can search
  if (activeDomain) {
    domainFilterInputEl.value = '';
  }
  showDomainDropdown();
});

domainFilterInputEl.addEventListener('input', (e) => {
  const query = e.target.value;
  renderDomainDropdownOptions(query);
  domainFilterDropdownEl.classList.remove('hidden');

  // Show/hide clear button based on input
  if (query) {
    domainFilterClearEl.classList.remove('hidden');
  } else if (!activeDomain) {
    domainFilterClearEl.classList.add('hidden');
  }
});

domainFilterInputEl.addEventListener('keydown', (e) => {
  const isDropdownVisible = !domainFilterDropdownEl.classList.contains('hidden');

  if (!isDropdownVisible) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      updateHighlightedOption(highlightedOptionIndex + 1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      updateHighlightedOption(highlightedOptionIndex - 1);
      break;
    case 'Enter':
      e.preventDefault();
      if (highlightedOptionIndex >= 0) {
        selectHighlightedOption();
      }
      break;
    case 'Escape':
      e.preventDefault();
      hideDomainDropdown();
      domainFilterInputEl.blur();
      break;
  }
});

domainFilterInputEl.addEventListener('blur', (e) => {
  // Delay hiding to allow click on dropdown options
  setTimeout(() => {
    hideDomainDropdown();
    // Restore selected domain display if user didn't select anything
    if (activeDomain) {
      const selectedGroup = allDomainGroups.find(g => g.domain === activeDomain);
      if (selectedGroup) {
        domainFilterInputEl.value = `${selectedGroup.domain} (${selectedGroup.count})`;
      }
    }
  }, 150);
});

domainFilterClearEl.addEventListener('click', (e) => {
  e.stopPropagation();
  clearDomainFilter();
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.domain-filter')) {
    hideDomainDropdown();
  }
});

undoDuplicatesBtn.addEventListener('click', undoClose);

// Options button - open options page
optionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Scope button - toggle detection scope
scopeBtn.addEventListener('click', async () => {
  // Toggle currentWindowOnly
  settings.currentWindowOnly = !settings.currentWindowOnly;
  await chrome.storage.sync.set({ currentWindowOnly: settings.currentWindowOnly });
  updateScopeButton();
  loadAndRender();
});

/**
 * Updates the scope button visibility and appearance based on settings.
 */
function updateScopeButton() {
  // Only show if advanced mode is enabled
  if (settings.advancedMode) {
    scopeBtn.classList.remove('hidden');
  } else {
    scopeBtn.classList.add('hidden');
    return;
  }

  // Update icon and label based on current scope
  if (settings.currentWindowOnly) {
    scopeIconAll.classList.add('hidden');
    scopeIconCurrent.classList.remove('hidden');
    scopeLabel.textContent = 'Window';
    scopeBtn.title = 'Current window only - click to switch to all windows';
    scopeBtn.classList.add('active');
  } else {
    scopeIconAll.classList.remove('hidden');
    scopeIconCurrent.classList.add('hidden');
    scopeLabel.textContent = 'All';
    scopeBtn.title = 'All windows - click to switch to current window only';
    scopeBtn.classList.remove('active');
  }
}

// Sort button group event listener (All Tabs section)
sortButtonsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-toggle');
  if (btn && btn.dataset.sort) {
    const newSort = btn.dataset.sort;
    // Toggle age direction if clicking age button again
    if (newSort === 'age' && activeSort === 'age') {
      ageSortDirection = ageSortDirection === 'old' ? 'new' : 'old';
    } else if (newSort === 'age') {
      // Reset to 'old' when first selecting age sort
      ageSortDirection = 'old';
    }
    activeSort = newSort;
    loadAndRender();
  }
});

// Sort button group event listener (Duplicates section)
duplicatesSortButtonsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-toggle');
  if (btn && btn.dataset.sort) {
    duplicateSortOrder = btn.dataset.sort;
    loadAndRender();
  }
});

// Sort button group event listener (Domain sections)
domainSortButtonsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-toggle');
  if (btn && btn.dataset.sort) {
    const newSort = btn.dataset.sort;
    // Toggle direction if clicking the same button again
    if (newSort === 'name' && domainSectionSort === 'name') {
      domainNameDirection = domainNameDirection === 'az' ? 'za' : 'az';
    } else if (newSort === 'name') {
      domainNameDirection = 'az';
    }
    if (newSort === 'count' && domainSectionSort === 'count') {
      domainCountDirection = domainCountDirection === 'most' ? 'few' : 'most';
    } else if (newSort === 'count') {
      domainCountDirection = 'most';
    }
    domainSectionSort = newSort;
    loadAndRender();
  }
});

// Section toggle event listeners
mediaHeaderEl.addEventListener('click', () => toggleSection('media'));
duplicatesHeaderEl.addEventListener('click', () => toggleSection('duplicates'));
allTabsHeaderEl.addEventListener('click', () => toggleSection('allTabs'));

// Initialize footer
function initFooter() {
  const versionEl = document.getElementById('footer-version');
  const shortcutEl = document.getElementById('footer-shortcut');

  // Get version from manifest
  const manifest = chrome.runtime.getManifest();
  versionEl.textContent = `v${manifest.version}`;

  // Detect platform for shortcut hint
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  shortcutEl.textContent = isMac ? 'try ⌘+U' : 'try Ctrl+U';
}

// Initial load - wait for settings and section states before rendering
(async () => {
  await initLogger();
  await loadSettings();
  await loadSectionStates();
  updateScopeButton();
  initFooter();
  loadAndRender();
})();
