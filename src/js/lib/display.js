export function displayTabs(tabs) {
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

    const suspendButton = document.createElement('button');
    suspendButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="#ffffff" d="M10 2H14V10H10V2M17 22H7V20H17V22M17 18H7V16H17V18Z"/></svg>`;
    suspendButton.addEventListener('click', () => suspendTab(tab.id));

    tabButtons.appendChild(closeButton);
    tabButtons.appendChild(suspendButton);

    tabItem.appendChild(favicon);
    tabItem.appendChild(tabInfo);
    tabItem.appendChild(tabButtons);

    if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      tabItem.classList.add('group-marker');
    }

    tabList.appendChild(tabItem);
  });
}

export function displayGroups(groups) {
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
