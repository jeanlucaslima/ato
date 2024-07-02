import { displayTabs } from './display.js';
import { updateStats } from './utils.js';

export function fetchTabs() {
  chrome.tabs.query({}, function(tabs) {
    displayTabs(tabs);
    updateStats(tabs);
  });
}

export function closeTab(tabId) {
  chrome.runtime.sendMessage({ action: 'closeTab', tabId }, function(response) {
    if (response && response.status === 'success') {
      fetchTabs();
    }
  });
}

export function suspendTab(tabId) {
  chrome.runtime.sendMessage({ action: 'suspendTab', tabId }, function(response) {
    if (response && response.status === 'success') {
      fetchTabs();
    }
  });
}

export function fetchGroups() {
  chrome.tabGroups.query({}, function(groups) {
    displayGroups(groups);
  });
}
