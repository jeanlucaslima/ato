import { renderResults } from "./lib/render.js";

const tabs = await chrome.tabs.query({});
const groups = await chrome.tabGroups.query({});

renderResults(tabs, groups);
