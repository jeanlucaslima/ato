const tabList = document.getElementById('container-tab-list');
const groupList = document.getElementById('container-group-list');
const statContainer = document.getElementById('stats');

const tabs = await chrome.tabs.query({});
const groups = await chrome.tabGroups.query({});

const renderResults = () => {
  tabList.innerHTML = '';
  groupList.innerHTML = '';

  groups.forEach(group => {
    const listItem = document.createElement('div');
    listItem.innerHTML = `
      <div class="group">
        ${group.title} | ${group.id} | ${group.color}
      </div>
    `;
    groupList.appendChild(listItem);
  });

  tabs.forEach(tab => {
    const listItem = document.createElement('div');
    listItem.innerHTML = `
      <div class="tab">
        <div>${tab.title}</div>
        <div>${tab.url}</div>
      </div>
    `;
    tabList.appendChild(listItem);
  });

  const stats = document.createElement('div');
  stats.innerHTML = `
    <div>tabs: ${tabs.length}</div>
    <div>groups: ${groups.length}</div>
  `;
  statContainer.appendChild(stats);

}

renderResults();
