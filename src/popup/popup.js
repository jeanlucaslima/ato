// ATO Popup Script
// Displays duplicate tabs and handles user actions

import {
  extractDomain,
  groupTabsByDomain,
  formatTimeAgo,
  sortAudibleFirst,
  normalizeUrl,
  highlightMatches,
  isLoadableFavicon
} from '../shared/tab-utils.js';
import { applyFont } from '../shared/font-config.js';
import { initLogger, log, error } from '../shared/logger.js';
import {
  createInitialPopupState,
  effectiveSearchQuery as effectiveStateSearchQuery,
  filterCloseableTabs,
  getCursorItem,
  getDuplicateGroups,
  getDuplicateTabs,
  getDomainGroups,
  getLargeDomainGroups,
  getPlayingTabs,
  getScopedTabs,
  getSearchResults,
  getSearchResultTabIds,
  getTab,
  getTabsForDomain,
  getTabsToCloseForAllDuplicates,
  getTabsToCloseForDuplicateUrl,
  getUrlCounts,
  getVisibleNavigationItems as getStateNavigationItems,
  getVisibleTabs,
  isDomainExpanded,
  makeItemId,
  reducePopupState,
  selectTabIds,
  serializeExpansion
} from './popup-state.js';

log('🎨 ATO popup loaded');

// DOM Elements
const totalTabsEl = document.getElementById('total-tabs');
const duplicateCountEl = document.getElementById('duplicate-count');
const domainCountEl = document.getElementById('domain-count');
const statsSummaryEl = document.getElementById('stats-summary');
const duplicateListEl = document.getElementById('duplicate-list');
const allTabsListEl = document.getElementById('all-tabs-list');
const emptyStateEl = document.getElementById('empty-state');
const closeAllBtn = document.getElementById('close-all-btn');
const reviewDuplicatesBtn = document.getElementById('review-duplicates-btn');
const exitDuplicatesReviewBtn = document.getElementById('exit-duplicates-review-btn');
const domainFilterInputEl = document.getElementById('domain-filter-input');
const domainFilterClearEl = document.getElementById('domain-filter-clear');
const domainFilterDropdownEl = document.getElementById('domain-filter-dropdown');
const sortButtonsEl = document.getElementById('sort-buttons');
const duplicatesSortButtonsEl = document.getElementById('duplicates-sort-buttons');
const undoDuplicatesBtn = document.getElementById('undo-duplicates-btn');
const undoRowEl = document.getElementById('undo-row');
const undoMessageEl = document.getElementById('undo-message');
const pinnedWarningEl = document.getElementById('pinned-warning');
const pinnedSkipCountEl = document.getElementById('pinned-skip-count');
const browserWarningEl = document.getElementById('browser-warning');
const browserSkipCountEl = document.getElementById('browser-skip-count');
const optionsBtn = document.getElementById('options-btn');
const scopeBtn = document.getElementById('scope-btn');
const scopeLabel = document.getElementById('scope-label');

// Global search elements
const globalSearchInputEl = document.getElementById('global-search-input');
const globalSearchClearEl = document.getElementById('global-search-clear');
const searchResultsCountEl = document.getElementById('search-results-count');
const searchModeChipEl = document.getElementById('search-mode-chip');
const searchModeChipLabelEl = document.getElementById('search-mode-chip-label');
const searchModeChipRemoveEl = document.getElementById('search-mode-chip-remove');
const searchFieldControlsEl = document.getElementById('search-field-controls');
const searchPrecisionControlsEl = document.getElementById('search-precision-controls');

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
const moveSearchResultsBtn = document.getElementById('move-search-results-btn');
const browseTabsEl = document.querySelector('.browse-tabs');
const browseTabButtons = document.querySelectorAll('.browse-tab');
const duplicatesSummaryPrimaryEl = document.getElementById('duplicates-summary-primary');
const duplicatesSummarySecondaryEl = document.getElementById('duplicates-summary-secondary');

// Settings (loaded from chrome.storage.sync)
let settings = {
  theme: 'graphite',
  fontFamily: 'titillium',
  protectPinned: true,
  protectGroups: false,
  keepTab: 'oldest',
  matchMode: 'exact',
  currentWindowOnly: false,
  defaultBrowseView: 'tabs',
  defaultSearchMode: 'contains'
};

// State
let appState = createInitialPopupState();
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
  duplicates: true, // expanded by default so the quick cleanup summary is visible
  allTabs: true     // expanded by default
};
let domainSectionStates = {}; // Track collapse state per domain
let browseView = 'tabs';
let duplicateReviewOpen = false;

// Search state
let searchQuery = '';
let searchField = null; // null = all fields, 'url' = URL mode, 'title' = title mode
let searchPrecision = 'fuzzy';
let searchResults = null; // Map<tabId, matchResult> when searching, null otherwise
let searchDebounceTimer = null;
const SEARCH_DEBOUNCE_MS = 150;

// Field-mode metadata. The prefix is what tab-utils' parseSearchQuery understands;
// the chip mirrors that operator while the placeholder gives a human hint.
const SEARCH_FIELD_PREFIX = { url: 'url', title: 'title' };
const SEARCH_FIELD_PLACEHOLDER = { url: 'Search URLs', title: 'Search titles' };
const DEFAULT_SEARCH_PLACEHOLDER = 'Search tabs';
let highlightedResultIndex = -1; // Currently highlighted search result
let searchResultTabIds = []; // Array of tab IDs in display order for navigation
let selectedItemIndex = -1;

// Undo state
let lastClosedCount = 0;        // Number of tabs closed (for undo)
let undoContext = null;         // 'duplicates', 'domain', or specific domain name
let undoMessage = '';
let pinnedDuplicatesSkipped = 0; // Track count of pinned duplicates skipped
let groupedDuplicatesSkipped = 0; // Track count of grouped duplicates skipped
let browserTabsSkipped = 0;     // Track count of browser tabs (chrome://, edge://) skipped
let hasRenderedOnce = false;    // Stagger slide-in only plays on the first render

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

function dispatch(action) {
  appState = reducePopupState(appState, action);
  syncLegacyStateFromStore();
  clearRenderCache();
}

function syncLegacyStateFromStore() {
  activeDomain = appState.filters.domain;
  activeSort = appState.sort.tabs;
  duplicateSortOrder = appState.sort.duplicate;
  domainSectionSort = appState.sort.domainSection;
  domainNameDirection = appState.sort.domainNameDirection;
  domainCountDirection = appState.sort.domainCountDirection;
  ageSortDirection = appState.sort.ageDirection;
  sectionStates = appState.expansion.sections;
  domainSectionStates = Object.fromEntries(
    getLargeDomainGroups(appState).map(group => [group.domain, isDomainExpanded(appState, group.domain)])
  );
  browseView = appState.view.type;
  duplicateReviewOpen = appState.duplicateReviewOpen;
  searchQuery = appState.search.query;
  searchField = appState.search.field === 'all' ? null : appState.search.field;
  searchPrecision = appState.search.mode;
  searchResults = new Map(getSearchResults(appState).map(({ tab, match }) => [tab.id, match]));
  searchResultTabIds = getSearchResultTabIds(appState);
  selectedItemIndex = appState.navigation.cursorIndex;
  highlightedResultIndex = searchResultTabIds.indexOf(Number((getCursorItem(appState)?.tabId)));
}

function updateStoreSettings() {
  dispatch({
    type: 'SET_SETTINGS',
    settings: {
      matchMode: settings.matchMode,
      keepTab: settings.keepTab,
      protectPinned: settings.protectPinned,
      protectGroups: settings.protectGroups,
      defaultBrowseView: settings.defaultBrowseView,
      defaultSearchMode: settings.defaultSearchMode
    }
  });
}

// =============================================================================
// Search Functions
// =============================================================================

/**
 * Builds the query string handed to the search engine, prefixing the active
 * field mode (e.g. `url:`) so tab-utils' parseSearchQuery scopes the search.
 * Exact (`"…"`) and wildcard (`…*`) syntax still compose inside the mode.
 *
 * @returns {string} The effective query
 */
function effectiveSearchQuery() {
  return effectiveStateSearchQuery(appState);
}

/**
 * Handles search input changes with debouncing. Also detects a field-mode
 * prefix (`url:`, `title:`, or a legacy alias) typed at the start of the input and converts
 * it into a mode chip so only the bare term remains in the box.
 */
function handleSearchInput(e) {
  let query = e.target.value;

  // Convert a typed prefix into a mode chip (only when not already in a mode).
  if (!searchField) {
    const prefixMatch = /^(url|title|inurl|intitle):/i.exec(query);
    if (prefixMatch) {
      const prefix = prefixMatch[1].toLowerCase();
      enterSearchMode(prefix === 'url' || prefix === 'inurl' ? 'url' : 'title');
      query = query.slice(prefixMatch[0].length);
      e.target.value = query;
    }
  }

  // Show/hide clear button (also visible when a mode is active with no term)
  globalSearchClearEl.classList.toggle('hidden', !query && !searchField);

  // Debounce the search
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    dispatch({ type: 'SET_SEARCH_QUERY', query });
    loadAndRender();
  }, SEARCH_DEBOUNCE_MS);
}

/**
 * Enters a field-scoped search mode, showing the chip and updating the hint.
 *
 * @param {'url'|'title'} field - The field to scope the search to
 */
function enterSearchMode(field) {
  dispatch({ type: 'SET_SEARCH_FIELD', field });
  searchModeChipLabelEl.textContent = SEARCH_FIELD_PREFIX[field];
  updateSearchFieldControls();
  searchModeChipEl.classList.remove('hidden');
  globalSearchInputEl.placeholder = SEARCH_FIELD_PLACEHOLDER[field];
}

/**
 * Exits field-scoped search mode, restoring the default all-fields search.
 */
function exitSearchMode() {
  dispatch({ type: 'SET_SEARCH_FIELD', field: 'all' });
  updateSearchFieldControls();
  searchModeChipEl.classList.add('hidden');
  globalSearchInputEl.placeholder = DEFAULT_SEARCH_PLACEHOLDER;
}

function updateSearchFieldControls() {
  const current = searchField || 'all';
  searchFieldControlsEl.value = current;
}

function updateSearchPrecisionControls() {
  searchPrecisionControlsEl.value = searchPrecision;
}

/**
 * Re-runs the search after a mode change driven by the menu/chip (not typing),
 * keeping any already-typed term and syncing the clear button.
 */
function applySearchModeChange() {
  dispatch({ type: 'SET_SEARCH_QUERY', query: globalSearchInputEl.value });
  globalSearchClearEl.classList.toggle('hidden', !searchQuery && !searchField);
  loadAndRender();
}

/**
 * Clears the search and resets results (including any active field mode).
 */
function clearSearch() {
  globalSearchInputEl.value = '';
  globalSearchClearEl.classList.add('hidden');
  searchResultsCountEl.classList.add('hidden');
  document.body.classList.remove('search-active');
  dispatch({ type: 'CLEAR_SEARCH', defaultMode: settings.defaultSearchMode || 'contains' });
  exitSearchMode();
  updateSearchPrecisionControls();
  loadAndRender();
}

/**
 * Switches to the currently highlighted search result tab.
 */
function switchToHighlightedResult() {
  const cursor = getCursorItem(appState);
  if (cursor?.type === 'tab') {
    switchToTab(cursor.tabId, cursor.windowId);
  }
}

function getVisibleActionItems() {
  return getStateNavigationItems(appState);
}

function updateSelectedItem(newIndex) {
  const items = getVisibleActionItems();
  document.querySelectorAll('.browse-tab.selected, .tab-item.selected, .section-header.selected, .btn-action.selected').forEach(item => item.classList.remove('selected'));

  if (items.length === 0) {
    dispatch({ type: 'SET_CURSOR', cursorId: null, focusZone: 'content' });
    return;
  }

  if (newIndex < 0) newIndex = 0;
  if (newIndex >= items.length) newIndex = items.length - 1;

  dispatch({ type: 'SET_CURSOR', cursorId: items[newIndex].id, focusZone: 'content' });
  applyCursorToDom();
}

function restoreSelectedItem() {
  syncLegacyStateFromStore();
  applyCursorToDom();
}

function domElementForItemId(cursorId) {
  if (!cursorId) return null;
  if (cursorId.startsWith('view:')) {
    return browseTabsEl.querySelector(`[data-view="${CSS.escape(cursorId.slice('view:'.length))}"]`);
  }
  if (cursorId.startsWith('section:')) {
    const section = cursorId.slice('section:'.length);
    return document.getElementById(`${section === 'allTabs' ? 'all-tabs' : section}-header`);
  }
  if (cursorId.startsWith('domain:')) {
    return domainSectionsContainer.querySelector(`.section-header[data-domain="${CSS.escape(cursorId.slice('domain:'.length))}"]`);
  }
  if (cursorId.startsWith('action:')) {
    const [, action, ...domainParts] = cursorId.split(':');
    const domain = domainParts.join(':');
    return domainSectionsContainer.querySelector(`.btn-action[data-action="${CSS.escape(action)}"][data-domain="${CSS.escape(domain)}"]`);
  }
  if (cursorId.startsWith('duplicate:')) {
    return duplicateListEl.querySelector(`[data-url="${CSS.escape(cursorId.slice('duplicate:'.length))}"]`);
  }
  if (cursorId.startsWith('tab:')) {
    return document.querySelector(`[data-tab-id="${CSS.escape(cursorId.slice('tab:'.length))}"]`);
  }
  return null;
}

function applyCursorToDom() {
  document.querySelectorAll('.browse-tab.selected, .tab-item.selected, .section-header.selected, .btn-action.selected, .tab-item.highlighted')
    .forEach(item => item.classList.remove('selected', 'highlighted'));

  const element = domElementForItemId(appState.navigation.cursorId);
  if (!element) return;
  element.classList.add('selected');
  if (element.classList.contains('tab-item') && appState.search.query) {
    element.classList.add('highlighted');
  }
  element.scrollIntoView({ block: 'nearest' });
}

function activateSelectedItem() {
  const item = getCursorItem(appState);
  if (!item) return;

  if (item.type === 'view') {
    dispatch({ type: 'SET_VIEW', view: item.view });
    loadAndRender();
    return;
  }

  if (item.type === 'section') {
    toggleSection(item.section);
    return;
  }

  if (item.type === 'domain') {
    toggleDomainSection(item.domain);
    return;
  }

  if (item.type === 'action') {
    if (item.action === 'move-domain') moveTabsFromDomainToWindow(item.domain);
    if (item.action === 'close-domain') closeTabsFromDomain(item.domain);
    return;
  }

  if (item.type === 'duplicate') return;

  if (item.type === 'tab') switchToTab(item.tabId, item.windowId);
}

function closeSelectedItem() {
  const item = getCursorItem(appState);
  if (!item) return;
  if (item.type === 'view' || item.type === 'section' || item.type === 'domain' || item.type === 'action') return;

  if (item.type === 'duplicate') {
    closeDuplicatesOfUrl(item.url);
    return;
  }

  if (item.type === 'tab') closeTab(item.tabId);
}

function setSelectedHeaderExpanded(expand) {
  const item = getCursorItem(appState);
  if (!item) return false;

  if (item.type === 'view') {
    const targetView = expand ? 'domains' : 'tabs';
    if (appState.view.type !== targetView) {
      dispatch({ type: 'SET_VIEW', view: targetView });
      loadAndRender();
    }
    return true;
  }

  if (item.type === 'domain') {
    dispatch({ type: expand ? 'EXPAND_DOMAIN' : 'COLLAPSE_DOMAIN', domain: item.domain });
    saveSectionStates();
    loadAndRender();
    return true;
  }

  if (item.type === 'section') {
    if (appState.expansion.sections[item.section] !== expand) {
      dispatch({ type: 'TOGGLE_SECTION', section: item.section });
      applySectionStates();
      saveSectionStates();
      loadAndRender();
    }
    return true;
  }

  return false;
}

function selectParentSectionHeader() {
  const item = getCursorItem(appState);
  if (!item || item.type !== 'tab') return false;
  dispatch({ type: 'NAVIGATE_PARENT' });
  applyCursorToDom();
  return Boolean(getCursorItem(appState));
}

function selectOwningDomainHeader() {
  const item = getCursorItem(appState);
  if (!item || item.type !== 'action') return false;
  dispatch({ type: 'NAVIGATE_PARENT' });
  applyCursorToDom();
  return Boolean(getCursorItem(appState));
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
    searchResultsCountEl.textContent = `${count} match${count === 1 ? '' : 'es'}`;
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
      // Preserve saved states while letting newly added sections keep defaults.
      sectionStates = { ...sectionStates, ...result.sectionStates };
    }
    if (result.domainSectionStates) {
      domainSectionStates = result.domainSectionStates;
    }
    appState = createInitialPopupState({
      currentWindowOnly: settings.currentWindowOnly,
      focusedWindowId: appState.browser.focusedWindowId,
      defaultBrowseView: settings.defaultBrowseView,
      defaultSearchMode: settings.defaultSearchMode,
      sectionStates,
      domainSectionStates
    });
    updateStoreSettings();
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
      theme: 'graphite',
      fontFamily: 'titillium',
      protectPinned: true,
      protectGroups: false,
      keepTab: 'oldest',
      matchMode: 'exact',
      currentWindowOnly: false,
      defaultBrowseView: 'tabs',
      defaultSearchMode: 'contains'
    });
    settings = result;
    updateStoreSettings();
    updateSearchPrecisionControls();

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
    await chrome.storage.local.set(serializeExpansion(appState));
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
  dispatch({ type: 'TOGGLE_SECTION', section });
  applySectionStates();
  saveSectionStates();
  loadAndRender();
}

// Toggle domain section visibility
function toggleDomainSection(domain) {
  dispatch({ type: 'TOGGLE_DOMAIN', domain });
  saveSectionStates();
  loadAndRender();
}

// Enable undo button based on context
function showUndoButton(context, message = '') {
  undoDuplicatesBtn.disabled = false;
  undoRowEl.classList.remove('hidden');
  undoMessage = message || undoMessageForContext(context, lastClosedCount);
  undoMessageEl.textContent = undoMessage;
}

// Disable undo button
function hideAllUndoButtons() {
  undoDuplicatesBtn.disabled = true;
  undoRowEl.classList.add('hidden');
  undoMessage = '';
}

function undoMessageForContext(context, count) {
  if (context === 'duplicates') return `Closed ${count} duplicate tab${count === 1 ? '' : 's'}`;
  if (context === 'search') return `Closed ${count} search result${count === 1 ? '' : 's'}`;
  if (context === 'tab') return `Closed ${count} tab${count === 1 ? '' : 's'}`;
  if (context === 'domain') return `Closed ${count} domain tab${count === 1 ? '' : 's'}`;
  return `Closed ${count} tab${count === 1 ? '' : 's'}`;
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
    const domainTabs = getTabsForDomain(appState, domain);
    const tabsToClose = selectTabIds(filterCloseableTabs(appState, domainTabs));

    if (tabsToClose.length > 0) {
      const closedCount = tabsToClose.length;
      await chrome.tabs.remove(tabsToClose);
      tabsToClose.forEach(tabId => dispatch({ type: 'TAB_REMOVED', tabId }));
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
    await refreshBrowserSnapshot({ currentWindowOnly: settings.currentWindowOnly });
    await loadAndRender();
  } catch (err) {
    error('❌ Error closing domain tabs:', err);
  }
}

/**
 * Moves all tabs from a specific domain to a new window.
 *
 * @async
 * @param {string} domain - The domain to move tabs from
 * @returns {Promise<void>}
 */
async function moveTabsFromDomainToWindow(domain) {
  try {
    const domainTabs = getTabsForDomain(appState, domain);

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

    log(`✅ Moved ${domainTabs.length} tabs from ${domain} to new window`);

    // Refresh the list
    await loadAndRender();
  } catch (err) {
    error('❌ Error moving domain tabs:', err);
  }
}

async function moveSearchResultsToWindow() {
  try {
    const tabsToMove = getSearchResults(appState).map(({ tab }) => tab);
    if (tabsToMove.length === 0) return;

    const newWindow = await chrome.windows.create({ tabId: tabsToMove[0].id });
    if (tabsToMove.length > 1) {
      await chrome.tabs.move(tabsToMove.slice(1).map(tab => tab.id), {
        windowId: newWindow.id,
        index: -1
      });
    }

    lastClosedCount = 0;
    undoContext = null;
    hideAllUndoButtons();
    log(`✅ Moved ${tabsToMove.length} search-result tabs to new window`);
    await refreshBrowserSnapshot({ currentWindowOnly: settings.currentWindowOnly });
    await loadAndRender();
  } catch (err) {
    error('❌ Error moving search results:', err);
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

  const moveBtn = document.createElement('button');
  moveBtn.className = 'btn-action btn-accent btn-small';
  moveBtn.dataset.action = 'move-domain';
  moveBtn.dataset.domain = domain;
  moveBtn.title = `Move all tabs from ${domain} to a new window`;
  moveBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="9" y1="3" x2="9" y2="21"/>
      </svg>
      <span>Move to window</span>
    `;
  moveBtn.onclick = (e) => {
    e.stopPropagation();
    moveTabsFromDomainToWindow(domain);
  };
  actionBar.appendChild(moveBtn);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn-action btn-danger btn-small';
  closeBtn.dataset.action = 'close-domain';
  closeBtn.dataset.domain = domain;
  closeBtn.title = `Close all tabs from ${domain}`;
  closeBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
    </svg>
    <span>Close all</span>
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
    const dupCount = urlCounts.get(normalizeUrl(tab.url, settings.matchMode)) || 0;
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
 * Creates a favicon <img> for a tab, shared by every render path.
 *
 * Sets the favicon src when the URL is loadable, otherwise renders the
 * placeholder directly. An `error` handler falls back to the same placeholder
 * appearance when the image fails to load (e.g. cross-origin/CORP-blocked, 404),
 * so a broken-image glyph is never shown. The handler clears its own reference
 * and the broken src so it cannot loop.
 *
 * @param {string} [favIconUrl] - The tab's favicon URL
 * @returns {HTMLImageElement} The favicon element
 */
function createFaviconElement(favIconUrl) {
  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  favicon.alt = '';

  if (isLoadableFavicon(favIconUrl)) {
    favicon.loading = 'lazy';
    favicon.onerror = () => {
      favicon.onerror = null;
      favicon.removeAttribute('src');
      favicon.className = 'tab-favicon placeholder';
    };
    favicon.src = favIconUrl;
  } else {
    favicon.className = 'tab-favicon placeholder';
  }

  return favicon;
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
  item.className = 'tab-item duplicate-group-item';
  if (duplicateTabs.some(t => t.audible)) {
    item.classList.add('is-audible');
  }
  if (representative.active) {
    item.classList.add('is-current');
  }
  if (representative.pinned) {
    item.classList.add('is-pinned');
  }
  if (representative.discarded) {
    item.classList.add('is-discarded');
  }
  item.dataset.url = url;
  item.dataset.tabId = representative.id;
  item.dataset.windowId = representative.windowId;
  item.style.setProperty('--item-index', index);

  // Favicon
  const favicon = createFaviconElement(representative.favIconUrl);

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
    const tabsWithUrl = getTabsToCloseForDuplicateUrl(appState, url);
    if (tabsWithUrl.length === 0) return;

    const tabIdsToClose = selectTabIds(tabsWithUrl);

    if (tabIdsToClose.length > 0) {
      // Animate the row
      const rowEl = document.querySelector(`[data-url="${CSS.escape(url)}"]`);
      if (rowEl) {
        rowEl.classList.add('closing');
        await new Promise(resolve => setTimeout(resolve, 140));
      }

      await chrome.tabs.remove(tabIdsToClose);
      tabIdsToClose.forEach(tabId => dispatch({ type: 'TAB_REMOVED', tabId }));
      log(`✅ Closed ${tabIdsToClose.length} duplicates of ${url}`);
      lastClosedCount = tabIdsToClose.length;
      undoContext = 'duplicates';
      showUndoButton('duplicates', `Closed ${tabIdsToClose.length} duplicate tab${tabIdsToClose.length === 1 ? '' : 's'}`);
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
  if (tab.audible) {
    item.classList.add('is-audible');
  }
  if (tab.active) {
    item.classList.add('is-current');
  }
  if (tab.pinned) {
    item.classList.add('is-pinned');
  }
  if (tab.discarded) {
    item.classList.add('is-discarded');
  }
  item.dataset.tabId = tab.id;
  item.dataset.windowId = tab.windowId;
  item.style.setProperty('--item-index', index);

  // Favicon
  const favicon = createFaviconElement(tab.favIconUrl);

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
    const tab = getTab(appState, tabId);
    if (!tab) return;

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

      await new Promise(resolve => setTimeout(resolve, 140));
    }

    // Now remove the tab from Chrome
    await chrome.tabs.remove(tabId);
    dispatch({ type: 'TAB_REMOVED', tabId });
    log(`✅ Closed tab ${tabId}`);
    lastClosedCount = 1;
    undoContext = 'tab';
    showUndoButton('tab');

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
    const tabs = getScopedTabs(appState);
    const duplicates = getDuplicateTabs(appState);

    if (duplicates.length === 0) {
      return;
    }
    const tabsToClose = getTabsToCloseForAllDuplicates(appState);
    pinnedDuplicatesSkipped = settings.protectPinned ? duplicates.filter(tab => tab.pinned).length : 0;
    groupedDuplicatesSkipped = settings.protectGroups ? duplicates.filter(tab => tab.groupId !== -1 && tab.groupId !== undefined).length : 0;
    browserTabsSkipped = duplicates.filter(tab => isBrowserUrl(tab.url)).length;

    // Get tab IDs to close
    const tabIdsToClose = tabsToClose.map(tab => tab.id);

    if (tabIdsToClose.length > 0) {
      const closedCount = tabIdsToClose.length;
      await chrome.tabs.remove(tabIdsToClose);
      tabIdsToClose.forEach(tabId => dispatch({ type: 'TAB_REMOVED', tabId }));
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
    const tabsToClose = filterCloseableTabs(appState, getSearchResults(appState).map(({ tab }) => tab));

    const tabIdsToClose = tabsToClose.map(tab => tab.id);
    if (tabIdsToClose.length === 0) {
      await loadAndRender();
      return;
    }

    const closedCount = tabIdsToClose.length;
    await chrome.tabs.remove(tabIdsToClose);
    tabIdsToClose.forEach(tabId => dispatch({ type: 'TAB_REMOVED', tabId }));
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
  dispatch({ type: 'SET_DOMAIN_FILTER', domain });

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
  dispatch({ type: 'SET_DOMAIN_FILTER', domain: null });
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
  tabs = getScopedTabs(appState);
  duplicates = getDuplicateTabs(appState);
  syncLegacyStateFromStore();
  // Play the staggered slide-in only on the first render (initial popup open).
  // Re-renders (closing a tab, sorting, etc.) skip it so the list doesn't
  // re-animate every item — which is disruptive when a small group collapses.
  document.body.classList.toggle('no-stagger', hasRenderedOnce);
  hasRenderedOnce = true;

  // Save scroll positions before re-rendering
  const scrollPositions = {
    duplicates: duplicatesContentEl.scrollTop,
    allTabs: allTabsContentEl.scrollTop,
    domainSections: domainSectionsContainer.scrollTop
  };

  const stateSearchResults = getSearchResults(appState);
  if (searchQuery) {
    searchResults = new Map(stateSearchResults.map(({ tab, match }) => [tab.id, match]));
    document.body.classList.add('search-active');
    document.body.classList.add('searching');
    document.body.dataset.searchQuery = searchQuery;
  } else {
    searchResults = null;
    document.body.classList.remove('search-active');
    document.body.classList.remove('searching');
    delete document.body.dataset.searchQuery;
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
    searchResultsContainerEl.querySelector('.section-title').textContent = `${searchResults.size} match${searchResults.size === 1 ? '' : 'es'}`;
    closeSearchResultsBtn.classList.remove('hidden');
    moveSearchResultsBtn.classList.remove('hidden');

    // Use cached single-pass computation
    const { urlCounts } = computeRenderData(tabs);

    // Sort results by score (descending - best matches first)
    const sortedResults = stateSearchResults;

    // Track tab IDs for keyboard navigation
    searchResultTabIds = sortedResults.map(r => r.tab.id);

    // Render search results
    sortedResults.forEach(({ tab, match }, index) => {
      const count = urlCounts.get(normalizeUrl(tab.url, settings.matchMode)) || 0;
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
    searchResultsContainerEl.querySelector('.section-title').textContent = 'No matches';
    searchResultTabIds = [];
    highlightedResultIndex = -1;
    closeSearchResultsBtn.classList.add('hidden');
    moveSearchResultsBtn.classList.add('hidden');
  } else {
    // Hide search results section when not searching
    searchResultsContainerEl.classList.add('hidden');
    searchResultTabIds = [];
    highlightedResultIndex = -1;
    closeSearchResultsBtn.classList.add('hidden');
    moveSearchResultsBtn.classList.add('hidden');
  }

  const urlCounts = getUrlCounts(appState);
  const domainGroups = getDomainGroups(appState);

  // Update stats
  totalTabsEl.textContent = tabs.length;
  duplicateCountEl.textContent = duplicates.length;
  domainCountEl.textContent = domainGroups.length;
  statsSummaryEl.textContent = `${tabs.length} tabs · ${duplicates.length} duplicates · ${domainGroups.length} domains`;
  document.body.classList.toggle('has-duplicates', duplicates.length > 0);

  // Track playing media without duplicating audible tabs outside their normal list positions.
  const audibleTabs = getPlayingTabs(appState);
  mediaSectionCountEl.textContent = audibleTabs.length;
  mediaListEl.innerHTML = '';
  mediaContainerEl.classList.add('hidden');
  document.body.classList.toggle('has-media', audibleTabs.length > 0);
  if (audibleTabs.length > 0) {
    document.body.dataset.mediaCount = audibleTabs.length;
    browseTabsEl.dataset.mediaCount = audibleTabs.length;
  } else {
    delete document.body.dataset.mediaCount;
    delete browseTabsEl.dataset.mediaCount;
  }

  // Update section counts using the primary duplicate metric: redundant tabs that can be closed.
  duplicatesSectionCountEl.textContent = duplicates.length;

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
  duplicatesSortButtonsEl.classList.toggle('hidden', !duplicateReviewOpen);

  // Clear lists
  duplicateListEl.innerHTML = '';
  allTabsListEl.innerHTML = '';

  // Render duplicates section
  if (duplicates.length === 0) {
    duplicateReviewOpen = false;
    document.body.classList.remove('duplicate-review-open');
    duplicatesSummaryPrimaryEl.textContent = '00';
    duplicatesSummarySecondaryEl.textContent = 'duplicates';
    // Show empty state
    duplicateListEl.style.display = 'none';
    reviewDuplicatesBtn.classList.add('hidden');
    exitDuplicatesReviewBtn.classList.add('hidden');
    emptyStateEl.style.display = 'block';
    pinnedWarningEl.classList.add('hidden');
    browserWarningEl.classList.add('hidden');
    pinnedDuplicatesSkipped = 0;
    groupedDuplicatesSkipped = 0;
    browserTabsSkipped = 0;
  } else {
    // Show duplicates
    duplicateListEl.style.display = duplicateReviewOpen ? 'flex' : 'none';
    document.body.classList.toggle('duplicate-review-open', duplicateReviewOpen);
    reviewDuplicatesBtn.classList.toggle('hidden', duplicateReviewOpen);
    exitDuplicatesReviewBtn.classList.toggle('hidden', !duplicateReviewOpen);
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

    let groupedDuplicates = getDuplicateGroups(appState);
    duplicatesSummaryPrimaryEl.textContent = `${duplicates.length} duplicate${duplicates.length === 1 ? '' : 's'}`;
    duplicatesSummarySecondaryEl.textContent = `${groupedDuplicates.length} group${groupedDuplicates.length === 1 ? '' : 's'}`;

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
  document.body.classList.toggle('has-domain-filter', Boolean(activeDomain));
  let visibleTabs = getVisibleTabs(appState);

  // Update all tabs section count
  allTabsSectionCountEl.textContent = visibleTabs.length;

  // Render all tabs as flat list (sortable)
  visibleTabs.forEach((tab, index) => {
    const count = urlCounts.get(normalizeUrl(tab.url, settings.matchMode)) || 0;
    const item = createTabItem(tab, count, index, null);
    allTabsListEl.appendChild(item);
  });

  // Render domain sections (for domains with 3+ tabs)
  domainSectionsContainer.innerHTML = '';

  const largeDomains = getLargeDomainGroups(appState);

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

  document.body.classList.toggle('browse-domains', browseView === 'domains');
  document.body.classList.toggle('browse-tabs-view', browseView === 'tabs');
  browseTabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === browseView));
  exitDuplicatesReviewBtn.classList.toggle('hidden', !duplicateReviewOpen);

  // Restore scroll positions after DOM updates
  requestAnimationFrame(() => {
    duplicatesContentEl.scrollTop = scrollPositions.duplicates;
    allTabsContentEl.scrollTop = scrollPositions.allTabs;
    domainSectionsContainer.scrollTop = scrollPositions.domainSections;
    restoreSelectedItem();
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
    clearRenderCache();
    const tabs = getScopedTabs(appState);
    const duplicates = getDuplicateTabs(appState);

    log(`📊 Rendered ${tabs.length} tabs (${appState.scope.type === 'window' ? `window ${appState.scope.windowId}` : 'all windows'}), ${duplicates.length} duplicates`);

    render(tabs, duplicates);
  } catch (err) {
    error('❌ Error loading tabs:', err);
  }
}

async function refreshBrowserSnapshot({ currentWindowOnly = settings.currentWindowOnly } = {}) {
  const [tabs, activeTabs] = await Promise.all([
    chrome.tabs.query({}),
    chrome.tabs.query({ active: true, currentWindow: true })
  ]);
  const focusedWindowId = activeTabs[0]?.windowId ?? null;

  dispatch({
    type: 'SET_BROWSER_SNAPSHOT',
    tabs,
    focusedWindowId,
    currentWindowOnly
  });
}

async function reconcileTabFromChrome(tabId, eventType = 'TAB_UPDATED') {
  try {
    const tab = await chrome.tabs.get(tabId);
    dispatch({ type: eventType, tab });
    loadAndRender();
  } catch (err) {
    dispatch({ type: 'TAB_REMOVED', tabId });
    loadAndRender();
  }
}

function attachChromeEventListeners() {
  chrome.tabs.onCreated?.addListener((tab) => {
    dispatch({ type: 'TAB_CREATED', tab });
    loadAndRender();
  });

  chrome.tabs.onUpdated?.addListener((tabId, changeInfo, tab) => {
    dispatch({ type: 'TAB_UPDATED', tab: { ...(getTab(appState, tabId) || {}), ...tab, ...changeInfo, id: tabId } });
    loadAndRender();
  });

  chrome.tabs.onRemoved?.addListener((tabId) => {
    dispatch({ type: 'TAB_REMOVED', tabId });
    loadAndRender();
  });

  chrome.tabs.onMoved?.addListener((tabId) => {
    reconcileTabFromChrome(tabId, 'TAB_MOVED');
  });

  chrome.tabs.onAttached?.addListener((tabId) => {
    reconcileTabFromChrome(tabId, 'TAB_ATTACHED');
  });

  chrome.tabs.onDetached?.addListener((tabId) => {
    dispatch({ type: 'TAB_DETACHED', tabId });
    loadAndRender();
  });

  chrome.tabs.onReplaced?.addListener((addedTabId, removedTabId) => {
    dispatch({ type: 'TAB_REMOVED', tabId: removedTabId });
    reconcileTabFromChrome(addedTabId, 'TAB_REPLACED');
  });

  chrome.windows.onFocusChanged?.addListener((windowId) => {
    dispatch({ type: 'WINDOW_FOCUS_CHANGED', windowId });
    loadAndRender();
  });
}

// Event Listeners
closeAllBtn.addEventListener('click', closeAllDuplicates);
reviewDuplicatesBtn.addEventListener('click', () => {
  dispatch({ type: 'SET_DUPLICATE_REVIEW', open: true });
  applySectionStates();
  saveSectionStates();
  loadAndRender();
});
exitDuplicatesReviewBtn.addEventListener('click', () => {
  dispatch({ type: 'SET_DUPLICATE_REVIEW', open: false });
  document.body.classList.remove('duplicate-review-open');
  dispatch({ type: 'SET_CURSOR', cursorId: makeItemId('section', 'duplicates') });
  loadAndRender();
});
closeSearchResultsBtn.addEventListener('click', closeAllSearchResults);
moveSearchResultsBtn.addEventListener('click', moveSearchResultsToWindow);

// Global search event listeners
globalSearchInputEl.addEventListener('input', handleSearchInput);
globalSearchClearEl.addEventListener('click', clearSearch);
searchFieldControlsEl.addEventListener('change', (e) => {
  if (e.target.value === 'all') {
    exitSearchMode();
  } else {
    enterSearchMode(e.target.value);
  }
  applySearchModeChange();
  globalSearchInputEl.focus();
});
searchPrecisionControlsEl.addEventListener('change', (e) => {
  dispatch({ type: 'SET_SEARCH_MODE', mode: e.target.value });
  updateSearchPrecisionControls();
  loadAndRender();
  globalSearchInputEl.focus();
});

// Exit field mode by removing the chip
searchModeChipRemoveEl.addEventListener('click', (e) => {
  e.stopPropagation();
  exitSearchMode();
  applySearchModeChange();
  globalSearchInputEl.focus();
});

// Backspace at the very start of an empty caret exits the field mode
globalSearchInputEl.addEventListener('keydown', (e) => {
  if (
    e.key === 'Backspace' &&
    searchField &&
    globalSearchInputEl.selectionStart === 0 &&
    globalSearchInputEl.selectionEnd === 0
  ) {
    e.preventDefault();
    exitSearchMode();
    applySearchModeChange();
  }
});

// Keyboard shortcuts for search
document.addEventListener('keydown', (e) => {
  const activeTag = document.activeElement?.tagName;
  const isTextInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

  // Focus search with '/' key (when not in an input)
  if (e.key === '/' && !isTextInput) {
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

  if (document.activeElement === globalSearchInputEl && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    const items = getVisibleActionItems();
    if (items.length > 0) {
      e.preventDefault();
      globalSearchInputEl.blur();

      const searchItems = items.filter(item => item.zone === 'search');
      const targetItems = searchItems.length > 0 ? searchItems : items;
      const target = e.key === 'ArrowDown' ? targetItems[0] : targetItems[targetItems.length - 1];
      dispatch({ type: 'SET_CURSOR', cursorId: target.id, focusZone: 'content' });
      applyCursorToDom();
    }
    return;
  }

  // Clear search with Escape (when search is focused)
  if (e.key === 'Escape' && document.activeElement === globalSearchInputEl) {
    if (searchQuery || searchField) {
      e.preventDefault();
      clearSearch();
    }
    globalSearchInputEl.blur();
    return;
  }

  if (document.activeElement === globalSearchInputEl && e.key === 'Enter' && highlightedResultIndex >= 0) {
    e.preventDefault();
    switchToHighlightedResult();
    return;
  }

  if (!isTextInput) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undoClose();
      return;
    }

    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (e.key === 'ArrowDown') {
        const items = getVisibleActionItems();
        if (items.length > 0 && selectedItemIndex >= items.length - 1) {
          dispatch({ type: 'SET_CURSOR', cursorId: null, focusZone: 'search' });
          applyCursorToDom();
          globalSearchInputEl.focus();
          return;
        }
      }
      dispatch({ type: 'NAVIGATE_NEXT' });
      applyCursorToDom();
      return;
    }

    if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (e.key === 'ArrowUp' && selectedItemIndex <= 0) {
        dispatch({ type: 'SET_CURSOR', cursorId: null, focusZone: 'search' });
        applyCursorToDom();
        globalSearchInputEl.focus();
        return;
      }
      dispatch({ type: 'NAVIGATE_PREVIOUS' });
      applyCursorToDom();
      return;
    }

    if (e.key === 'ArrowLeft') {
      if (selectOwningDomainHeader()) {
        e.preventDefault();
        return;
      }
      if (selectParentSectionHeader()) {
        e.preventDefault();
        return;
      }
      if (setSelectedHeaderExpanded(false)) {
        e.preventDefault();
        return;
      }
    }

    if (e.key === 'ArrowRight') {
      if (setSelectedHeaderExpanded(true)) {
        e.preventDefault();
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      activateSelectedItem();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      closeSelectedItem();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      globalSearchInputEl.focus();
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
    e.preventDefault();
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
  if (settings.currentWindowOnly) {
    await refreshBrowserSnapshot({ currentWindowOnly: true });
  } else {
    dispatch({ type: 'SET_SCOPE', scope: { type: 'all' } });
  }
  updateScopeButton();
  loadAndRender();
});

/**
 * Updates the scope button visibility and appearance based on settings.
 */
function updateScopeButton() {
  if (settings.currentWindowOnly) {
    scopeLabel.textContent = 'This window';
    scopeBtn.title = 'Current window only - click to switch to all windows';
    scopeBtn.classList.add('active');
  } else {
    scopeLabel.textContent = 'All windows';
    scopeBtn.title = 'All windows - click to switch to current window only';
    scopeBtn.classList.remove('active');
  }
}

browseTabsEl.addEventListener('click', (e) => {
  const button = e.target.closest('.browse-tab');
  if (!button) return;
  dispatch({ type: 'SET_VIEW', view: button.dataset.view });
  dispatch({ type: 'SET_CURSOR', cursorId: makeItemId('view', button.dataset.view) });
  loadAndRender();
});

// Sort button group event listener (All Tabs section)
sortButtonsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-toggle');
  if (btn && btn.dataset.sort) {
    dispatch({ type: 'SET_SORT', area: 'tabs', sort: btn.dataset.sort });
    loadAndRender();
  }
});

// Sort button group event listener (Duplicates section)
duplicatesSortButtonsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-toggle');
  if (btn && btn.dataset.sort) {
    dispatch({ type: 'SET_SORT', area: 'duplicates', sort: btn.dataset.sort });
    loadAndRender();
  }
});

// Sort button group event listener (Domain sections)
domainSortButtonsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-toggle');
  if (btn && btn.dataset.sort) {
    dispatch({ type: 'SET_SORT', area: 'domains', sort: btn.dataset.sort });
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
  await refreshBrowserSnapshot({ currentWindowOnly: settings.currentWindowOnly });
  updateScopeButton();
  initFooter();
  attachChromeEventListeners();
  loadAndRender();
})();
