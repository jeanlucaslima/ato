import { tabList, groupList, statContainer } from "./ui.js";

const renderStats = (tabCounter, groupCounter) => {
  const statsBar = document.createElement('div');
  statContainer.innerHTML = '';

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
      <div class="group-item">
        <div class="group-title">
          ${group.title}
        </div>
      </div>
    `;
    groupList.appendChild(listItem);
  });

  tabResults.forEach(tab => {
    const listItem = document.createElement('div');
    listItem.innerHTML = `
      <div class="tab-item">
        <div class="tab-title">${tab.title}</div>
        <div class="tab-url">${tab.url}</div>
      </div>
    `;
    tabList.appendChild(listItem);
  });

  renderStats(tabResults.size, groupResults.size);
}

export { renderResults };
