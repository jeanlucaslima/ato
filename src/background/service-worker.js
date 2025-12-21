// ATO Background Service Worker
// Monitors tabs and detects duplicates in real-time

import { findDuplicates } from '../shared/tab-utils.js';

console.log('🚀 ATO service worker loaded');

// Cache the matchMode setting
let matchMode = 'exact';

/**
 * Updates the extension badge with the duplicate count.
 * Shows red badge with count if duplicates exist, clears badge if none.
 *
 * @param {number} count - Number of duplicate tabs
 */
function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#DC2626' }); // Red
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

/**
 * Loads the matchMode setting from Chrome storage.
 *
 * @async
 * @returns {Promise<void>}
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get({ matchMode: 'exact' });
    matchMode = result.matchMode;
    console.log(`⚙️ Loaded matchMode setting: ${matchMode}`);
  } catch (error) {
    console.error('❌ Error loading settings:', error);
  }
}

/**
 * Scans all open tabs and updates the badge with duplicate count.
 * Called on tab events and service worker initialization.
 *
 * @async
 * @returns {Promise<void>}
 */
async function scanAndUpdateBadge() {
  try {
    const tabs = await chrome.tabs.query({});
    const duplicates = findDuplicates(tabs, matchMode);
    updateBadge(duplicates.length);
    console.log(`📊 Scanned ${tabs.length} tabs, found ${duplicates.length} duplicates`);
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

// Listen for storage changes to update badge when matchMode changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.matchMode) {
    matchMode = changes.matchMode.newValue || 'exact';
    console.log(`⚙️ matchMode setting changed to: ${matchMode}`);
    scanAndUpdateBadge();
  }
});

// Initial scan when service worker starts
(async () => {
  await loadSettings();
  scanAndUpdateBadge();
})();
