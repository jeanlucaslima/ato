// ATO v4 Popup Script
// Displays duplicate tabs and handles user actions

console.log('🎨 ATO v4 popup loaded');

// DOM Elements
const totalTabsEl = document.getElementById('total-tabs');
const duplicateCountEl = document.getElementById('duplicate-count');
const duplicateListEl = document.getElementById('duplicate-list');
const emptyStateEl = document.getElementById('empty-state');
const closeAllBtn = document.getElementById('close-all-btn');
const actionsEl = document.getElementById('actions');

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

// Create a tab item element
function createTabItem(tab) {
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

// Render the UI
function render(tabs, duplicates) {
  // Update stats
  totalTabsEl.textContent = tabs.length;
  duplicateCountEl.textContent = duplicates.length;

  // Clear list
  duplicateListEl.innerHTML = '';

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

    // Render each duplicate
    duplicates.forEach(tab => {
      const item = createTabItem(tab);
      duplicateListEl.appendChild(item);
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

// Initial load
loadAndRender();
