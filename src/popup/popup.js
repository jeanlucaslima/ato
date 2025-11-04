// ATO v4 Popup Script
// Displays duplicate tabs and handles user actions

console.log('🎨 ATO v4 popup loaded');

// DOM Elements
const totalTabsEl = document.getElementById('total-tabs');
const duplicateCountEl = document.getElementById('duplicate-count');
const duplicateListEl = document.getElementById('duplicate-list');
const allTabsListEl = document.getElementById('all-tabs-list');
const emptyStateEl = document.getElementById('empty-state');
const closeAllBtn = document.getElementById('close-all-btn');
const actionsEl = document.getElementById('actions');
const domainButtonsEl = document.getElementById('domain-buttons');
const domainActionsEl = document.getElementById('domain-actions');
const clearFilterBtn = document.getElementById('clear-filter-btn');
const closeDomainBtn = document.getElementById('close-domain-btn');

// State
let activeDomain = null;

// Count how many times each URL appears
function countDuplicatesByUrl(tabs) {
  const urlCounts = new Map();

  tabs.forEach(tab => {
    // Skip chrome:// and edge:// internal pages
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
      return;
    }

    const url = tab.url;
    urlCounts.set(url, (urlCounts.get(url) || 0) + 1);
  });

  return urlCounts;
}

// Find duplicate tabs
function findDuplicates(tabs) {
  const urlMap = new Map();
  const duplicates = [];

  tabs.forEach(tab => {
    // Skip chrome:// and edge:// internal pages
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
      return;
    }

    const url = tab.url;

    if (urlMap.has(url)) {
      // This is a duplicate
      duplicates.push(tab);
    } else {
      // First occurrence
      urlMap.set(url, tab);
    }
  });

  return duplicates;
}

// Extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return null;
  }
}

// Group tabs by domain
function groupTabsByDomain(tabs) {
  const domainGroups = new Map();

  tabs.forEach(tab => {
    // Skip chrome:// and edge:// internal pages
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
      return;
    }

    const domain = extractDomain(tab.url);
    if (!domain) return;

    if (!domainGroups.has(domain)) {
      domainGroups.set(domain, []);
    }
    domainGroups.get(domain).push(tab);
  });

  // Convert to array and sort by tab count (descending)
  return Array.from(domainGroups.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([domain, tabs]) => ({ domain, tabs, count: tabs.length }));
}

// Create a tab item element
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
    closeTab(tab.id);
  };

  // Click to switch to tab
  item.onclick = () => {
    switchToTab(tab.id, tab.windowId);
  };

  item.appendChild(favicon);
  item.appendChild(info);

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

// Close a single tab
async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    console.log(`✅ Closed tab ${tabId}`);
    // Refresh the list
    await loadAndRender();
  } catch (error) {
    console.error('❌ Error closing tab:', error);
  }
}

// Close all duplicate tabs
async function closeAllDuplicates() {
  try {
    const tabs = await chrome.tabs.query({});
    const duplicates = findDuplicates(tabs);

    if (duplicates.length === 0) {
      return;
    }

    // Get active tab to avoid closing it
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTabId = activeTabs[0]?.id;

    // Filter out active tab from duplicates
    const tabsToClose = duplicates
      .filter(tab => tab.id !== activeTabId)
      .map(tab => tab.id);

    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
      console.log(`✅ Closed ${tabsToClose.length} duplicate tabs`);
    }

    // Refresh the list
    await loadAndRender();
  } catch (error) {
    console.error('❌ Error closing duplicates:', error);
  }
}

// Render domain filter buttons
function renderDomainButtons(tabs) {
  const domainGroups = groupTabsByDomain(tabs);

  domainButtonsEl.innerHTML = '';

  domainGroups.forEach(({ domain, count }) => {
    const pill = document.createElement('button');
    pill.className = 'domain-pill';
    if (activeDomain === domain) {
      pill.classList.add('active');
    }

    const domainName = document.createElement('span');
    domainName.textContent = domain;

    const countBadge = document.createElement('span');
    countBadge.className = 'domain-pill-count';
    countBadge.textContent = count;

    pill.appendChild(domainName);
    pill.appendChild(countBadge);

    pill.onclick = () => {
      activeDomain = domain;
      loadAndRender();
    };

    domainButtonsEl.appendChild(pill);
  });
}

// Close all tabs from active domain
async function closeAllFromDomain() {
  if (!activeDomain) return;

  try {
    const tabs = await chrome.tabs.query({});
    const domainTabs = tabs.filter(tab => {
      const domain = extractDomain(tab.url);
      return domain === activeDomain;
    });

    // Get active tab to avoid closing it
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTabId = activeTabs[0]?.id;

    // Filter out active tab
    const tabsToClose = domainTabs
      .filter(tab => tab.id !== activeTabId)
      .map(tab => tab.id);

    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
      console.log(`✅ Closed ${tabsToClose.length} tabs from ${activeDomain}`);
    }

    // Clear filter and refresh
    activeDomain = null;
    await loadAndRender();
  } catch (error) {
    console.error('❌ Error closing domain tabs:', error);
  }
}

// Render the UI
function render(tabs, duplicates) {
  // Calculate duplicate counts by URL
  const urlCounts = countDuplicatesByUrl(tabs);

  // Update stats
  totalTabsEl.textContent = tabs.length;
  duplicateCountEl.textContent = duplicates.length;

  // Render domain filter buttons
  renderDomainButtons(tabs);

  // Show/hide domain actions based on active filter
  if (activeDomain) {
    domainActionsEl.style.display = 'flex';
  } else {
    domainActionsEl.style.display = 'none';
  }

  // Clear lists
  duplicateListEl.innerHTML = '';
  allTabsListEl.innerHTML = '';

  // Render duplicates section
  if (duplicates.length === 0) {
    // Show empty state
    duplicateListEl.style.display = 'none';
    emptyStateEl.style.display = 'block';
    actionsEl.style.display = 'none';
  } else {
    // Show duplicates
    duplicateListEl.style.display = 'flex';
    emptyStateEl.style.display = 'none';
    actionsEl.style.display = 'flex';

    // Render each duplicate with count badge
    duplicates.forEach(tab => {
      const count = urlCounts.get(tab.url) || 0;
      const item = createTabItem(tab, count);
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

  visibleTabs.forEach(tab => {
    const count = urlCounts.get(tab.url) || 0;
    const item = createTabItem(tab, count);
    allTabsListEl.appendChild(item);
  });
}

// Load tabs and render
async function loadAndRender() {
  try {
    const tabs = await chrome.tabs.query({});
    const duplicates = findDuplicates(tabs);

    console.log(`📊 Loaded ${tabs.length} tabs, ${duplicates.length} duplicates`);

    render(tabs, duplicates);
  } catch (error) {
    console.error('❌ Error loading tabs:', error);
  }
}

// Event Listeners
closeAllBtn.addEventListener('click', closeAllDuplicates);
clearFilterBtn.addEventListener('click', () => {
  activeDomain = null;
  loadAndRender();
});
closeDomainBtn.addEventListener('click', closeAllFromDomain);

// Initial load
loadAndRender();
