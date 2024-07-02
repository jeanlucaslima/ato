function fetchTabs() {
  chrome.tabs.query({}, function(tabs) {
    displayTabs(tabs);
    updateStats(tabs);
  });
}

function fetchGroups() {
  chrome.tabGroups.query({}, function(groups) {
    displayGroups(groups);
  });
}

function displayTabs(tabs) {
  const tabList = document.getElementById('tab-list');
  tabList.innerHTML = '';

  tabs.forEach(tab => {
    const tabItem = document.createElement('div');
    tabItem.className = 'tab-item';

    const favicon = document.createElement('img');
    favicon.src = tab.favIconUrl || 'default_favicon.png';
    favicon.className = 'tab-favicon';

    const tabInfo = document.createElement('div');
    tabInfo.className = 'tab-info';

    const tabTitle = document.createElement('span');
    tabTitle.className = 'tab-title';
    tabTitle.textContent = tab.title || tab.url;

    const tabUrl = document.createElement('span');
    tabUrl.className = 'tab-url';
    tabUrl.textContent = tab.url;

    tabInfo.appendChild(tabTitle);
    tabInfo.appendChild(tabUrl);

    const tabButtons = document.createElement('div');
    tabButtons.className = 'tab-buttons';

    const closeButton = document.createElement('button');
    closeButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 32 32"><path fill="currentColor" d="M17.414 16L24 9.414L22.586 8L16 14.586L9.414 8L8 9.414L14.586 16L8 22.586L9.414 24L16 17.414L22.586 24L24 22.586z"/></svg>`;
    closeButton.addEventListener('click', () => closeTab(tab.id));

    const muteButton = document.createElement('button');
    muteButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 32 32"><path fill="currentColor" d="M31 12.41L29.59 11L26 14.59L22.41 11L21 12.41L24.59 16L21 19.59L22.41 21L26 17.41L29.59 21L31 19.59L27.41 16zM18 30a1 1 0 0 1-.71-.3L9.67 22H3a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h6.67l7.62-7.7a1 1 0 0 1 1.41 0a1 1 0 0 1 .3.7v26a1 1 0 0 1-1 1"/></svg>`;
    muteButton.addEventListener('click', () => muteTab(tab.id));

    tabButtons.appendChild(closeButton);
    tabButtons.appendChild(muteButton);

    tabItem.appendChild(favicon);
    tabItem.appendChild(tabInfo);
    tabItem.appendChild(tabButtons);

    tabList.appendChild(tabItem);
  });
}

function updateStats(tabs) {
  const stats = document.getElementById('stats');
  const totalTabs = tabs.length;
  const audibleTabs = tabs.filter(tab => tab.audible).length;

  chrome.tabGroups.query({}, function(groups) {
    const totalGroups = groups.length;
    const duplicateTabs = findDuplicateTabs(tabs).length;
    stats.innerHTML = `Open Tabs: ${totalTabs}, Playing Media: ${audibleTabs}, Groups: ${totalGroups}, Duplicates: ${duplicateTabs}`;
  });
}

function findDuplicateTabs(tabs) {
  const tabUrls = tabs.map(tab => tab.url);
  return tabUrls.filter((url, index) => tabUrls.indexOf(url) !== index);
}

// ideally should only remove the tabItem
function closeTab(tabId) {
  chrome.runtime.sendMessage({ action: 'closeTab', tabId }, function(response) {
    if(response.status === 'success') { fetchTabs(); }
  });
}

function muteTab(tabId) {
  chrome.tabs.get(tabId, function(tab) {
    chrome.runtime.sendMessage({ action: 'muteTab', tabId, muted: !tab.mutedInfo.muted });
  });
}

function searchTabs() {
  const query = document.getElementById('search-bar').value.toLowerCase();
  chrome.tabs.query({}, function(tabs) {
    const filteredTabs = tabs.filter(tab => tab.title.toLowerCase().includes(query) || tab.url.toLowerCase().includes(query));
    displayTabs(filteredTabs);
  });
}

function groupSearchResults() {
  const query = document.getElementById('search-bar').value.toLowerCase();
  chrome.tabs.query({}, function(tabs) {
    const filteredTabs = tabs.filter(tab => tab.title.toLowerCase().includes(query) || tab.url.toLowerCase().includes(query));
    const tabIds = filteredTabs.map(tab => tab.id);

    chrome.tabs.group({ tabIds }, fetchTabs);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  fetchTabs();

  document.getElementById('search-bar').addEventListener('input', searchTabs);
});
