import { objectToSet } from "./utils.js";

const tabs = await chrome.tabs.query({});
const groups = await chrome.tabGroups.query({});
const playing = await chrome.tabs.query({audible:true});

const allTabs = objectToSet(tabs);
const allGroups = objectToSet(groups);
const playingTabs = objectToSet(playing);

const find_duplicates = (tabs) => {
  const urlMap = new Map();
  const duplicateTabIds = [];

  tabs.forEach(tab => {
    if(tab.url) {
      if(urlMap.has(tab.url)) {
        duplicateTabIds.push(tab.id);
      } else {
        urlMap.set(tab.url, true)
      }
    }
  });

  return duplicateTabIds;
};

const duplicatedTabsList = find_duplicates(allTabs);

export {allTabs, playingTabs, allGroups, duplicatedTabsList};
