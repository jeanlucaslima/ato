import { displayTabs } from './display.js';
import { fetchTabs } from './tabActions.js';

export function updateStats(tabs) {
  const stats = document.getElementById('stats');

  const totalTabs = tabs.length;
  const audibleTabs = tabs.filter(tab => tab.audible).length;
  const duplicateTabs = findDuplicateTabs(tabs).length;

  chrome.tabGroups.query({}, function(groups) {
    const totalGroups = groups.length;
    stats.innerHTML = `Open Tabs: ${totalTabs}, Playing Music: ${audibleTabs}, Groups: ${totalGroups}, Duplicates: ${duplicateTabs}`;
  });
}

export function findDuplicateTabs(tabs) {
  const tabUrls = tabs.map(tab => tab.url);
  return tabUrls.filter((url, index) => tabUrls.indexOf(url) !== index);
}

export function killDuplicates() {
  chrome.tabs.query({}, function(tabs) {
    const duplicates = findDuplicateTabs(tabs);
    const tabIdsToRemove = tabs
      .filter(tab => duplicates.includes(tab.url))
      .map(tab => tab.id);

    chrome.tabs.remove(tabIdsToRemove, fetchTabs);
  });
}

export function showSoundTabs() {
  chrome.tabs.query({ audible: true }, function(tabs) {
    displayTabs(tabs);
  });
}
