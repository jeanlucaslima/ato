chrome.tabs.onCreated.addListener(updateTabCount);
chrome.tabs.onRemoved.addListener(updateTabCount);

function updateTabCount() {
  chrome.tabs.query({}, function (tabs) {
    const tabCount = tabs.length;
    chrome.action.setBadgeText({ text: tabCount.toString() });
  });
}
