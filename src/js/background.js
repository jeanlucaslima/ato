// Update badge with the number of open tabs
function updateBadge() {
  chrome.tabs.query({}, function(tabs) {
    chrome.action.setBadgeText({ text: tabs.length.toString() });
  });
}

// Listen for tab creation, removal, and update events
chrome.tabs.onCreated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener(updateBadge);
chrome.tabs.onUpdated.addListener(updateBadge);

// Initialize badge on startup
chrome.runtime.onStartup.addListener(updateBadge);
chrome.runtime.onInstalled.addListener(updateBadge);

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'closeTab') {
    chrome.tabs.remove(message.tabId, () => {
      sendResponse({ status: 'success' });
      updateBadge(); // Update badge after closing tab
    });
    return true;
  } else if (message.action === 'muteTab') {
    chrome.tabs.update(message.tabId, { muted: message.muted }, () => {
      sendResponse({ status: 'success' });
      updateBadge(); // Update badge if needed
    });
    return true;
  }
});
