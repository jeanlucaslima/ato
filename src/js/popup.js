document.addEventListener('DOMContentLoaded', function() {
  fetchTabs();
  fetchGroups();

  document.getElementById('search-bar').addEventListener('input', searchTabs);
  document.getElementById('reset-search').addEventListener('click', fetchTabs);
  document.getElementById('group-search-results-button').addEventListener('click', groupSearchResults);
  document.getElementById('toggle-groups').addEventListener('click', toggleGroups);
  document.getElementById('toggle-tabs').addEventListener('click', toggleTabs);
});

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
    closeButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="#ffffff" d="M19.28 4.72a1 1 0 0 0-1.41 0L12 10.59 6.13 4.72a1 1 0 0 0-1.41 1.41L10.59 12l-5.87 5.87a1 1 0 1 0 1.41 1.41L12 13.41l5.87 5.87a1 1 0 0 0 1.41-1.41L13.41 12l5.87-5.87a1 1 0 0 0 0-1.41z"/></svg>`;
    closeButton.addEventListener('click', () => closeTab(tab.id));

    const muteButton = document.createElement('button');
    muteButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="#ffffff" d="M19.28 4.72a1 1 0 0 0-1.41 0L12 10.59 6.13 4.72a1 1 0 0 0-1.41 1.41L10.59 12l-5.87 5.87a1 1 0 1 0 1.41 1.41L12 13.41l5.87 5.87a1 1 0 0 0 1.41-1.41L13.41 12l5.87-5.87a1 1 0 0 0 0-1.41z"/></svg>`;
    muteButton.addEventListener('click', () => muteTab(tab.id));

    tabButtons.appendChild(closeButton);
    tabButtons.appendChild(muteButton);

    tabItem.appendChild(favicon);
    tabItem.appendChild(tabInfo);
    tabItem.appendChild(tabButtons);

    if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      tabItem.classList.add('group-marker');
    }

    tabList.appendChild(tabItem);
  });
}

function displayGroups(groups) {
  const groupList = document.getElementById('group-list');
  groupList.innerHTML = '';

  groups.forEach(group => {
    const groupItem = document.createElement('div');
    groupItem.className = 'group-item';
    groupItem.textContent = group.title;

    groupItem.addEventListener('click', () => toggleGroupTabs(group.id));
    groupList.appendChild(groupItem);
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

function closeTab(tabId) {
  chrome.runtime.sendMessage({ action: 'closeTab', tabId });
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

    const groupSearchResultsButton = document.getElementById('group-search-results');
    if (query) {
      groupSearchResultsButton.style.display = 'block';
    } else {
      groupSearchResultsButton.style.display = 'none';
    }
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

function toggleGroups() {
  const groupList = document.getElementById('group-list');
  groupList.style.display = groupList.style.display === 'none' ? 'block' : 'none';
}

function toggleTabs() {
  const tabList = document.getElementById('tab-list');
  tabList.style.display = tabList.style.display === 'none' ? 'block' : 'none';
}
