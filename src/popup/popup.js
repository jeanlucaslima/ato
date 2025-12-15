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
const domainFilterInputEl = document.getElementById('domain-filter-input');
const domainFilterClearEl = document.getElementById('domain-filter-clear');
const domainFilterDropdownEl = document.getElementById('domain-filter-dropdown');
const sortButtonsEl = document.getElementById('sort-buttons');
const undoDuplicatesBtn = document.getElementById('undo-duplicates-btn');

// Collapsible section elements
const duplicatesHeaderEl = document.getElementById('duplicates-header');
const duplicatesContentEl = document.getElementById('duplicates-content');
const duplicatesSectionCountEl = document.getElementById('duplicates-section-count');
const allTabsHeaderEl = document.getElementById('all-tabs-header');
const allTabsContentEl = document.getElementById('all-tabs-content');
const allTabsSectionCountEl = document.getElementById('all-tabs-section-count');
const domainSectionsContainer = document.getElementById('domain-sections-container');

// State
let activeDomain = null;
let activeSort = 'default';
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

// Show undo button based on context
function showUndoButton(context) {
  // Hide all undo buttons first
  hideAllUndoButtons();

  // Show the duplicates undo button for any undo action
  undoDuplicatesBtn.classList.remove('hidden');
}

// Hide all undo buttons
function hideAllUndoButtons() {
  undoDuplicatesBtn.classList.add('hidden');
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

// Close all tabs from a specific domain (used by domain section buttons)
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

    // Filter out active tab
    const tabsToClose = domainTabs
      .filter(tab => tab.id !== activeTabId)
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

  // Action bar with close button
  const actionBar = document.createElement('div');
  actionBar.className = 'domain-action-bar';

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
        const ageA = a.lastAccessed || 0;
        const ageB = b.lastAccessed || 0;
        // Toggle between oldest first and newest first
        return ageSortDirection === 'old' ? ageA - ageB : ageB - ageA;
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
      const closedCount = tabsToClose.length;
      await chrome.tabs.remove(tabsToClose);
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

  // Render domain filter
  renderDomainFilter(tabs);

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

// Sort button group event listener
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

// Section toggle event listeners
duplicatesHeaderEl.addEventListener('click', () => toggleSection('duplicates'));
allTabsHeaderEl.addEventListener('click', () => toggleSection('allTabs'));

// Initial load
loadSectionStates();
loadAndRender();
