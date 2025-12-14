// ATO v4 Popup Script
// Displays duplicate tabs and handles user actions

console.log('🎨 ATO v4 popup loaded');

// DOM Elements
const totalTabsEl = document.getElementById('total-tabs');
const duplicateCountEl = document.getElementById('duplicate-count');
const domainCountEl = document.getElementById('domain-count');
const duplicateListEl = document.getElementById('duplicate-list');
const allTabsListEl = document.getElementById('all-tabs-list');
const emptyStateEl = document.getElementById('empty-state');
const closeAllBtn = document.getElementById('close-all-btn');
const domainSelectEl = document.getElementById('domain-select');
const closeDomainBtn = document.getElementById('close-domain-btn');
const sortButtonsEl = document.getElementById('sort-buttons');

// Collapsible section elements
const duplicatesHeaderEl = document.getElementById('duplicates-header');
const duplicatesContentEl = document.getElementById('duplicates-content');
const duplicatesSectionCountEl = document.getElementById('duplicates-section-count');
const allTabsHeaderEl = document.getElementById('all-tabs-header');
const allTabsContentEl = document.getElementById('all-tabs-content');
const allTabsSectionCountEl = document.getElementById('all-tabs-section-count');

// State
let activeDomain = null;
let activeSort = 'default';
let sectionStates = {
  duplicates: true, // expanded by default
  allTabs: true     // expanded by default
};
let domainSectionStates = {}; // Track collapse state per domain

// Load section states from storage
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

// Save section states to storage
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

// Create a domain section element
function createDomainSection(domain, tabs, urlCounts) {
  const isExpanded = domainSectionStates[domain] !== false; // Default to expanded

  const section = document.createElement('div');
  section.className = 'domain-section';

  // Create header
  const header = document.createElement('button');
  header.className = 'domain-header';
  header.setAttribute('data-domain', domain);
  header.setAttribute('aria-expanded', isExpanded);
  header.onclick = () => toggleDomainSection(domain);

  // Arrow
  const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  arrow.setAttribute('class', 'fold-arrow');
  arrow.setAttribute('width', '10');
  arrow.setAttribute('height', '10');
  arrow.setAttribute('viewBox', '0 0 12 12');
  arrow.setAttribute('fill', 'currentColor');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M4 2l4 4-4 4V2z');
  arrow.appendChild(path);

  // Domain name
  const domainName = document.createElement('span');
  domainName.className = 'domain-name';
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
  content.className = 'section-content domain-content';
  content.id = `domain-content-${domain}`;
  if (!isExpanded) {
    content.classList.add('collapsed');
  }

  // Add tabs
  tabs.forEach(tab => {
    const dupCount = urlCounts.get(tab.url) || 0;
    const item = createTabItem(tab, dupCount);
    content.appendChild(item);
  });

  section.appendChild(header);
  section.appendChild(content);

  return section;
}

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

// Format time ago (e.g., "2m", "3h", "5d")
function formatTimeAgo(timestamp) {
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

// Sort tabs based on selected sort option
function sortTabs(tabs, sortBy, urlCounts) {
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
        // Oldest first (smallest lastAccessed = oldest)
        const ageA = a.lastAccessed || 0;
        const ageB = b.lastAccessed || 0;
        return ageA - ageB;
      });
    case 'duplicates':
      return sorted.sort((a, b) => {
        const countA = urlCounts.get(a.url) || 0;
        const countB = urlCounts.get(b.url) || 0;
        return countB - countA; // Most duplicates first
      });
    default:
      return sorted; // Original tab order
  }
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

// Render domain filter dropdown
function renderDomainDropdown(tabs) {
  const domainGroups = groupTabsByDomain(tabs);

  // Clear existing options except the first "All Domains" option
  while (domainSelectEl.options.length > 1) {
    domainSelectEl.remove(1);
  }

  // Add domain options
  domainGroups.forEach(({ domain, count }) => {
    const option = document.createElement('option');
    option.value = domain;
    option.textContent = `${domain} (${count})`;
    domainSelectEl.appendChild(option);
  });

  // Set selected value
  domainSelectEl.value = activeDomain || '';
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
  const domainGroups = groupTabsByDomain(tabs);

  // Update stats
  totalTabsEl.textContent = tabs.length;
  duplicateCountEl.textContent = duplicates.length;
  domainCountEl.textContent = domainGroups.length;

  // Update section counts
  duplicatesSectionCountEl.textContent = duplicates.length;

  // Render domain filter dropdown
  renderDomainDropdown(tabs);

  // Update close domain button based on active filter
  closeDomainBtn.disabled = !activeDomain;
  closeDomainBtn.title = activeDomain
    ? `Close all tabs from ${activeDomain}`
    : 'Choose a domain to close all tabs from it';

  // Enable/disable close all duplicates button
  closeAllBtn.disabled = duplicates.length === 0;

  // Update sort button active states
  sortButtonsEl.querySelectorAll('.btn-toggle').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === activeSort);
  });

  // Clear lists
  duplicateListEl.innerHTML = '';
  allTabsListEl.innerHTML = '';

  // Render duplicates section
  if (duplicates.length === 0) {
    // Show empty state
    duplicateListEl.style.display = 'none';
    emptyStateEl.style.display = 'block';
  } else {
    // Show duplicates
    duplicateListEl.style.display = 'flex';
    emptyStateEl.style.display = 'none';

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

  // Apply sorting
  visibleTabs = sortTabs(visibleTabs, activeSort, urlCounts);

  // Update all tabs section count
  allTabsSectionCountEl.textContent = visibleTabs.length;

  // Group tabs by domain for section rendering
  const domainMap = new Map();
  visibleTabs.forEach(tab => {
    const domain = extractDomain(tab.url) || 'other';
    if (!domainMap.has(domain)) {
      domainMap.set(domain, []);
    }
    domainMap.get(domain).push(tab);
  });

  // Separate domains with 3+ tabs from others
  const largeDomains = [];
  const smallDomainTabs = [];

  domainMap.forEach((domainTabs, domain) => {
    if (domainTabs.length >= 3) {
      largeDomains.push({ domain, tabs: domainTabs });
    } else {
      smallDomainTabs.push(...domainTabs);
    }
  });

  // Sort large domains by tab count (descending)
  largeDomains.sort((a, b) => b.tabs.length - a.tabs.length);

  // Render domain sections for domains with 3+ tabs
  largeDomains.forEach(({ domain, tabs: domainTabs }) => {
    const section = createDomainSection(domain, domainTabs, urlCounts);
    allTabsListEl.appendChild(section);
  });

  // Render remaining tabs (from domains with < 3 tabs)
  if (smallDomainTabs.length > 0) {
    // If there are domain sections, add a separator label
    if (largeDomains.length > 0) {
      const otherLabel = document.createElement('div');
      otherLabel.className = 'other-tabs-label';
      otherLabel.textContent = 'Other';
      allTabsListEl.appendChild(otherLabel);
    }

    smallDomainTabs.forEach(tab => {
      const count = urlCounts.get(tab.url) || 0;
      const item = createTabItem(tab, count);
      allTabsListEl.appendChild(item);
    });
  }
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
domainSelectEl.addEventListener('change', (e) => {
  activeDomain = e.target.value || null;
  loadAndRender();
});
closeDomainBtn.addEventListener('click', closeAllFromDomain);

// Sort button group event listener
sortButtonsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-toggle');
  if (btn && btn.dataset.sort) {
    activeSort = btn.dataset.sort;
    loadAndRender();
  }
});

// Section toggle event listeners
duplicatesHeaderEl.addEventListener('click', () => toggleSection('duplicates'));
allTabsHeaderEl.addEventListener('click', () => toggleSection('allTabs'));

// Initial load
loadSectionStates();
loadAndRender();
