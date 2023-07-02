const tabList = document.getElementById('container-tab-list');
const groupList = document.getElementById('container-group-list');
const statContainer = document.getElementById('stats');

const renderStats = (tabCounter, groupCounter) => {
  const statsBar = document.createElement('div');
  statsBar.innerHTML = `
    <div>tabs: ${tabCounter}</div>
    <div>groups: ${groupCounter}</div>
  `;

  statContainer.appendChild(statsBar);
}

const renderResults = (tabResults, groupResults) => {
  tabList.innerHTML = '';
  groupList.innerHTML = '';

  groupResults.forEach(group => {
    const listItem = document.createElement('div');
    listItem.innerHTML = `
      <div class="group">
        ${group.title} | ${group.id} | ${group.color}
      </div>
    `;
    groupList.appendChild(listItem);
  });

  tabResults.forEach(tab => {
    const listItem = document.createElement('div');
    listItem.innerHTML = `
      <div class="tab">
        <div>${tab.title}</div>
        <div>${tab.url}</div>
      </div>
    `;
    tabList.appendChild(listItem);
  });

  renderStats(tabResults.length, groupResults.length);
}

export { renderResults };
