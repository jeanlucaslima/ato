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
          ${group.title} <span class="group-color" color="${group.color}"></span>
        </div>
      </div>
    `;
    groupList.appendChild(listItem);
  });

  tabResults.forEach(tab => {
    const listItem = document.createElement('div');
    listItem.innerHTML = `
    <div class="tab-item">
      <div class="tab-area">
        <div class="tab-title">${tab.title}</div>
        <div class="tab-url">${tab.url}</div>
      <div/>
      <div class="tab-deck">
        <button class="close-tab">x</button>
        <button class="discard-tab">d</button>
        <button class="mute-tab">m</button>
      </div>
    </div>
    `;
    tabList.appendChild(listItem);

    // Add event listener to close button
    listItem.querySelector('.close-tab').addEventListener('click', async () => {
      await chrome.tabs.remove(tab.id);
      listItem.remove();
    });

    // Add event listener to navigate to tab onclick
    listItem.querySelector('.tab-area').addEventListener('click', async () => {
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    });
  });

  renderStats(tabResults.size, groupResults.size);
}

export { renderResults };
