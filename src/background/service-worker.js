// ATO v4 Background Service Worker
// Monitors tabs and detects duplicates in real-time

console.log('🚀 ATO v4 service worker loaded');

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
      // This is a duplicate - add to duplicates array
      duplicates.push(tab);
    } else {
      // First occurrence - store it
      urlMap.set(url, tab);
    }
  });

  return duplicates;
}

// Update the badge with duplicate count
function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#DC2626' }); // Red
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Scan all tabs and update badge
async function scanAndUpdateBadge() {
  try {
    const tabs = await chrome.tabs.query({});
    const duplicates = findDuplicates(tabs);
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

// Initial scan when service worker starts
scanAndUpdateBadge();
