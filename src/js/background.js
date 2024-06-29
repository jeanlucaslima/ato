chrome.runtime.onInstalled.addListener(() => {
  console.log('Tab Manager extension installed');
  updateBadge();
  // Listen for tab changes to update the badge
  chrome.tabs.onCreated.addListener(updateBadge);
  chrome.tabs.onRemoved.addListener(updateBadge);
  chrome.tabs.onUpdated.addListener(updateBadge);
  chrome.tabs.onActivated.addListener(updateBadge);
  chrome.windows.onFocusChanged.addListener(updateBadge);
});

// Function to close a tab
function closeTab(tabId) {
  chrome.tabs.remove(tabId);
}

// Function to suspend a tab
function suspendTab(tabId) {
  chrome.tabs.discard(tabId);
}

// Function to update the badge with the number of open tabs
function updateBadge() {
  chrome.tabs.query({}, function(tabs) {
    const tabCount = tabs.length.toString();
    chrome.action.setBadgeText({ text: tabCount });
    chrome.action.setBadgeBackgroundColor({ color: '#0000FF' });
  });
}

// Listens for messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'closeTab') {
    closeTab(message.tabId);
  } else if (message.action === 'suspendTab') {
    suspendTab(message.tabId);
  }
  sendResponse({status: 'success'});
});
