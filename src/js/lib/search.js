import { displayTabs } from './display.js';
import { fetchGroups } from './tabActions.js';

let fuse;

chrome.tabs.query({}, function(tabs) {
  const options = {
    keys: ['title', 'url']
  };
  fuse = new Fuse(tabs, options);
});

export function searchTabs() {
  const query = document.getElementById('search-bar').value.toLowerCase();
  const result = fuse.search(query);
  const filteredTabs = result.map(item => item.item);

  displayTabs(filteredTabs);
  document.getElementById('group-search-results').style.display = filteredTabs.length > 0 ? 'block' : 'none';
}

export function groupSearchResults() {
  const query = document.getElementById('search-bar').value.toLowerCase();
  const result = fuse.search(query);
  const filteredTabs = result.map(item => item.item.id);

  if (filteredTabs.length > 0) {
    chrome.tabGroups.create({ title: 'Search Group' }, function(group) {
      chrome.tabs.group({ groupId: group.id, tabIds: filteredTabs }, function() {
        fetchTabs();
        fetchGroups();
      });
    });
  }
}
