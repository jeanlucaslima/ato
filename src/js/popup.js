document.addEventListener('DOMContentLoaded', function() {
  // Fetch and display tabs
  fetchTabs();

  // Add event listeners
  document.getElementById('search-bar').addEventListener('input', searchTabs);
  document.getElementById('reset-search').addEventListener('click', fetchTabs);
  document.getElementById('kill-duplicates').addEventListener('click', killDuplicates);
  document.getElementById('show-sound-tabs').addEventListener('click', showSoundTabs);
});

function fetchTabs() {
  chrome.tabs.query({}, function(tabs) {
    displayTabs(tabs);
    updateStats(tabs);
  });
}

function displayTabs(tabs) {
  const tabList = document.getElementById('tab-list');
  tabList.innerHTML = '';

  tabs.forEach(tab => {
    const tabItem = document.createElement('div');
    tabItem.className = 'tab-item';

    const tabInfo = document.createElement('span');
    tabInfo.textContent = tab.title || tab.url;

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', () => closeTab(tab.id));

    const suspendButton = document.createElement('button');
    suspendButton.textContent = 'Suspend';
    suspendButton.addEventListener('click', () => suspendTab(tab.id));

    tabItem.appendChild(tabInfo);
    tabItem.appendChild(closeButton);
    tabItem.appendChild(suspendButton);

    tabList.appendChild(tabItem);
  });
}

function closeTab(tabId) {
  chrome.runtime.sendMessage({ action: 'closeTab', tabId }, function(response) {
    if (response.status === 'success') {
      fetchTabs();
    }
  });
}

function suspendTab(tabId) {
  chrome.runtime.sendMessage({ action: 'suspendTab', tabId }, function(response) {
    if (response.status === 'success') {
      fetchTabs();
    }
  });
}

function searchTabs() {
  const query = document.getElementById('search-bar').value.toLowerCase();
  chrome.tabs.query({}, function(tabs) {
    const filteredTabs = tabs.filter(tab =>
      tab.title.toLowerCase().includes(query) || tab.url.toLowerCase().includes(query)
    );
    displayTabs(filteredTabs);
  });
}

function updateStats(tabs) {
  const stats = document.getElementById('stats');

  const totalTabs = tabs.length;
  const audibleTabs = tabs.filter(tab => tab.audible).length;
  const duplicateTabs = findDuplicateTabs(tabs).length;

  chrome.tabGroups.query({}, function(groups) {
    const totalGroups = groups.length;
    stats.innerHTML = `Open Tabs: ${totalTabs}, Playing Music: ${audibleTabs}, Groups: ${totalGroups}, Duplicates: ${duplicateTabs}`;
  });
}

function findDuplicateTabs(tabs) {
  const tabUrls = tabs.map(tab => tab.url);
  return tabUrls.filter((url, index) => tabUrls.indexOf(url) !== index);
}

function killDuplicates() {
  chrome.tabs.query({}, function(tabs) {
    const duplicates = findDuplicateTabs(tabs);
    const tabIdsToRemove = tabs
      .filter(tab => duplicates.includes(tab.url))
      .map(tab => tab.id);

    chrome.tabs.remove(tabIdsToRemove, fetchTabs);
  });
}

function showSoundTabs() {
  chrome.tabs.query({ audible: true }, function(tabs) {
    displayTabs(tabs);
  });
}
