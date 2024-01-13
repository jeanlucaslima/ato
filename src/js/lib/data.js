import { objectToSet } from "./utils.js";

const tabs = await chrome.tabs.query({});
const groups = await chrome.tabGroups.query({});
const playing = await chrome.tabs.query({audible:true});

const allTabs = objectToSet(tabs);
const allGroups = objectToSet(groups);
const playingTabs = objectToSet(playing);

export {allTabs, playingTabs, allGroups};
