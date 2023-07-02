import { objectToSet } from "./utils.js";

const tabs = await chrome.tabs.query({});
const groups = await chrome.tabGroups.query({});

// const allMediaTabs = '';
// const duplicatedTabs = '';

const allTabs = objectToSet(tabs);
const allGroups = objectToSet(groups);

export {allTabs, allGroups};
