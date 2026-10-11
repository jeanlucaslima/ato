// ATO Popup Script
// Displays duplicate tabs and handles user actions

import {
  normalizeUrl,
  sortAudibleFirst
} from '../engine/queries.js';
import { createBrowser, createSnapshotStore } from '../engine/browser.js';
import { duplicateSummary } from '../engine/policy.js';
import { applyFont } from '../shared/font-config.js';
import { initLogger, log, error } from '../shared/logger.js';
import {
  getBrowseView,
  isDomainFilterOpen,
  isDuplicateReviewMode,
  isSearchMode
} from './popup-machine.js';
import {
  bindDuplicateGroupListClicks,
  bindTabListClicks
} from './popup-list-events.js';
import { getPopupElements } from './popup-dom.js';
import {
  createDomainSection,
  createGroupedDuplicateItem,
  createTabItem,
  reconcileList
} from './popup-render-elements.js';
import {
  createInitialPopupState,
  getCursorItem,
  getDuplicateGroups,
  getDuplicateTabs,
  getDomainGroups,
  getLargeDomainGroups,
  getPlayingTabs,
  getScopedTabs,
  getSearchResults,
  getSearchNavigationItems,
  getSearchKeyboardNavigationAction,
  getTab,
  getUrlCounts,
  getVisibleNavigationItems as getStateNavigationItems,
  getVisibleTabs,
  isDomainExpanded,
  makeItemId,
  makeTabItemId,
  reducePopupState,
  serializeExpansion
} from './popup-state.js';

log('🎨 ATO popup loaded');

const {
  totalTabsEl,
  duplicateCountEl,
  domainCountEl,
  statsSummaryEl,
  duplicateListEl,
  allTabsListEl,
  emptyStateEl,
  closeAllBtn,
  reviewDuplicatesBtn,
  exitDuplicatesReviewBtn,
  domainFilterInputEl,
  domainFilterClearEl,
  domainFilterDropdownEl,
  sortButtonsEl,
  duplicatesSortButtonsEl,
  undoDuplicatesBtn,
  undoRowEl,
  undoMessageEl,
  pinnedWarningEl,
  pinnedSkipCountEl,
  browserWarningEl,
  browserSkipCountEl,
  optionsBtn,
  scopeBtn,
  scopeLabel,
  globalSearchInputEl,
  globalSearchClearEl,
  searchResultsCountEl,
  searchModeChipEl,
  searchModeChipLabelEl,
  searchModeChipRemoveEl,
  searchFieldControlsEl,
  searchPrecisionControlsEl,
  mediaContainerEl,
  mediaHeaderEl,
  mediaContentEl,
  mediaSectionCountEl,
  mediaListEl,
  duplicatesHeaderEl,
  duplicatesContentEl,
  duplicatesSectionCountEl,
  allTabsHeaderEl,
  allTabsContentEl,
  allTabsSectionCountEl,
  domainSectionsContainer,
  domainSortBarEl,
  domainSortButtonsEl,
  searchResultsContainerEl,
  searchResultsListEl,
  searchResultsSectionCountEl,
  searchEmptyStateEl,
  closeSearchResultsBtn,
  moveSearchResultsBtn,
  browseTabsEl,
  browseTabButtons,
  duplicatesSummaryPrimaryEl,
  duplicatesSummarySecondaryEl
} = getPopupElements();

// Settings (loaded from chrome.storage.sync)
const defaultSettings = {
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
let settings = { ...defaultSettings };

// State
let appState = createInitialPopupState();
const browserStore = createSnapshotStore(createBrowser(), err => error('Browser reconciliation failed:', err));
let browserUnsubscribe = null;
let highlightedOptionIndex = -1; // Track highlighted option in dropdown
let searchDebounceTimer = null;
const SEARCH_DEBOUNCE_MS = 150;

// Field-mode metadata. The prefix is what tab-utils' parseSearchQuery understands;
// the chip mirrors that operator while the placeholder gives a human hint.
const SEARCH_FIELD_PREFIX = { url: 'url', title: 'title' };
const SEARCH_FIELD_PLACEHOLDER = { url: 'Search URLs', title: 'Search titles' };
const DEFAULT_SEARCH_PLACEHOLDER = 'Find a tab';
// Undo state
let lastClosedCount = 0;        // Number of tabs closed (for undo)
let lastOperationId = null;
let actionPending = false;
let undoMessage = '';

function dispatch(action) {
  appState = reducePopupState(appState, action);
  if (['SET_VIEW', 'SET_SORT', 'NAVIGATE_CHILD'].includes(action.type)) {
    chrome.storage.local.set({ browsePreferences: { view: appState.view.type, sort: appState.sort } })
      .catch(err => error('Could not save browse preferences:', err));
  }
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
 * Handles search input changes with debouncing. Also detects a field-mode
 * prefix (`url:`, `title:`, or a legacy alias) typed at the start of the input and converts
 * it into a mode chip so only the bare term remains in the box.
 */
function handleSearchInput(e) {
  let query = e.target.value;

  // Convert a typed prefix into a mode chip (only when not already in a mode).
  if (appState.search.field === 'all') {
    const prefixMatch = /^(url|title|inurl|intitle):/i.exec(query);
    if (prefixMatch) {
      const prefix = prefixMatch[1].toLowerCase();
      enterSearchMode(prefix === 'url' || prefix === 'inurl' ? 'url' : 'title');
      query = query.slice(prefixMatch[0].length);
      e.target.value = query;
    }
  }

  // Show/hide clear button (also visible when a mode is active with no term)
  globalSearchClearEl.classList.toggle('hidden', !query && appState.search.field === 'all');

  // Query identity changes immediately; only rendering is debounced.
  dispatch({ type: 'SET_SEARCH_QUERY', query });
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
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
  searchFieldControlsEl.value = appState.search.field;
}

function updateSearchPrecisionControls() {
  searchPrecisionControlsEl.value = appState.search.mode;
}

/**
 * Re-runs the search after a mode change driven by the menu/chip (not typing),
 * keeping any already-typed term and syncing the clear button.
 */
function applySearchModeChange() {
  dispatch({ type: 'SET_SEARCH_QUERY', query: globalSearchInputEl.value });
  globalSearchClearEl.classList.toggle('hidden', !appState.search.query && appState.search.field === 'all');
  loadAndRender();
}

/**
 * Clears the search and resets results (including any active field mode).
 */
function clearSearch() {
  clearTimeout(searchDebounceTimer);
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

function restoreSelectedItem() {
  applyCursorToDom();
}

function domElementForItemId(cursorId) {
  if (!cursorId) return null;
  if (cursorId.startsWith('tab:')) {
    return document.querySelector(`[data-nav-id="${CSS.escape(cursorId)}"]`);
  }
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
  return null;
}

function applyCursorToDom() {
  document.querySelectorAll('.browse-tab.selected, .tab-item.selected, .section-header.selected, .btn-action.selected, .tab-item.highlighted')
    .forEach(item => item.classList.remove('selected', 'highlighted'));

  const element = domElementForItemId(appState.navigation.cursorId);
  if (!element) {
    if (appState.navigation.focusZone === 'search' && document.activeElement === document.body) {
      globalSearchInputEl.focus();
    }
    return;
  }
  element.classList.add('selected');
  if (element.classList.contains('tab-item') && appState.search.query) {
    element.classList.add('highlighted');
  }
  element.scrollIntoView({ block: 'nearest' });
  if (appState.navigation.focusZone === 'content' && document.activeElement !== globalSearchInputEl) {
    (element.querySelector('.tab-main') || element).focus({ preventScroll: true });
  }
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

  if (item.type === 'tab') closeTab(item.tabId, item.id);
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
  if (!appState.search.query) {
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
    const result = await chrome.storage.local.get(['sectionStates', 'domainSectionStates', 'browsePreferences']);
    dispatch({ type: 'RESTORE_PREFERENCES', preferences: result.browsePreferences });
    dispatch({
      type: 'SET_EXPANSION',
      sectionStates: result.sectionStates,
      domainSectionStates: result.domainSectionStates
    });
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
    const result = await chrome.storage.sync.get(defaultSettings);
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
  mediaHeaderEl.setAttribute('aria-expanded', appState.expansion.sections.media);
  mediaContentEl.classList.toggle('collapsed', !appState.expansion.sections.media);

  // Duplicates section
  duplicatesHeaderEl.setAttribute('aria-expanded', appState.expansion.sections.duplicates);
  duplicatesContentEl.classList.toggle('collapsed', !appState.expansion.sections.duplicates);

  // All Tabs section
  allTabsHeaderEl.setAttribute('aria-expanded', appState.expansion.sections.allTabs);
  allTabsContentEl.classList.toggle('collapsed', !appState.expansion.sections.allTabs);
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
  undoMessageEl.textContent = 'Ready';
  undoMessage = '';
}

function undoMessageForContext(context, count) {
  if (context === 'duplicates') return `Closed ${count} duplicate tab${count === 1 ? '' : 's'}`;
  if (context === 'search') return `Closed ${count} search result${count === 1 ? '' : 's'}`;
  if (context === 'tab') return `Closed ${count} tab${count === 1 ? '' : 's'}`;
  if (context === 'domain') return `Closed ${count} domain tab${count === 1 ? '' : 's'}`;
  return `Closed ${count} tab${count === 1 ? '' : 's'}`;
}

async function sendCommand(command) {
  const response = await chrome.runtime.sendMessage({ action: 'tabEngine', command });
  if (!response || response.error) throw new Error(response?.error || 'No response from tab engine');
  return response.result;
}

// Presentation owns animation and feedback, never browser mutation policy.
async function performAction(command, context, element = null) {
  if (actionPending) return;
  actionPending = true;
  try {
    if (element) {
      element.classList.add('closing');
      await new Promise(resolve => setTimeout(resolve, 140));
    }
    const result = await sendCommand({ ...command, scope: { ...appState.scope } });
    if (command.type === 'move') {
      if (result.succeeded.length) {
        lastClosedCount = 0;
        lastOperationId = null;
        hideAllUndoButtons();
      }
    } else if (result.succeeded.length) {
      lastClosedCount = result.succeeded.length;
      lastOperationId = result.operationId;
      showUndoButton(context);
      undoDuplicatesBtn.disabled = !lastOperationId;
    }
    await refreshBrowserSnapshot();
    const status = `${result.succeeded.length} ${command.type === 'move' ? 'moved' : 'closed'} · ${result.skipped.length} skipped · ${result.failed.length} failed`;
    if (result.failed.length || result.skipped.length) {
      undoRowEl.classList.remove('hidden');
      undoMessageEl.textContent = status;
    }
    log('Tab engine result:', result);
  } catch (err) {
    error('Tab action failed:', err);
    undoRowEl.classList.remove('hidden');
    undoMessageEl.textContent = `Action failed: ${err.message}`;
  } finally {
    element?.classList.remove('closing');
    actionPending = false;
    loadAndRender();
  }
}

async function undoClose() {
  if (!lastOperationId || actionPending) return;
  actionPending = true;
  try {
    const result = await sendCommand({ type: 'undo', operationId: lastOperationId });
    lastClosedCount = result.failed.length;
    undoDuplicatesBtn.disabled = !result.failed.length;
    undoMessageEl.textContent = `${result.restored.length} restored · ${result.recreated.length} reopened by URL · ${result.failed.length} failed`;
    if (!result.failed.length) lastOperationId = null;
    await refreshBrowserSnapshot();
  } catch (err) {
    error('Undo failed:', err);
    undoMessageEl.textContent = `Undo failed: ${err.message}`;
  } finally {
    actionPending = false;
  }
}

function closeTabsFromDomain(domain) {
  return performAction({ type: 'close', domain }, 'domain');
}

function moveTabsFromDomainToWindow(domain) {
  return performAction({ type: 'move', domain }, 'domain');
}

function moveSearchResultsToWindow() {
  return performAction({ type: 'move', targets: getSearchResults(appState).map(({ tab }) => tab) }, 'search');
}

function closeDuplicatesOfUrl(url) {
  const row = duplicateListEl.querySelector(`[data-url="${CSS.escape(url)}"]`);
  return performAction({ type: 'close-duplicates', url }, 'duplicates', row);
}

function switchToTab(tabId) {
  sendCommand({ type: 'activate', tabId }).catch(err => error('Activation failed:', err));
}

function closeTab(tabId, navigationId = null) {
  const tab = getTab(appState, tabId);
  if (!tab) return;
  const row = navigationId
    ? document.querySelector(`[data-nav-id="${CSS.escape(navigationId)}"]`)
    : document.querySelector(`[data-tab-id="${tabId}"]`);
  // Explicit single-tab close retains its existing opt-in semantics (including current/pinned tabs).
  return performAction({ type: 'close', targets: [tab], single: true }, 'tab', row);
}

function closeAllDuplicates() {
  return performAction({ type: 'close-duplicates' }, 'duplicates');
}

function closeAllSearchResults() {
  return performAction({ type: 'close', targets: getSearchResults(appState).map(({ tab }) => tab) }, 'search');
}

// Render domain filter
function renderDomainFilter() {
  const domainGroups = getDomainGroups(appState);
  const activeDomain = appState.filters.domain;

  // Update input value if domain is selected
  if (activeDomain) {
    const selectedGroup = domainGroups.find(g => g.domain === activeDomain);
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

  const activeDomain = appState.filters.domain;
  const filteredDomains = getDomainGroups(appState).filter(({ domain }) =>
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
  const query = appState.filters.domain ? '' : domainFilterInputEl.value;
  renderDomainDropdownOptions(query);
  dispatch({ type: 'OPEN_DOMAIN_FILTER' });
  domainFilterDropdownEl.classList.remove('hidden');
}

// Hide dropdown
function hideDomainDropdown() {
  dispatch({ type: 'CLOSE_DOMAIN_FILTER' });
  domainFilterDropdownEl.classList.add('hidden');
}

/**
 * Renders the complete popup UI.
 * Updates stats, domain filter, duplicate list, all tabs list, and domain sections.
 *
 */
function render() {
  const tabs = getScopedTabs(appState);
  const duplicates = getDuplicateTabs(appState);
  const duplicateInfo = duplicateSummary(tabs, settings, appState.browser.focusedWindowId);
  const searching = isSearchMode(appState.ui.machine);
  const duplicateReviewOpen = isDuplicateReviewMode(appState.ui.machine);
  const browseView = getBrowseView(appState.ui.machine);
  // Save scroll positions before re-rendering
  const scrollPositions = {
    working: document.querySelector('#working-surface').scrollTop
  };

  const stateSearchResults = searching ? getSearchResults(appState) : [];
  const urlCounts = getUrlCounts(appState);
  if (searching) {
    document.body.classList.add('search-active');
    document.body.classList.add('searching');
    document.body.dataset.searchQuery = appState.search.query;
  } else {
    document.body.classList.remove('search-active');
    document.body.classList.remove('searching');
    delete document.body.dataset.searchQuery;
  }

  // Update search results count
  updateSearchResultsCount(
    stateSearchResults.length,
    tabs.length
  );

  // Handle search results section
  if (stateSearchResults.length > 0) {
    searchResultsContainerEl.classList.remove('hidden');
    searchEmptyStateEl.classList.add('hidden');
    searchResultsSectionCountEl.textContent = stateSearchResults.length;
    searchResultsContainerEl.querySelector('.section-title').textContent = `${stateSearchResults.length} match${stateSearchResults.length === 1 ? '' : 'es'}`;
    closeSearchResultsBtn.classList.remove('hidden');
    moveSearchResultsBtn.classList.remove('hidden');

    // Sort results by score (descending - best matches first)
    const sortedResults = stateSearchResults;

    // Render search results
    reconcileList(searchResultsListEl, sortedResults.map(({ tab, match }, index) => {
      const count = urlCounts.get(normalizeUrl(tab.url, appState.matchMode || 'exact')) || 0;
      return createTabItem(tab, count, index, match, makeTabItemId('search', tab.id), { selected: appState.selection.tabIds.has(tab.id) });
    }));
  } else if (appState.search.query) {
    // Show empty state for search
    searchResultsContainerEl.classList.remove('hidden');
    searchEmptyStateEl.classList.remove('hidden');
    searchResultsListEl.innerHTML = '';
    searchResultsSectionCountEl.textContent = '0';
    searchResultsContainerEl.querySelector('.section-title').textContent = 'No matches';
    closeSearchResultsBtn.classList.add('hidden');
    moveSearchResultsBtn.classList.add('hidden');
  } else {
    // Hide search results section when not searching
    searchResultsContainerEl.classList.add('hidden');
    closeSearchResultsBtn.classList.add('hidden');
    moveSearchResultsBtn.classList.add('hidden');
  }

  const domainGroups = getDomainGroups(appState);

  // Update stats
  totalTabsEl.textContent = tabs.length;
  duplicateCountEl.textContent = duplicates.length;
  domainCountEl.textContent = domainGroups.length;
  statsSummaryEl.textContent = `${tabs.length} tabs`;
  document.querySelector('#working-surface').setAttribute('aria-busy', 'false');
  document.querySelector('#browser-empty-state').classList.toggle('hidden', tabs.length > 0 || searching);
  document.querySelector('#browser-empty-state').textContent = 'No tabs in scope';
  document.body.classList.toggle('has-duplicates', duplicates.length > 0);

  // The badge and section report raw redundancy; action labels report eligible cleanup.
  duplicatesSectionCountEl.textContent = duplicates.length;

  // Render domain filter
  renderDomainFilter();

  // Enable/disable close all duplicates button
  closeAllBtn.disabled = duplicateInfo.actionableCount === 0 || actionPending;
  closeAllBtn.title = `${duplicates.length} duplicates · ${duplicateInfo.actionableCount} can be closed`;

  // Update sort button active states
  sortButtonsEl.querySelectorAll('.btn-toggle').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === appState.sort.tabs);
  });

  // Update duplicate sort button active states
  duplicatesSortButtonsEl.querySelectorAll('.btn-toggle').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === appState.sort.duplicate);
  });
  duplicatesSortButtonsEl.classList.toggle('hidden', !duplicateReviewOpen);

  // Render duplicates section
  if (duplicates.length === 0) {
    if (duplicateReviewOpen) dispatch({ type: 'SET_DUPLICATE_REVIEW', open: false });
    document.body.classList.remove('duplicate-review-open');
    duplicatesSummaryPrimaryEl.textContent = 'No duplicates';
    duplicatesSummarySecondaryEl.textContent = 'Nothing to clean up';
    // Show empty state
    duplicateListEl.style.display = 'none';
    reviewDuplicatesBtn.classList.remove('hidden');
    reviewDuplicatesBtn.disabled = true;
    exitDuplicatesReviewBtn.classList.add('hidden');
    emptyStateEl.style.display = 'block';
    pinnedWarningEl.classList.add('hidden');
    browserWarningEl.classList.add('hidden');
  } else {
    // Show duplicates
    duplicateListEl.style.display = duplicateReviewOpen ? 'block' : 'none';
    document.body.classList.toggle('duplicate-review-open', duplicateReviewOpen);
    reviewDuplicatesBtn.classList.remove('hidden');
    reviewDuplicatesBtn.disabled = actionPending;
    exitDuplicatesReviewBtn.classList.toggle('hidden', !duplicateReviewOpen);
    emptyStateEl.style.display = 'none';

    const parts = [];
    if (duplicateInfo.pinned) parts.push(`${duplicateInfo.pinned} pinned`);
    if (duplicateInfo.grouped) parts.push(`${duplicateInfo.grouped} grouped`);
    pinnedSkipCountEl.textContent = parts.join(', ');
    pinnedWarningEl.classList.toggle('hidden', !parts.length);
    browserSkipCountEl.textContent = duplicateInfo.internal;
    browserWarningEl.classList.toggle('hidden', !duplicateInfo.internal);

    let groupedDuplicates = getDuplicateGroups(appState);
    duplicatesSummaryPrimaryEl.textContent = `${duplicates.length} duplicate${duplicates.length === 1 ? '' : 's'}`;
    duplicatesSummarySecondaryEl.textContent = `${duplicateInfo.actionableCount} removable · ${groupedDuplicates.length} set${groupedDuplicates.length === 1 ? '' : 's'}`;

    // Render each grouped duplicate
    if (duplicateReviewOpen && !searching) reconcileList(duplicateListEl, groupedDuplicates.map((group, index) => createGroupedDuplicateItem(group, index)));
  }

  // Render all tabs section
  // Filter out chrome:// and edge:// pages
  document.body.classList.toggle('has-domain-filter', Boolean(appState.filters.domain));
  let visibleTabs = getVisibleTabs(appState);

  // Update all tabs section count
  allTabsSectionCountEl.textContent = visibleTabs.length;

  // Render all tabs as flat list (sortable)
  if (!searching && !duplicateReviewOpen && browseView === 'tabs') reconcileList(allTabsListEl, visibleTabs.map((tab, index) => {
    const count = urlCounts.get(normalizeUrl(tab.url, appState.matchMode || 'exact')) || 0;
    return createTabItem(tab, count, index, null, makeTabItemId('tabs', tab.id), {
      selected: appState.selection.tabIds.has(tab.id), showRecency: appState.sort.tabs === 'age'
    });
  }));

  const largeDomains = getLargeDomainGroups(appState);

  // Show/hide domain sort bar based on whether there are domain sections
  domainSortBarEl.classList.toggle('hidden', largeDomains.length === 0);

  // Update active state and labels on domain sort buttons
  domainSortButtonsEl.querySelectorAll('.btn-toggle').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === appState.sort.domainSection);
    if (btn.dataset.sort === 'name') {
      btn.textContent = appState.sort.domainNameDirection === 'az' ? 'A-Z' : 'Z-A';
    } else if (btn.dataset.sort === 'count') {
      btn.textContent = appState.sort.domainCountDirection === 'most' ? 'Most' : 'Few';
    }
  });

  // Render each domain section
  if (!searching && !duplicateReviewOpen && browseView === 'domains') reconcileList(domainSectionsContainer, largeDomains.map(({ domain, tabs: domainTabs }) => {
    const section = createDomainSection(domain, domainTabs, urlCounts, {
      isExpanded: isDomainExpanded(appState, domain),
      matchMode: settings.matchMode,
      onToggleDomain: toggleDomainSection,
      onMoveDomain: moveTabsFromDomainToWindow,
      onCloseDomain: closeTabsFromDomain,
      selectedIds: appState.selection.tabIds
    });
    section.dataset.domain = domain;
    return section;
  }));

  document.body.classList.toggle('browse-domains', browseView === 'domains');
  document.body.classList.toggle('browse-tabs-view', browseView === 'tabs');
  browseTabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === browseView);
    btn.setAttribute('aria-pressed', btn.dataset.view === browseView);
  });
  exitDuplicatesReviewBtn.classList.toggle('hidden', !duplicateReviewOpen);

  // Restore scroll positions after DOM updates
  requestAnimationFrame(() => {
    document.querySelector('#working-surface').scrollTop = scrollPositions.working;
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
    const tabs = getScopedTabs(appState);
    const duplicates = getDuplicateTabs(appState);

    log(`📊 Rendered ${tabs.length} tabs (${appState.scope.type === 'window' ? `window ${appState.scope.windowId}` : 'all windows'}), ${duplicates.length} duplicates`);

    render();
  } catch (err) {
    error('❌ Error loading tabs:', err);
  }
}

async function refreshBrowserSnapshot() {
  applyBrowserSnapshot(await browserStore.refresh());
}

function applyBrowserSnapshot({ tabs, focusedWindowId }) {
  dispatch({ type: 'SET_BROWSER_SNAPSHOT', tabs, focusedWindowId });
  dispatch({ type: 'SET_SCOPE', scope: settings.currentWindowOnly
    ? { type: 'window', windowId: focusedWindowId } : { type: 'all' } });
  updateScopeButton();
}

function attachChromeEventListeners() {
  browserUnsubscribe = browserStore.subscribe(snapshot => {
    applyBrowserSnapshot(snapshot);
    loadAndRender();
  });
  const onSettingsChanged = (changes, area) => {
    if (area !== 'sync') return;
    for (const key of Object.keys(settings)) {
      if (changes[key]) settings[key] = changes[key].newValue ?? defaultSettings[key];
    }
    dispatch({ type: 'SET_SETTINGS', settings: { ...settings,
      defaultBrowseView: changes.defaultBrowseView ? settings.defaultBrowseView : undefined,
      defaultSearchMode: changes.defaultSearchMode ? settings.defaultSearchMode : undefined } });
    applyTheme(settings.theme);
    applyFont(settings.fontFamily);
    updateSearchPrecisionControls();
    applyBrowserSnapshot(browserStore.getSnapshot());
    loadAndRender();
  };
  chrome.storage.onChanged.addListener(onSettingsChanged);
  window.addEventListener('pagehide', () => {
    browserUnsubscribe?.();
    browserStore.dispose();
    chrome.storage.onChanged.removeListener(onSettingsChanged);
    clearTimeout(searchDebounceTimer);
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
    appState.search.field !== 'all' &&
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
  if (e.defaultPrevented || e.isComposing) return;
  const activeTag = document.activeElement?.tagName;
  const isTextInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT' || document.activeElement?.isContentEditable;

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
    e.preventDefault();
    clearTimeout(searchDebounceTimer);
    render();

    if (appState.search.query.trim()) {
      const items = getSearchNavigationItems(appState);
      if (items.length === 0) return;

      const target = e.key === 'ArrowDown' ? items[0] : items[items.length - 1];
      dispatch({ type: 'SET_CURSOR', cursorId: target.id, focusZone: 'content' });
    } else {
      dispatch({ type: e.key === 'ArrowDown' ? 'NAVIGATE_NEXT' : 'NAVIGATE_PREVIOUS' });
    }

    globalSearchInputEl.blur();
    applyCursorToDom();
    return;
  }

  // Clear search with Escape (when search is focused)
  if (e.key === 'Escape' && document.activeElement === globalSearchInputEl) {
    if (appState.search.query || appState.search.field !== 'all') {
      e.preventDefault();
      clearSearch();
    }
    globalSearchInputEl.blur();
    return;
  }

  if (document.activeElement === globalSearchInputEl && e.key === 'Enter' && getCursorItem(appState)?.type === 'tab') {
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
      const searchAction = getSearchKeyboardNavigationAction(appState, e.key);
      if (searchAction) {
        dispatch(searchAction);
        applyCursorToDom();
        if (appState.navigation.focusZone === 'search') globalSearchInputEl.focus();
        return;
      }
      dispatch({ type: 'NAVIGATE_NEXT' });
      applyCursorToDom();
      return;
    }

    if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      const searchAction = getSearchKeyboardNavigationAction(appState, e.key);
      if (searchAction) {
        dispatch(searchAction);
        applyCursorToDom();
        if (appState.navigation.focusZone === 'search') globalSearchInputEl.focus();
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

bindDuplicateGroupListClicks(duplicateListEl, { onCloseDuplicates: closeDuplicatesOfUrl });
bindTabListClicks(allTabsListEl, { onCloseTab: closeTab, onSwitchTab: switchToTab });
bindTabListClicks(mediaListEl, { onCloseTab: closeTab, onSwitchTab: switchToTab });
bindTabListClicks(domainSectionsContainer, { onCloseTab: closeTab, onSwitchTab: switchToTab });
bindTabListClicks(searchResultsListEl, { onCloseTab: closeTab, onSwitchTab: switchToTab });

// Domain filter event listeners
domainFilterInputEl.addEventListener('focus', () => {
  // Clear input if a domain is selected, so user can search
  if (appState.filters.domain) {
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
  } else if (!appState.filters.domain) {
    domainFilterClearEl.classList.add('hidden');
  }
});

domainFilterInputEl.addEventListener('keydown', (e) => {
  const isDropdownVisible = isDomainFilterOpen(appState.ui.machine);

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
    if (appState.filters.domain) {
      const selectedGroup = getDomainGroups(appState).find(g => g.domain === appState.filters.domain);
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
  settings.currentWindowOnly = appState.scope.type !== 'window';
  await chrome.storage.sync.set({ currentWindowOnly: settings.currentWindowOnly });
  if (settings.currentWindowOnly) {
    await refreshBrowserSnapshot();
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
  if (appState.scope.type === 'window') {
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
  attachChromeEventListeners();
  await refreshBrowserSnapshot();
  updateScopeButton();
  initFooter();
  const undo = await sendCommand({ type: 'undo-info' }).catch(() => null);
  if (undo) {
    lastOperationId = undo.operationId;
    lastClosedCount = undo.count;
    showUndoButton('tab');
  }
  loadAndRender();
})();
