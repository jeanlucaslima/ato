const tabList = document.getElementById('results-container-tabs');
const groupList = document.getElementById('results-container-tabs');

const tabs = await chrome.tabs.query({});
const groups = await chrome.tabGroups.query({});

const renderResults = (groups) => {
  tabList.innerHTML = '';
  groupList.innerHTML = '';

  groups.forEach(group => {
    const listItem = document.createElement('div');
    listItem.innerHTML = `
      <div>${group.title} | ${group.id} | ${group.color} </div>
    `;
    groupList.appendChild(listItem);
  });

  tabs.forEach(group => {
    const listItem = document.createElement('div');
    listItem.innerHTML = `
      <div>${group.title} | ${group.id} | ${group.color} </div>
    `;
    tabList.appendChild(listItem);
  });
}

renderResults(groups);
