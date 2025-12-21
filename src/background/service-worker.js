// ATO Background Service Worker
// Monitors tabs and detects duplicates in real-time

import { findDuplicates } from '../shared/tab-utils.js';

console.log('🚀 ATO service worker loaded');

// Cache settings
let matchMode = 'exact';
let showBadge = true;
let badgeMode = 'duplicates';
let badgeColor = '#DC2626';
let currentWindowOnly = false;

/**
 * Updates the extension badge with the count.
 * Shows badge with count if showBadge is enabled.
 *
 * @param {number} count - Number to display on badge
 */
function updateBadge(count) {
  if (!showBadge) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  // For duplicates mode, hide badge when count is 0
  // For allTabs mode, always show the count
  if (count > 0 || badgeMode === 'allTabs') {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: badgeColor });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

/**
 * Loads settings from Chrome storage.
 *
 * @async
 * @returns {Promise<void>}
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get({
      matchMode: 'exact',
      showBadge: true,
      badgeMode: 'duplicates',
      badgeColor: '#DC2626',
      currentWindowOnly: false
    });
    matchMode = result.matchMode;
    showBadge = result.showBadge;
    badgeMode = result.badgeMode;
    badgeColor = result.badgeColor;
    currentWindowOnly = result.currentWindowOnly;
    console.log(`⚙️ Loaded settings: matchMode=${matchMode}, showBadge=${showBadge}, badgeMode=${badgeMode}, currentWindowOnly=${currentWindowOnly}`);
  } catch (error) {
    console.error('❌ Error loading settings:', error);
  }
}

/**
 * Scans tabs and updates the badge with duplicate count.
 * Called on tab events and service worker initialization.
 *
 * @async
 * @returns {Promise<void>}
 */
async function scanAndUpdateBadge() {
  try {
    const queryOptions = currentWindowOnly ? { currentWindow: true } : {};
    const tabs = await chrome.tabs.query(queryOptions);
    const duplicates = findDuplicates(tabs, matchMode);

    // Choose count based on badge mode
    const count = badgeMode === 'allTabs' ? tabs.length : duplicates.length;
    updateBadge(count);

    console.log(`📊 Scanned ${tabs.length} tabs (${currentWindowOnly ? 'current window' : 'all windows'}), found ${duplicates.length} duplicates, badge shows: ${count} (${badgeMode})`);
  } catch (error) {
    console.error('❌ Error scanning tabs:', error);
  }
}

// Listen to tab events
chrome.tabs.onCreated.addListener(() => {
  console.log('➕ Tab created');
  scanAndUpdateBadge();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only scan when URL changes
  if (changeInfo.url) {
    console.log('🔄 Tab URL updated');
    scanAndUpdateBadge();
  }
});

chrome.tabs.onRemoved.addListener(() => {
  console.log('➖ Tab removed');
  scanAndUpdateBadge();
});

chrome.tabs.onReplaced.addListener(() => {
  console.log('🔀 Tab replaced');
  scanAndUpdateBadge();
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'undoCloseTabs') {
    const count = message.count;
    console.log(`🔄 Received undo request for ${count} tabs`);

    // Restore tabs asynchronously
    (async () => {
      let restored = 0;
      for (let i = 0; i < count; i++) {
        try {
          await chrome.sessions.restore();
          restored++;
          console.log(`✅ Restored tab ${restored}/${count}`);
        } catch (e) {
          console.log(`⚠️ Failed to restore tab ${i + 1}:`, e.message);
          break;
        }
      }
      console.log(`✅ Undo complete: restored ${restored} tabs`);
    })();

    // Return true to indicate async response (though we don't send one)
    return true;
  }
});

// Listen for storage changes to update badge when settings change
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;

  let needsRescan = false;

  if (changes.matchMode) {
    matchMode = changes.matchMode.newValue || 'exact';
    console.log(`⚙️ matchMode setting changed to: ${matchMode}`);
    needsRescan = true;
  }

  if (changes.showBadge !== undefined) {
    showBadge = changes.showBadge.newValue;
    console.log(`⚙️ showBadge setting changed to: ${showBadge}`);
    needsRescan = true;
  }

  if (changes.badgeMode) {
    badgeMode = changes.badgeMode.newValue || 'duplicates';
    console.log(`⚙️ badgeMode setting changed to: ${badgeMode}`);
    needsRescan = true;
  }

  if (changes.badgeColor) {
    badgeColor = changes.badgeColor.newValue || '#DC2626';
    console.log(`⚙️ badgeColor setting changed to: ${badgeColor}`);
    needsRescan = true;
  }

  if (changes.currentWindowOnly !== undefined) {
    currentWindowOnly = changes.currentWindowOnly.newValue;
    console.log(`⚙️ currentWindowOnly setting changed to: ${currentWindowOnly}`);
    needsRescan = true;
  }

  if (needsRescan) {
    scanAndUpdateBadge();
  }
});

// Initial scan when service worker starts
(async () => {
  await loadSettings();
  scanAndUpdateBadge();
})();
