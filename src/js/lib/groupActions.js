export function toggleGroups() {
  const groupList = document.getElementById('group-list');
  groupList.style.display = groupList.style.display === 'none' ? 'block' : 'none';
}

export function toggleTabs() {
  const tabList = document.getElementById('tab-list');
  tabList.style.display = tabList.style.display === 'none' ? 'block' : 'none';
}

export function toggleGroupTabs(groupId) {
  chrome.tabs.query({ groupId }, function(tabs) {
    displayTabs(tabs);
  });
}
