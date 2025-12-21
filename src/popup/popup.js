// ATO Popup Script
// Displays duplicate tabs and handles user actions

import {
  findDuplicates,
  extractDomain,
  countDuplicatesByUrl,
  groupTabsByDomain,
  formatTimeAgo,
  sortTabs,
  normalizeUrl
} from '../shared/tab-utils.js';

console.log('🎨 ATO popup loaded');

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
const optionsBtn = document.getElementById('options-btn');
const scopeBtn = document.getElementById('scope-btn');
const scopeIconAll = document.getElementById('scope-icon-all');
const scopeIconCurrent = document.getElementById('scope-icon-current');
const scopeLabel = document.getElementById('scope-label');

// Collapsible section elements
const duplicatesHeaderEl = document.getElementById('duplicates-header');
const duplicatesContentEl = document.getElementById('duplicates-content');
const duplicatesSectionCountEl = document.getElementById('duplicates-section-count');
const allTabsHeaderEl = document.getElementById('all-tabs-header');
const allTabsContentEl = document.getElementById('all-tabs-content');
const allTabsSectionCountEl = document.getElementById('all-tabs-section-count');
const domainSectionsContainer = document.getElementById('domain-sections-container');

// Settings (loaded from chrome.storage.sync)
let settings = {
  theme: 'dark',
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
let allDomainGroups = []; // Store domain groups for filtering
let highlightedOptionIndex = -1; // Track highlighted option in dropdown
let ageSortDirection = 'old'; // 'old' or 'new' - toggles on each click
let sectionStates = {
  duplicates: true, // expanded by default
  allTabs: true     // expanded by default
};
let domainSectionStates = {}; // Track collapse state per domain

// Undo state
let lastClosedCount = 0;        // Number of tabs closed (for undo)
let undoContext = null;         // 'duplicates', 'domain', or specific domain name
let pinnedDuplicatesSkipped = 0; // Track count of pinned duplicates skipped
let groupedDuplicatesSkipped = 0; // Track count of grouped duplicates skipped

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
      sectionStates = result.sectionStates;
    }
    if (result.domainSectionStates) {
      domainSectionStates = result.domainSectionStates;
    }
    applySectionStates();
  } catch (error) {
    console.error('Error loading section states:', error);
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
      protectPinned: true,
      protectGroups: false,
      advancedMode: false,
      showMergeButton: false,
      keepTab: 'oldest',
      matchMode: 'exact',
      currentWindowOnly: false
    });
    settings = result;

    // Apply theme
    applyTheme(settings.theme);
  } catch (error) {
    console.error('Error loading settings:', error);
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
  } catch (error) {
    console.error('Error saving section states:', error);
  }
}

// Apply current section states to the DOM
function applySectionStates() {
  // Duplicates section
  duplicatesHeaderEl.setAttribute('aria-expanded', sectionStates.duplicates);
  duplicatesContentEl.classList.toggle('collapsed', !sectionStates.duplicates);

  // All Tabs section
  allTabsHeaderEl.setAttribute('aria-expanded', sectionStates.allTabs);
  allTabsContentEl.classList.toggle('collapsed', !sectionStates.allTabs);
}

// Toggle section visibility
function toggleSection(section) {
  const wasCollapsed = !sectionStates[section];
  sectionStates[section] = !sectionStates[section];
  applySectionStates();
  saveSectionStates();

  // If expanding, animate tab items after section opens
  if (wasCollapsed && sectionStates[section]) {
    const contentEl = section === 'duplicates' ? duplicatesContentEl : allTabsContentEl;
    // Hide tabs immediately
    hideTabItems(contentEl);
    // Then animate them in after delay
    setTimeout(() => animateTabItems(contentEl), 200);
  }
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

    // If expanding, animate tab items after section opens
    if (currentState) {
      // Hide tabs immediately
      hideTabItems(content);
      // Then animate them in after delay
      setTimeout(() => animateTabItems(content), 200);
    }
  }

  saveSectionStates();
}

// Hide all tab items immediately (before animation)
function hideTabItems(containerEl) {
  const items = containerEl.querySelectorAll('.tab-item');
  items.forEach(item => {
    item.classList.remove('animate-in');
    item.style.opacity = '0';
  });
}

// Animate tab items with staggered domino effect (logarithmic acceleration)
function animateTabItems(containerEl) {
  const items = containerEl.querySelectorAll('.tab-item');
  const maxDelay = 120; // First item delay (slowest)
  const minDelay = 30;  // Top speed delay (fastest)

  let cumulativeDelay = 0;

  items.forEach((item, index) => {
    // Calculate delay for this item (logarithmic decrease - gets faster)
    const itemDelay = minDelay + (maxDelay - minDelay) / (1 + index * 0.5);

    // Add delay before this item appears
    cumulativeDelay += itemDelay;

    setTimeout(() => {
      item.style.opacity = '';
      item.classList.add('animate-in');
    }, cumulativeDelay);
  });
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
    console.log('⚠️ No tabs to restore');
    return;
  }

  console.log(`🔄 Sending undo request for ${lastClosedCount} tabs to background...`);

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
      console.log(`✅ Closed ${closedCount} tabs from ${domain}`);

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
  } catch (error) {
    console.error('❌ Error closing domain tabs:', error);
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

    console.log(`✅ Merged ${domainTabs.length} tabs from ${domain} to new window`);

    // Refresh the list
    await loadAndRender();
  } catch (error) {
    console.error('❌ Error merging domain tabs:', error);
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

  // Add tabs
  tabs.forEach(tab => {
    const dupCount = urlCounts.get(tab.url) || 0;
    const item = createTabItem(tab, dupCount);
    tabList.appendChild(item);
  });

  content.appendChild(actionBar);
  content.appendChild(tabList);
  section.appendChild(header);
  section.appendChild(content);

  return section;
}

/**
 * Creates a DOM element for a grouped duplicate row.
 * Shows one row per URL with count badge and close button to close all duplicates.
 *
 * @param {Object} group - The grouped duplicate data
 * @param {string} group.url - The duplicate URL
 * @param {Object[]} group.tabs - Array of duplicate tabs
 * @param {Object} group.representative - Representative tab for display
 * @param {number} group.totalCount - Total tabs with this URL
 * @param {Object[]} allTabs - All tabs for finding the original
 * @returns {HTMLDivElement} The grouped duplicate item element
 */
function createGroupedDuplicateItem(group, allTabs) {
  const { url, tabs: duplicateTabs, representative, totalCount } = group;

  const item = document.createElement('div');
  item.className = 'tab-item';
  item.dataset.url = url;

  // Favicon
  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  if (representative.favIconUrl && !representative.favIconUrl.startsWith('chrome://')) {
    favicon.src = representative.favIconUrl;
    favicon.onerror = () => {
      favicon.style.display = 'none';
    };
  } else {
    favicon.className = 'tab-favicon placeholder';
    favicon.alt = '';
  }

  // Tab info container
  const info = document.createElement('div');
  info.className = 'tab-info';

  // Title
  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = representative.title || 'Untitled';
  title.title = representative.title || 'Untitled';

  // URL
  const urlEl = document.createElement('div');
  urlEl.className = 'tab-url';
  urlEl.textContent = url;
  urlEl.title = url;

  info.appendChild(title);
  info.appendChild(urlEl);

  // Count badge (shows total tabs with this URL)
  const badge = document.createElement('span');
  badge.className = 'duplicate-badge';
  badge.textContent = `×${totalCount}`;
  badge.title = `${totalCount} tabs with this URL`;

  // Close button - closes all duplicates of this URL
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-close';
  closeBtn.textContent = '×';
  closeBtn.title = `Close ${duplicateTabs.length} duplicate(s)`;
  closeBtn.onclick = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    await closeDuplicatesOfUrl(url, allTabs);
  };

  // Click to switch to first duplicate
  item.onclick = () => {
    switchToTab(representative.id, representative.windowId);
  };

  item.appendChild(favicon);
  item.appendChild(info);
  item.appendChild(badge);
  item.appendChild(closeBtn);

  return item;
}

/**
 * Closes all duplicate tabs of a specific URL, keeping one original.
 *
 * @async
 * @param {string} url - The URL to close duplicates of
 * @param {Object[]} allTabs - All tabs
 * @returns {Promise<void>}
 */
async function closeDuplicatesOfUrl(url, allTabs) {
  try {
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

    const tabIdsToClose = tabsToClose.map(tab => tab.id);

    if (tabIdsToClose.length > 0) {
      // Animate the row
      const rowEl = document.querySelector(`[data-url="${CSS.escape(url)}"]`);
      if (rowEl) {
        rowEl.classList.add('closing');
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      await chrome.tabs.remove(tabIdsToClose);
      console.log(`✅ Closed ${tabIdsToClose.length} duplicates of ${url}`);
    }

    await loadAndRender();
  } catch (error) {
    console.error('❌ Error closing duplicates:', error);
  }
}

/**
 * Creates a DOM element for a single tab item.
 * Includes favicon, title, URL, age indicator, duplicate badge, and close button.
 *
 * @param {Object} tab - The tab data from Chrome API
 * @param {number} tab.id - Tab identifier
 * @param {string} [tab.url] - Tab URL
 * @param {string} [tab.title] - Tab title
 * @param {string} [tab.favIconUrl] - Favicon URL
 * @param {number} [tab.lastAccessed] - Last accessed timestamp
 * @param {number} [tab.windowId] - Window containing this tab
 * @param {number} [duplicateCount=0] - Number of tabs with this URL
 * @returns {HTMLDivElement} The tab item element
 */
function createTabItem(tab, duplicateCount = 0) {
  const item = document.createElement('div');
  item.className = 'tab-item';
  item.dataset.tabId = tab.id;

  // Favicon
  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) {
    favicon.src = tab.favIconUrl;
    favicon.onerror = () => {
      favicon.style.display = 'none';
    };
  } else {
    favicon.className = 'tab-favicon placeholder';
    favicon.alt = '';
  }

  // Tab info container
  const info = document.createElement('div');
  info.className = 'tab-info';

  // Title
  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title || 'Untitled';
  title.title = tab.title || 'Untitled';

  // URL
  const url = document.createElement('div');
  url.className = 'tab-url';
  url.textContent = tab.url;
  url.title = tab.url;

  info.appendChild(title);
  info.appendChild(url);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-close';
  closeBtn.textContent = '×';
  closeBtn.title = 'Close this tab';
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation(); // Prevent any other handlers
    closeTab(tab.id);
  };

  // Click to switch to tab
  item.onclick = () => {
    switchToTab(tab.id, tab.windowId);
  };

  item.appendChild(favicon);
  item.appendChild(info);

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

// Close a single tab with animation
async function closeTab(tabId) {
  try {
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
    console.log(`✅ Closed tab ${tabId}`);

    // Refresh the list
    await loadAndRender();
  } catch (error) {
    console.error('❌ Error closing tab:', error);
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
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) return;
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

    // Track count of skipped duplicates
    pinnedDuplicatesSkipped = skippedPinnedCount;
    groupedDuplicatesSkipped = skippedGroupedCount;

    // Get tab IDs to close
    const tabIdsToClose = tabsToClose.map(tab => tab.id);

    if (tabIdsToClose.length > 0) {
      const closedCount = tabIdsToClose.length;
      await chrome.tabs.remove(tabIdsToClose);
      console.log(`✅ Closed ${closedCount} duplicate tabs`);

      // Store count for undo
      lastClosedCount = closedCount;
      undoContext = 'duplicates';

      // Show undo button
      showUndoButton('duplicates');
    }

    // Refresh the list
    await loadAndRender();
  } catch (error) {
    console.error('❌ Error closing duplicates:', error);
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
  // Calculate duplicate counts by URL
  const urlCounts = countDuplicatesByUrl(tabs, settings.matchMode);
  const domainGroups = groupTabsByDomain(tabs);

  // Update stats
  totalTabsEl.textContent = tabs.length;
  duplicateCountEl.textContent = duplicates.length;
  domainCountEl.textContent = domainGroups.length;

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
    pinnedDuplicatesSkipped = 0;
    groupedDuplicatesSkipped = 0;
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
    groupedDuplicates.forEach(group => {
      const item = createGroupedDuplicateItem(group, tabs);
      duplicateListEl.appendChild(item);
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

  // Apply sorting
  visibleTabs = sortTabs(visibleTabs, activeSort, urlCounts, ageSortDirection);

  // Update all tabs section count
  allTabsSectionCountEl.textContent = visibleTabs.length;

  // Render all tabs as flat list (sortable)
  visibleTabs.forEach(tab => {
    const count = urlCounts.get(tab.url) || 0;
    const item = createTabItem(tab, count);
    allTabsListEl.appendChild(item);
  });

  // Render domain sections (for domains with 3+ tabs)
  domainSectionsContainer.innerHTML = '';

  // Group all tabs by domain (not filtered)
  const allVisibleTabs = tabs.filter(tab =>
    tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')
  );

  const domainMap = new Map();
  allVisibleTabs.forEach(tab => {
    const domain = extractDomain(tab.url);
    if (!domain) return;
    if (!domainMap.has(domain)) {
      domainMap.set(domain, []);
    }
    domainMap.get(domain).push(tab);
  });

  // Get domains with 3+ tabs
  const largeDomains = [];
  domainMap.forEach((domainTabs, domain) => {
    if (domainTabs.length >= 3) {
      largeDomains.push({ domain, tabs: domainTabs });
    }
  });

  // Sort alphabetically by domain name, ignoring www. prefix (stable order that doesn't change when tabs are closed)
  largeDomains.sort((a, b) => {
    const domainA = a.domain.replace(/^www\./, '');
    const domainB = b.domain.replace(/^www\./, '');
    return domainA.localeCompare(domainB);
  });

  // Render each domain section
  largeDomains.forEach(({ domain, tabs: domainTabs }) => {
    const section = createDomainSection(domain, domainTabs, urlCounts);
    domainSectionsContainer.appendChild(section);
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
    const queryOptions = settings.currentWindowOnly ? { currentWindow: true } : {};
    const tabs = await chrome.tabs.query(queryOptions);
    const duplicates = findDuplicates(tabs, settings.matchMode);

    console.log(`📊 Loaded ${tabs.length} tabs (${settings.currentWindowOnly ? 'current window' : 'all windows'}), ${duplicates.length} duplicates`);

    render(tabs, duplicates);
  } catch (error) {
    console.error('❌ Error loading tabs:', error);
  }
}

// Event Listeners
closeAllBtn.addEventListener('click', closeAllDuplicates);

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

// Section toggle event listeners
duplicatesHeaderEl.addEventListener('click', () => toggleSection('duplicates'));
allTabsHeaderEl.addEventListener('click', () => toggleSection('allTabs'));

// Initial load - wait for settings and section states before rendering
(async () => {
  await loadSettings();
  await loadSectionStates();
  updateScopeButton();
  loadAndRender();
})();
