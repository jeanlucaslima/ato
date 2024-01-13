import { allTabs, allGroups } from "./data.js";
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

const initialRender = async () => {
  tabList.innerHTML = '';
  groupList.innerHTML = '';

  allGroups.forEach(group => {
    const listItem = document.createElement('div');
    listItem.innerHTML = `
      <div class="group-item">
        <div class="group-title">
          <p>
            ${group.title || "No title " + group.id }
            <span class="group-color" color="${group.color}"></span>
          </p>
        </div>
        <div class="group-deck">
          <button id="min-group">_</button>
          <button id="group-tab-counter">d</button>
        </div>
      </div>
    `;
    groupList.appendChild(listItem);

    // Add event listener to close button
    listItem.querySelector('#min-group').addEventListener('click', async () => {
      console.log('min-group-btn worked');
    });

    // Add event listener to discard button
    listItem.querySelector('#group-tab-counter').addEventListener('click', async () => {
      console.log('group-tab-counter worked');
    });
  });

  allTabs.forEach(tab => {
    const listItem = document.createElement('div');
    listItem.innerHTML = `
    <div class="tab-item">
      <div class="tab-area">
        <div class="tab-title">${tab.title}</div>
        <div class="tab-url">${tab.url}</div>
      <div/>
      <div class="tab-deck">
        <button id="close-tab">x</button>
        <button id="discard-tab">d</button>
        <button id="mute-tab">m</button>
      </div>
    </div>
    `;
    tabList.appendChild(listItem);

    // Add event listener to close button
    listItem.querySelector('#close-tab').addEventListener('click', async () => {
      await chrome.tabs.remove(tab.id);
      listItem.remove();
    });

    // Add event listener to discard button
    listItem.querySelector('#discard-tab').addEventListener('click', async () => {
      await chrome.tabs.discard(tab.id);
    });

    // Add event listener to navigate to tab onclick
    listItem.querySelector('.tab-area').addEventListener('click', async () => {
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    });
  });

  renderStats(allTabs.size, allGroups.size);
};


const renderResults = async (searchResults) => {
  console.log(searchResults);
};

export { renderResults, initialRender };
