function setupContextMenu() {
  chrome.contextMenus.create({
    id: 'tab-organizer',
    title: 'Advanced Tab Organizer',
    contexts: ['all']
  });
}

function updateBadge() {
  chrome.tabs.query({}, function(tabs) {
    chrome.action.setBadgeText({ text: tabs.length.toString() });
  });
}

// Listen for tab creation, removal, and update events
chrome.tabs.onCreated.addListener(() => {
  updateBadge();
});
chrome.tabs.onRemoved.addListener(() => {
  updateBadge();
});
chrome.tabs.onUpdated.addListener(() => {
  updateBadge();
});

// Startup actions
chrome.runtime.onStartup.addListener(() => {
  updateBadge();
});
chrome.runtime.onInstalled.addListener(() => {
  updateBadge();
  setupContextMenu();
});

chrome.contextMenus.onClicked.addListener((data, tab) => {
  // Make sure the side panel is open.
  chrome.sidePanel.open({ tabId: tab.id });
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'closeTab') {
    chrome.tabs.remove(message.tabId, () => {
      sendResponse({ status: 'success' });
      updateBadge();
    });
    return true;
  } else if (message.action === 'muteTab') {
    chrome.tabs.update(message.tabId, { muted: message.muted }, () => {
      sendResponse({ status: 'success' });
    });
    return true;
  }
});
